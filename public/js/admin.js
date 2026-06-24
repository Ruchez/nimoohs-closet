document.addEventListener('DOMContentLoaded', () => {
    const loginSection = document.getElementById('login-section');
    const dashboardSection = document.getElementById('dashboard-section');
    const loginForm = document.getElementById('login-form');
    const loginError = document.getElementById('login-error');
    const logoutBtn = document.getElementById('logout-btn');
    const addProductForm = document.getElementById('add-product-form');
    const productList = document.getElementById('product-list');

    // Check Session on Load
    fetch('/api/check-session')
        .then(res => res.json())
        .then(data => {
            if (data.loggedIn) {
                showDashboard();
            }
        });

    // Login Handler
    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        const username = document.getElementById('username').value;
        const password = document.getElementById('password').value;

        const res = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.success) {
            loginError.textContent = '';
            showDashboard();
        } else {
            loginError.textContent = data.message;
        }
    });

    // Logout Handler
    logoutBtn.addEventListener('click', async () => {
        await fetch('/api/logout', { method: 'POST' });
        loginSection.classList.remove('hidden');
        dashboardSection.classList.add('hidden');
        document.getElementById('username').value = '';
        document.getElementById('password').value = '';
    });

    function showDashboard() {
        loginSection.classList.add('hidden');
        dashboardSection.classList.remove('hidden');
        loadProducts();
    }

    // Add Product Handler
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const formData = new FormData();
        formData.append('name', document.getElementById('product-name').value);
        formData.append('price', document.getElementById('product-price').value);
        formData.append('category', document.getElementById('product-category').value);
        formData.append('image', document.getElementById('product-image').files[0]);

        const res = await fetch('/api/products', {
            method: 'POST',
            body: formData // Multer will parse this
        });

        if (res.ok) {
            addProductForm.reset();
            loadProducts();
            alert('Product uploaded successfully!');
        } else {
            alert('Failed to upload product.');
        }
    });

    // Load Products
    async function loadProducts() {
        const res = await fetch('/api/products');
        const data = await res.json();
        
        productList.innerHTML = '';
        data.products.forEach(p => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><img src="${p.image_url}" alt="${p.name}"></td>
                <td>${p.name}</td>
                <td>${p.price}</td>
                <td style="text-transform: capitalize;">${p.category}</td>
                <td><button class="btn-danger" onclick="deleteProduct(${p.id})">Delete</button></td>
            `;
            productList.appendChild(tr);
        });
    }

    // Delete Product
    window.deleteProduct = async (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                loadProducts();
            }
        }
    };
});
