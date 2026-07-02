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
const GITHUB_FILE   = process.env.GITHUB_FILE   || 'data/products.json';
const USE_GITHUB    = IS_VERCEL && !!GITHUB_TOKEN;

// ── Local data paths (used for local dev) ───────────────
const DATA_DIR      = path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR   = IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'public', 'uploads');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!IS_VERCEL && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ── GitHub API Helpers ───────────────────────────────────
async function githubRequest(method, endpoint, body) {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/${endpoint}`;
    const res = await fetch(url, {
        method,
        headers: {
            'Authorization': `token ${GITHUB_TOKEN}`,
            'Content-Type': 'application/json',
            'Accept': 'application/vnd.github.v3+json'
        },
        body: body ? JSON.stringify(body) : undefined
    });
    return res.json();
}

async function readProducts() {
    if (USE_GITHUB) {
        try {
            const result = await githubRequest('GET', `contents/${GITHUB_FILE}`);
            if (result.content) {
                const content = Buffer.from(result.content, 'base64').toString('utf8');
                return JSON.parse(content);
            }
        } catch (err) {
            console.error('GitHub Read Error:', err);
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

async function writeProducts(data) {
    if (USE_GITHUB) {
        try {
            // Get current file SHA (required for GitHub updates)
            const current = await githubRequest('GET', `contents/${GITHUB_FILE}`);
            const sha = current.sha;

            const content = Buffer.from(JSON.stringify(data, null, 2)).toString('base64');
            await githubRequest('PUT', `contents/${GITHUB_FILE}`, {
                message: 'chore: update products.json via admin portal',
                content,
                sha
            });
            return;
        } catch (err) {
            console.error('GitHub Write Error:', err);
        }
    }
    // Local fallback
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
}

// ── Middleware ───────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

// cookie-session: stores session DATA inside the cookie itself — works on serverless!
app.use(cookieSession({
    name: 'nimooh_session',
    secret: process.env.SESSION_SECRET || 'nimooh-closet-secret-key-2025-xyz',
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secure: false,
    httpOnly: true,
    sameSite: 'lax'
}));

// ── Multer: memory storage (works on serverless, no disk needed) ──
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// ── Auth middleware ──────────────────────────────────────
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId === 'admin') return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// ── API Routes ───────────────────────────────────────────

// Check session
app.get('/api/check-session', (req, res) => {
    res.json({ loggedIn: !!(req.session && req.session.userId === 'admin') });
});

// Login
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

// Logout
app.post('/api/logout', (req, res) => {
    req.session = null;
    res.json({ success: true });
});

// Get all products (public)
app.get('/api/products', async (req, res) => {
    const data = await readProducts();
    res.json({ products: data.products });
});

// Add product (protected) — images saved as base64 strings
app.post('/api/products', requireAuth, upload.array('images', 5), async (req, res) => {
    if (!req.files || req.files.length === 0) return res.status(400).json({ error: 'No images uploaded' });

    const { name, price, category } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing fields' });

    // Convert image buffers to base64 data URLs
    const image_urls = req.files.map(file => {
        const base64Image = file.buffer.toString('base64');
        const mimeType = file.mimetype || 'image/jpeg';
        return `data:${mimeType};base64,${base64Image}`;
    });

    const data = await readProducts();
    const newProduct = {
        id: data.nextId++,
        name,
        price,
        category,
        image_url: image_urls[0], // fallback for backwards compatibility
        image_urls: image_urls
    };
    data.products.push(newProduct);
    await writeProducts(data);

    res.json(newProduct);
});

// Delete product (protected)
app.delete('/api/products/:id', requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const data = await readProducts();
    const idx = data.products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    data.products.splice(idx, 1);
    await writeProducts(data);
    res.json({ deleted: 1 });
});

// ── Local dev server ─────────────────────────────────────
if (!IS_VERCEL) {
    app.listen(PORT, () => console.log(`✨ Nimooh's Closet → http://localhost:${PORT}`));
}

module.exports = app;
