const express = require('express');
const multer = require('multer');
const cookieSession = require('cookie-session');
const path = require('path');
const fs = require('fs');

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

function readProducts() {
    initProductsFile();
    try { return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8')); }
    catch { return { products: [], nextId: 1 }; }
}

function writeProducts(data) {
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
app.get('/api/products', (req, res) => {
    const data = readProducts();
    res.json({ products: data.products });
});

// Add product (protected) — image saved to disk from memory buffer
app.post('/api/products', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const { name, price, category } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing fields' });

    // Save the buffer to disk (UPLOADS_DIR)
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    const filename = uniqueSuffix + path.extname(req.file.originalname);
    const filePath = path.join(UPLOADS_DIR, filename);

    try {
        fs.writeFileSync(filePath, req.file.buffer);
    } catch (err) {
        return res.status(500).json({ error: 'Failed to save image: ' + err.message });
    }

    const data = readProducts();
    const newProduct = {
        id: data.nextId++,
        name,
        price,
        category,
        image_url: '/uploads/' + filename
    };
    data.products.push(newProduct);
    writeProducts(data);

    res.json(newProduct);
});

// Delete product (protected)
app.delete('/api/products/:id', requireAuth, (req, res) => {
    const id = parseInt(req.params.id);
    const data = readProducts();
    const idx = data.products.findIndex(p => p.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });

    const product = data.products[idx];
    if (product.image_url) {
        const filename = path.basename(product.image_url);
        const filePath = path.join(UPLOADS_DIR, filename);
        try { if (fs.existsSync(filePath)) fs.unlinkSync(filePath); } catch {}
    }

    data.products.splice(idx, 1);
    writeProducts(data);
    res.json({ deleted: 1 });
});

// ── Local dev server ─────────────────────────────────────
if (!IS_VERCEL) {
    app.listen(PORT, () => console.log(`✨ Nimooh's Closet → http://localhost:${PORT}`));
}

module.exports = app;
