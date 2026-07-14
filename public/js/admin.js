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
        .then(data => { if (data.loggedIn) showDashboard(); });

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

    // ── Upload progress bar helpers ──────────────────────
    function showProgress(msg) {
        let bar = document.getElementById('upload-progress');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'upload-progress';
            bar.style.cssText = 'margin-top:1rem;padding:1rem;border-radius:8px;background:#fff3cd;border:1px solid #ffc107;color:#856404;font-weight:500;text-align:center;';
            addProductForm.parentNode.insertBefore(bar, addProductForm.nextSibling);
        }
        bar.textContent = msg;
        bar.style.display = 'block';
    }

    function hideProgress() {
        const bar = document.getElementById('upload-progress');
        if (bar) bar.style.display = 'none';
    }

    function showSuccess(msg) {
        let bar = document.getElementById('upload-progress');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'upload-progress';
            addProductForm.parentNode.insertBefore(bar, addProductForm.nextSibling);
        }
        bar.style.cssText = 'margin-top:1rem;padding:1rem;border-radius:8px;background:#d4edda;border:1px solid #28a745;color:#155724;font-weight:500;text-align:center;';
        bar.textContent = msg;
        bar.style.display = 'block';
        setTimeout(hideProgress, 4000);
    }

    function showError(msg) {
        let bar = document.getElementById('upload-progress');
        if (!bar) {
            bar = document.createElement('div');
            bar.id = 'upload-progress';
            addProductForm.parentNode.insertBefore(bar, addProductForm.nextSibling);
        }
        bar.style.cssText = 'margin-top:1rem;padding:1rem;border-radius:8px;background:#f8d7da;border:1px solid #dc3545;color:#721c24;font-weight:500;text-align:center;';
        bar.textContent = msg;
        bar.style.display = 'block';
    }

    // Add Product Handler
    addProductForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const submitBtn = addProductForm.querySelector('button[type="submit"]');
        submitBtn.disabled = true;
        submitBtn.textContent = 'Uploading…';

        const files = document.getElementById('product-images').files;
        const fileCount = files.length;
        showProgress(`⏳ Uploading ${fileCount} image${fileCount > 1 ? 's' : ''} to GitHub… this takes ~${fileCount * 5} seconds. Please wait.`);

        const formData = new FormData();
        formData.append('name', document.getElementById('product-name').value);
        formData.append('price', document.getElementById('product-price').value);
        formData.append('category', document.getElementById('product-category').value);
        for (let i = 0; i < files.length; i++) {
            formData.append('images', files[i]);
        }

        try {
            const res = await fetch('/api/products', { method: 'POST', body: formData });
            const newProduct = await res.json();

            if (res.ok) {
                addProductForm.reset();
                showSuccess(`✅ "${newProduct.name}" uploaded successfully! It is now live on the shop.`);
                // Instantly add to the product table — no reload needed
                addProductRow(newProduct);
            } else {
                showError(`❌ Upload failed: ${newProduct.error || 'Unknown error'}`);
            }
        } catch (err) {
            showError(`❌ Network error: ${err.message}`);
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = 'Upload Product';
        }
    });

    // Instantly add a single product row at the TOP of the table
    function addProductRow(p) {
        const tr = buildRow(p);
        productList.insertBefore(tr, productList.firstChild);
    }

    function buildRow(p) {
        const tr = document.createElement('tr');
        tr.id = `product-row-${p.id}`;
        tr.innerHTML = `
            <td><img src="${p.image_url}" alt="${p.name}" style="width:60px;height:60px;object-fit:contain;border-radius:5px;background:#f9f9f9;"></td>
            <td>${p.name}</td>
            <td>${p.price}</td>
            <td style="text-transform:capitalize;">${p.category}</td>
            <td><button class="btn-danger" onclick="deleteProduct(${p.id})">Delete</button></td>
        `;
        return tr;
    }

    // Load Products
    async function loadProducts() {
        productList.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#999;">Loading products…</td></tr>';
        try {
            const res = await fetch('/api/products');
            const data = await res.json();
            productList.innerHTML = '';
            if (data.products.length === 0) {
                productList.innerHTML = '<tr><td colspan="5" style="text-align:center;padding:2rem;color:#999;">No products yet. Add your first product above!</td></tr>';
                return;
            }
            data.products.slice().reverse().forEach(p => {
                productList.appendChild(buildRow(p));
            });
        } catch (err) {
            productList.innerHTML = '<tr><td colspan="5" style="text-align:center;color:red;">Failed to load products.</td></tr>';
        }
    }

    // Delete Product
    window.deleteProduct = async (id) => {
        if (confirm('Are you sure you want to delete this product?')) {
            const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
            if (res.ok) {
                const row = document.getElementById(`product-row-${id}`);
                if (row) row.remove();
            }
        }
    };
});
