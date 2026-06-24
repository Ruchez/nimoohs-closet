const sqlite3 = require('sqlite3').verbose();
const db = new sqlite3.Database('./database.sqlite');

const products = [
    { name: 'Elegant Evening Dress', price: '$120.00', category: 'clothing', image_url: '/images/product_dress.png' },
    { name: 'Blush Leather Handbag', price: '$85.00', category: 'handbags', image_url: '/images/product_bag.png' },
    { name: 'Gold Pendant Necklace', price: '$45.00', category: 'accessories', image_url: '/images/product_accessory.png' },
    { name: 'Summer Floral Dress', price: '$95.00', category: 'clothing', image_url: '/images/product_dress.png' }
];

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS products (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        price TEXT NOT NULL,
        category TEXT NOT NULL,
        image_url TEXT NOT NULL
    )`);

    const stmt = db.prepare('INSERT INTO products (name, price, category, image_url) VALUES (?, ?, ?, ?)');
    products.forEach(p => {
        stmt.run(p.name, p.price, p.category, p.image_url);
    });
    stmt.finalize();
    console.log('Database seeded successfully.');
});

db.close();
