const express = require('express');
const multer = require('multer');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');
const { kv } = require('@vercel/kv');

const app = express();
const PORT = process.env.PORT || 3000;

const IS_VERCEL = !!process.env.VERCEL;

// ── Data storage (JSON file in /tmp on Vercel, local /data otherwise) ──
const DATA_DIR    = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR = IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'public', 'uploads');
const SEED_FILE   = path.join(__dirname, 'data', 'products.json');

if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!IS_VERCEL && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

function initProductsFile() {
    if (!fs.existsSync(PRODUCTS_FILE)) {
        if (fs.existsSync(SEED_FILE)) {
            fs.copyFileSync(SEED_FILE, PRODUCTS_FILE);
        } else {
            fs.writeFileSync(PRODUCTS_FILE, JSON.stringify({ products: [], nextId: 1 }));
        }
    }
}

async function readProducts() {
    if (IS_VERCEL && process.env.KV_REST_API_URL) {
        try {
            const data = await kv.get('nimooh_products');
            return data || { products: [], nextId: 1 };
        } catch (err) {
            console.error('KV Read Error:', err);
            return { products: [], nextId: 1 };
        }
    }
    
    initProductsFile();
    try { return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')); }
    catch { return { products: [], nextId: 1 }; }
}

async function writeProducts(data) {
    if (IS_VERCEL && process.env.KV_REST_API_URL) {
        try {
            await kv.set('nimooh_products', data);
            return;
        } catch (err) {
            console.error('KV Write Error:', err);
        }
    }
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
    secure: false,   // set true only if you have HTTPS enforced (Vercel handles this)
    httpOnly: true,
    sameSite: 'lax'
}));

// ── Multer: memory storage (works on serverless, no disk needed) ──
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 4 * 1024 * 1024 }, // 4MB (Vercel limit is 4.5MB)
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
    req.session = null; // cookie-session way to clear
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

    const product = data.products[idx];
    if (product.image_url && product.image_url.startsWith('/uploads/')) {
        const filename = path.basename(product.image_url);
        const filePath = path.join(UPLOADS_DIR, filename);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }

    data.products.splice(idx, 1);
    await writeProducts(data);
    res.json({ deleted: 1 });
});

// ── Local dev server ─────────────────────────────────────
if (!IS_VERCEL) {
    app.listen(PORT, () => console.log(`✨ Nimooh's Closet → http://localhost:${PORT}`));
}

module.exports = app;
