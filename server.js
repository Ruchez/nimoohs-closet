const express = require('express');
const multer = require('multer');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

const IS_VERCEL = !!process.env.VERCEL;

// ── GitHub API config ────────────────────────────────────
const GITHUB_TOKEN  = process.env.GITHUB_TOKEN;
const GITHUB_OWNER  = process.env.GITHUB_OWNER  || 'Ruchez';
const GITHUB_REPO   = process.env.GITHUB_REPO   || 'nimoohs-closet';
const GITHUB_BRANCH = 'main';
const USE_GITHUB    = IS_VERCEL && !!GITHUB_TOKEN;
const RAW_BASE = `https://raw.githubusercontent.com/${GITHUB_OWNER}/${GITHUB_REPO}/${GITHUB_BRANCH}`;
const PRODUCTS_REPO_PATH = 'data/products.json';

// ── In-memory cache (speeds up reads; invalidated on every write) ──
let _cache = null;
let _cacheTime = 0;
const CACHE_TTL_MS = 30 * 1000; // 30 seconds

// ── Local data paths ─────────────────────────────────────
const DATA_DIR      = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR   = path.join(__dirname, 'public', 'uploads');

if (!IS_VERCEL && !fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!IS_VERCEL && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── GitHub API Helpers ───────────────────────────────────
async function githubRequest(method, endpoint, body) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/${endpoint}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json',
            'User-Agent': 'nimooh-closet-server'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
}

// Read products — checks in-memory cache first, then GitHub Contents API
async function readProducts() {
    if (USE_GITHUB) {
        // Return cached data if still fresh
        if (_cache && (Date.now() - _cacheTime < CACHE_TTL_MS)) {
            return _cache;
        }
        try {
            const result = await githubRequest('GET', `contents/${PRODUCTS_REPO_PATH}`);
            if (result.content && result.encoding === 'base64') {
                const raw = Buffer.from(result.content.replace(/\n/g, ''), 'base64').toString('utf8');
                const data = JSON.parse(raw);
                _cache = data;
                _cacheTime = Date.now();
                return data;
            }
        } catch (err) {
            console.error('GitHub Read Error:', err);
            if (_cache) return _cache; // serve stale cache on error
        }
        return { products: [], nextId: 1 };
    }
    // Local fallback
    if (!fs.existsSync(PRODUCTS_FILE)) {
        fs.writeFileSync(PRODUCTS_FILE, JSON.stringify({ products: [], nextId: 1 }, null, 2));
    }
    try { return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')); }
    catch { return { products: [], nextId: 1 }; }
}

// Write products.json — updates cache immediately so same instance reflects change at once
async function writeProducts(data) {
    // Update in-memory cache immediately (no waiting for GitHub)
    _cache = data;
    _cacheTime = Date.now();

    if (USE_GITHUB) {
        try {
            const current = await githubRequest('GET', `contents/${PRODUCTS_REPO_PATH}`);
            const sha = current.sha;
            if (!sha) throw new Error('Could not get current file SHA');
            const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
            const result = await githubRequest('PUT', `contents/${PRODUCTS_REPO_PATH}`, {
                message: 'chore: update products.json via admin portal',
                content,
                sha,
                branch: GITHUB_BRANCH
            });
            if (!result.commit) throw new Error('GitHub write failed: ' + JSON.stringify(result).substring(0, 200));
            return;
        } catch (err) {
            console.error('GitHub Write Error:', err);
            throw err;
        }
    }
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
}

// Upload an image file to GitHub, return its permanent CDN URL
async function uploadImageToGitHub(buffer, mimetype, originalname) {
    const ext = (originalname.includes('.') ? '.' + originalname.split('.').pop().toLowerCase() : '.jpg');
    const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
    const repoPath = `public/uploads/${filename}`;
    const content = buffer.toString('base64');

    const result = await githubRequest('PUT', `contents/${repoPath}`, {
        message: `feat: add product image ${filename}`,
        content,
        branch: GITHUB_BRANCH
    });

    if (!result.commit && !result.content) {
        throw new Error(`Image upload to GitHub failed: ${JSON.stringify(result).substring(0, 200)}`);
    }
    return `${RAW_BASE}/${repoPath}`;
}

// ── Middleware ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(cookieSession({
    name: 'nimooh_session',
    secret: process.env.SESSION_SECRET || 'nimooh-closet-secret-key-2025-xyz',
    maxAge: 24 * 60 * 60 * 1000,
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
}));

const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId === 'admin') return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// ── API Routes ───────────────────────────────────────────

app.get('/api/check-session', (req, res) => {
    res.json({ loggedIn: !!(req.session && req.session.userId === 'admin') });
});

app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    const ADMIN_USER = process.env.ADMIN_USERNAME || 'ghoul';
    const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'morio1234';
    if (username === ADMIN_USER && password === ADMIN_PASS) {
        req.session.userId = 'admin';
        res.json({ success: true, message: 'Logged in successfully' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.post('/api/logout', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

// Get all products (public)
app.get('/api/products', async (req, res) => {
    try {
        const data = await readProducts();
        res.json({ products: data.products });
    } catch (err) {
        res.status(500).json({ products: [], error: 'Could not load products' });
    }
});

// Add product (protected)
app.post('/api/products', requireAuth, upload.array('images', 5), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images uploaded' });
    const { name, price, category } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing fields' });

    let image_urls = [];

    if (USE_GITHUB) {
        for (const file of req.files) {
            try {
                const url = await uploadImageToGitHub(file.buffer, file.mimetype, file.originalname);
                image_urls.push(url);
            } catch (err) {
                return res.status(500).json({ error: 'Image upload failed: ' + err.message });
            }
        }
    } else {
        if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
        image_urls = req.files.map(file => {
            const ext = path.extname(file.originalname) || '.jpg';
            const filename = `${Date.now()}-${Math.round(Math.random() * 1e6)}${ext}`;
            fs.writeFileSync(path.join(UPLOADS_DIR, filename), file.buffer);
            return `/uploads/${filename}`;
        });
    }

    try {
        const data = await readProducts();
        const newProduct = { id: data.nextId++, name, price, category, image_url: image_urls[0], image_urls };
        data.products.push(newProduct);
        await writeProducts(data);
        res.json(newProduct);
    } catch (err) {
        res.status(500).json({ error: 'Failed to save product: ' + err.message });
    }
});

// Delete product (protected)
app.delete('/api/products/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    try {
        const data = await readProducts();
        const idx = data.products.findIndex(p => p.id === id);
        if (idx === -1) return res.status(404).json({ error: 'Not found' });
        data.products.splice(idx, 1);
        await writeProducts(data);
        res.json({ deleted: 1 });
    } catch (err) {
        res.status(500).json({ error: 'Failed to delete product: ' + err.message });
    }
});

if (!IS_VERCEL) {
    app.listen(PORT, () => console.log(`✨ Nimooh's Closet → http://localhost:${PORT}`));
}

module.exports = app;
