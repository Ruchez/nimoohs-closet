const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const multer = require('multer');
const session = require('express-session');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// Setup directories
const uploadsDir = path.join(__dirname, 'public', 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
}

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
    secret: 'nimooh-closet-secret-key',
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false } // Set to true if using HTTPS
}));

// Setup Multer for Image Uploads
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'public/uploads/')
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database Setup
const db = new sqlite3.Database('./database.sqlite', (err) => {
    if (err) {
        console.error('Error opening database', err.message);
    } else {
        console.log('Connected to the SQLite database.');
        db.run(`CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            price TEXT NOT NULL,
            category TEXT NOT NULL,
            image_url TEXT NOT NULL
        )`);
    }
});

// Authentication Middleware
const requireAuth = (req, res, next) => {
    if (req.session.userId === 'admin') {
        next();
    } else {
        res.status(401).json({ error: 'Unauthorized' });
    }
};

// Routes
// 1. Admin Login
app.post('/api/login', (req, res) => {
    const { username, password } = req.body;
    if (username === 'ghoul' && password === 'morio1234') {
        req.session.userId = 'admin';
        res.json({ success: true, message: 'Logged in successfully' });
    } else {
        res.status(401).json({ success: false, message: 'Invalid credentials' });
    }
});

app.get('/api/check-session', (req, res) => {
    if (req.session.userId === 'admin') {
        res.json({ loggedIn: true });
    } else {
        res.json({ loggedIn: false });
    }
});

app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// 2. Get Products (Public)
app.get('/api/products', (req, res) => {
    db.all("SELECT * FROM products", [], (err, rows) => {
        if (err) {
            res.status(500).json({ error: err.message });
            return;
        }
        res.json({ products: rows });
    });
});

// 3. Add Product (Protected)
app.post('/api/products', requireAuth, upload.single('image'), (req, res) => {
    const { name, price, category } = req.body;
    
    if (!req.file) {
        return res.status(400).json({ error: 'No image uploaded' });
    }

    const imageUrl = '/uploads/' + req.file.filename;

    const sql = 'INSERT INTO products (name, price, category, image_url) VALUES (?, ?, ?, ?)';
    db.run(sql, [name, price, category, imageUrl], function(err) {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        res.json({ id: this.lastID, name, price, category, image_url: imageUrl });
    });
});

// 4. Delete Product (Protected)
app.delete('/api/products/:id', requireAuth, (req, res) => {
    const id = req.params.id;
    // First get the image url to delete the file
    db.get('SELECT image_url FROM products WHERE id = ?', [id], (err, row) => {
        if (err) {
            return res.status(500).json({ error: err.message });
        }
        if (row && row.image_url) {
            const filePath = path.join(__dirname, 'public', row.image_url);
            if (fs.existsSync(filePath)) {
                fs.unlinkSync(filePath);
            }
        }
        
        db.run('DELETE FROM products WHERE id = ?', [id], function(err) {
            if (err) {
                return res.status(500).json({ error: err.message });
            }
            res.json({ deleted: this.changes });
        });
    });
});

// Start Server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
