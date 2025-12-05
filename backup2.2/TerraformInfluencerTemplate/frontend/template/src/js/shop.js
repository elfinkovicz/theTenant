let cart = [];

// Category Filter
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        // Remove active class from all buttons
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        
        // Add active class to clicked button
        this.classList.add('active');
        
        const category = this.dataset.category;
        const products = document.querySelectorAll('.product-card');
        
        products.forEach(product => {
            if (category === 'all' || product.dataset.category === category) {
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

// Add to Cart
document.querySelectorAll('.product-btn').forEach(btn => {
    btn.addEventListener('click', function() {
        const card = this.closest('.product-card');
        const title = card.querySelector('.product-title').textContent;
        const price = card.querySelector('.product-price').textContent;
        
        cart.push({ title, price });
        updateCart();
        
        // Visual feedback
        this.textContent = '✓ Hinzugefügt!';
        this.style.background = '#4CAF50';
        
        setTimeout(() => {
            this.textContent = 'In den Warenkorb';
            this.style.background = '';
        }, 2000);
    });
});

function updateCart() {
    const cartPreview = document.getElementById('cartPreview');
    const cartCount = document.getElementById('cartCount');
    
    if (cart.length > 0) {
        cartPreview.style.display = 'block';
        cartCount.textContent = `${cart.length} Artikel`;
    } else {
        cartPreview.style.display = 'none';
    }
}

// Initialize product animations
document.querySelectorAll('.product-card').forEach((card, index) => {
    card.style.opacity = '0';
    card.style.transform = 'translateY(30px)';
    card.style.transition = 'all 0.6s ease';
    
    setTimeout(() => {
        card.style.opacity = '1';
        card.style.transform = 'translateY(0)';
    }, index * 100);
});
