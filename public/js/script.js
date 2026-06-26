document.addEventListener('DOMContentLoaded', () => {
    // Closet Animation
    const closetOverlay = document.getElementById('closet-overlay');
    if (closetOverlay) {
        // Start opening animation after a brief delay
        setTimeout(() => {
            closetOverlay.classList.add('open');
            
            const welcomeMsg = document.getElementById('welcome-message');
            if (welcomeMsg) {
                // Show welcome slightly after doors start opening
                setTimeout(() => {
                    welcomeMsg.classList.add('show');
                }, 300);

                // Fade out welcome message
                setTimeout(() => {
                    welcomeMsg.classList.remove('show');
                    welcomeMsg.classList.add('hide');
                }, 3000);
            }

            // Remove doors from DOM after animation completes (1.5s)
            setTimeout(() => {
                closetOverlay.style.display = 'none';
            }, 1500);
        }, 800);
    }

    // Mobile Menu Toggle
    const menuToggle = document.getElementById('mobile-menu');
    const navLinks = document.querySelector('.nav-links');

    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navLinks.classList.toggle('active');
        });
    }

    // Dynamic Shop Loading & Filtering
    const productGrid = document.getElementById('product-grid');
    const filterBtns = document.querySelectorAll('.filter-btn');
    const whatsappNumber = '905338487591'; // Updated number

    // If we are on a page with productGrid (Shop page)
    if (productGrid) {
        fetch('/api/products')
            .then(res => res.json())
            .then(data => {
                renderProducts(data.products);
                bindFilters();
            })
            .catch(err => console.error('Error fetching products:', err));
    } else {
        // If not on shop page, just bind generic WhatsApp buttons
        bindWhatsAppButtons(document.querySelectorAll('.btn-whatsapp'));
    }

    function renderProducts(products) {
        productGrid.innerHTML = '';
        products.forEach(p => {
            const card = document.createElement('div');
            card.className = 'product-card';
            card.setAttribute('data-category', p.category);

            // Handle multiple images
            const images = p.image_urls && p.image_urls.length > 0 ? p.image_urls : [p.image_url];
            const hasMultiple = images.length > 1;
            
            let imageHTML = images.map((src, i) => 
                `<img src="${src}" alt="${p.name}" class="${i === 0 ? 'active' : ''}" style="display: ${i === 0 ? 'block' : 'none'};">`
            ).join('');
            
            if (hasMultiple) {
                imageHTML += `
                    <button class="carousel-btn prev" aria-label="Previous image">&lt;</button>
                    <button class="carousel-btn next" aria-label="Next image">&gt;</button>
                `;
            }

            card.innerHTML = `
                <div class="product-image">
                    ${imageHTML}
                </div>
                <div class="product-info">
                    <h3 class="product-title">${p.name}</h3>
                    <div class="product-price">${p.price}</div>
                    <a href="#" class="btn btn-whatsapp"><i class="fab fa-whatsapp"></i> Inquire on WhatsApp</a>
                </div>
            `;
            productGrid.appendChild(card);
        });
        // Bind WhatsApp buttons for dynamically created cards
        bindWhatsAppButtons(productGrid.querySelectorAll('.btn-whatsapp'));
        bindCarouselButtons();
    }

    function bindCarouselButtons() {
        const carousels = document.querySelectorAll('.product-image');
        carousels.forEach(container => {
            const prevBtn = container.querySelector('.prev');
            const nextBtn = container.querySelector('.next');
            const imgs = container.querySelectorAll('img');
            
            if (!prevBtn || !nextBtn || imgs.length <= 1) return;
            
            let currentIndex = 0;
            
            prevBtn.addEventListener('click', (e) => {
                e.preventDefault();
                imgs[currentIndex].style.display = 'none';
                imgs[currentIndex].classList.remove('active');
                currentIndex = (currentIndex - 1 + imgs.length) % imgs.length;
                imgs[currentIndex].style.display = 'block';
                imgs[currentIndex].classList.add('active');
            });
            
            nextBtn.addEventListener('click', (e) => {
                e.preventDefault();
                imgs[currentIndex].style.display = 'none';
                imgs[currentIndex].classList.remove('active');
                currentIndex = (currentIndex + 1) % imgs.length;
                imgs[currentIndex].style.display = 'block';
                imgs[currentIndex].classList.add('active');
            });
        });
    }

    function bindFilters() {
        if (filterBtns.length > 0) {
            filterBtns.forEach(btn => {
                btn.addEventListener('click', () => {
                    filterBtns.forEach(b => b.classList.remove('active'));
                    btn.classList.add('active');

                    const filterValue = btn.getAttribute('data-filter');
                    const productCards = document.querySelectorAll('.product-card');

                    productCards.forEach(product => {
                        if (filterValue === 'all' || product.getAttribute('data-category') === filterValue) {
                            product.style.display = 'block';
                            setTimeout(() => {
                                product.style.opacity = '1';
                                product.style.transform = 'translateY(0)';
                            }, 10);
                        } else {
                            product.style.opacity = '0';
                            product.style.transform = 'translateY(20px)';
                            setTimeout(() => {
                                product.style.display = 'none';
                            }, 300);
                        }
                    });
                });
            });
        }
    }

    function bindWhatsAppButtons(btns) {
        btns.forEach(btn => {
            // Remove old listeners by cloning
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);

            newBtn.addEventListener('click', (e) => {
                e.preventDefault();
                const productCard = newBtn.closest('.product-card');
                if (productCard) {
                    const productName = productCard.querySelector('.product-title').innerText;
                    const message = `Hi Nimooh's Closet, I'd like to know more about ${productName}.`;
                    const encodedMessage = encodeURIComponent(message);
                    const waUrl = `https://wa.me/${whatsappNumber}?text=${encodedMessage}`;
                    window.open(waUrl, '_blank');
                } else {
                    window.open(`https://wa.me/${whatsappNumber}?text=Hi Nimooh's Closet, I'd like to make an inquiry.`, '_blank');
                }
            });
        });
    }
});
