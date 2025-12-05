// Sponsor Booking System
document.addEventListener('DOMContentLoaded', function() {
    const modal = document.getElementById('bookingModal');
    const bookButtons = document.querySelectorAll('.book-btn');
    const closeBtn = document.querySelector('.modal-close');
    const cancelBtn = document.querySelector('.cancel-btn');
    const bookingForm = document.getElementById('bookingForm');
    const durationSelect = document.getElementById('bookingDuration');
    
    let currentSlot = null;
    let basePrice = 0;

    // Slot names mapping
    const slotNames = {
        'top': 'Top Banner',
        'bottom': 'Bottom Banner',
        'left': 'Linke Sidebar',
        'right': 'Rechte Sidebar'
    };

    // Open booking modal
    bookButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            currentSlot = this.dataset.slot;
            basePrice = parseInt(this.dataset.price);
            
            document.getElementById('selectedSlot').value = slotNames[currentSlot];
            modal.classList.add('active');
            calculatePrice();
            
            // Set minimum date to tomorrow
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 1);
            document.getElementById('startDate').min = tomorrow.toISOString().split('T')[0];
        });
    });

    // Close modal
    closeBtn.addEventListener('click', () => modal.classList.remove('active'));
    cancelBtn.addEventListener('click', () => modal.classList.remove('active'));
    
    // Close on outside click
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.classList.remove('active');
        }
    });

    // Calculate price on duration change
    durationSelect.addEventListener('change', calculatePrice);

    function calculatePrice() {
        const weeks = parseInt(durationSelect.value);
        const totalBase = basePrice * weeks;
        let discount = 0;
        
        // Apply discounts
        if (weeks === 2) discount = totalBase * 0.10;
        else if (weeks === 4) discount = totalBase * 0.20;
        else if (weeks === 8) discount = totalBase * 0.30;
        
        const total = totalBase - discount;
        
        document.getElementById('basePrice').textContent = totalBase + '€';
        document.getElementById('discount').textContent = discount > 0 ? '-' + discount.toFixed(0) + '€' : '0€';
        document.getElementById('totalPrice').textContent = total.toFixed(0) + '€';
    }

    // Handle form submission
    bookingForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const formData = {
            slot: currentSlot,
            slotName: slotNames[currentSlot],
            duration: durationSelect.value,
            startDate: document.getElementById('startDate').value,
            companyName: document.getElementById('companyName').value,
            targetUrl: document.getElementById('targetUrl').value,
            contactEmail: document.getElementById('contactEmail').value,
            totalPrice: document.getElementById('totalPrice').textContent
        };
        
        // Simulate booking
        console.log('Booking submitted:', formData);
        
        // Show success message
        alert('🍯 Vielen Dank für deine Buchung!\n\n' +
              'Wir haben deine Anfrage erhalten und werden uns innerhalb von 24 Stunden bei dir melden.\n\n' +
              'Details:\n' +
              '- Platz: ' + formData.slotName + '\n' +
              '- Zeitraum: ' + formData.duration + ' Woche(n)\n' +
              '- Preis: ' + formData.totalPrice + '\n\n' +
              'Eine Bestätigung wurde an ' + formData.contactEmail + ' gesendet.');
        
        // Close modal and reset form
        modal.classList.remove('active');
        bookingForm.reset();
    });

    // FAQ Toggle
    const faqItems = document.querySelectorAll('.faq-item');
    faqItems.forEach(item => {
        const question = item.querySelector('.faq-question');
        question.addEventListener('click', () => {
            item.classList.toggle('active');
        });
    });

    // Image preview
    const adImageInput = document.getElementById('adImage');
    adImageInput.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = function(e) {
                console.log('Image loaded:', file.name);
            };
            reader.readAsDataURL(file);
        }
    });
});
