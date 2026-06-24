const express = require('express');
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// -------------------------------------------------------
// On Vercel, the filesystem is read-only except for /tmp.
// We store products in a JSON file in /tmp.
// We ship a seed file (data/products.json) with the repo,
// and copy it to /tmp on first boot.
// -------------------------------------------------------
const IS_VERCEL = !!process.env.VERCEL;
const DATA_DIR = IS_VERCEL ? '/tmp' : path.join(__dirname, 'data');
const PRODUCTS_FILE = path.join(DATA_DIR, 'products.json');
const UPLOADS_DIR = IS_VERCEL ? '/tmp/uploads' : path.join(__dirname, 'public', 'uploads');
const SEED_FILE = path.join(__dirname, 'data', 'products.json');

// Ensure required directories exist
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!IS_VERCEL && !fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// Initialize products.json from seed if not present (Vercel /tmp is ephemeral)
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
    try {
        return JSON.parse(fs.readFileSync(PRODUCTS_FILE, 'utf8'));
    } catch {
        return { products: [], nextId: 1 };
    }
}

function writeProducts(data) {
    fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(UPLOADS_DIR));

app.use(session({
    secret: process.env.SESSION_SECRET || 'nimooh-closet-secret-key-2025',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: IS_VERCEL, maxAge: 24 * 60 * 60 * 1000 }
}));

// Multer for image uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) cb(null, true);
        else cb(new Error('Only image files are allowed'));
    }
});

// Auth middleware
const requireAuth = (req, res, next) => {
    if (req.session && req.session.userId === 'admin') return next();
    res.status(401).json({ error: 'Unauthorized' });
};

// ── API Routes ──────────────────────────────────────────

// Check session
app.get('/api/check-session', (req, res) => {
    res.json({ loggedIn: req.session && req.session.userId === 'admin' });
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
    req.session.destroy();
    res.json({ success: true });
});

// Get all products (public)
app.get('/api/products', (req, res) => {
    const data = readProducts();
    res.json({ products: data.products });
});

// Add product (protected)
app.post('/api/products', requireAuth, upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded' });

    const { name, price, category } = req.body;
    if (!name || !price || !category) return res.status(400).json({ error: 'Missing fields' });

    const data = readProducts();
    const newProduct = {
        id: data.nextId++,
        name,
        price,
        category,
        image_url: '/uploads/' + req.file.filename
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
    // Remove image file
    if (product.image_url) {
        const filename = path.basename(product.image_url);
        const filePath = path.join(UPLOADS_DIR, filename);
        if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }

    data.products.splice(idx, 1);
    writeProducts(data);
    res.json({ deleted: 1 });
});

// ── Start server locally ────────────────────────────────
if (!IS_VERCEL) {
    app.listen(PORT, () => {
        console.log(`✨ Nimooh's Closet running at http://localhost:${PORT}`);
    });
}

module.exports = app;
