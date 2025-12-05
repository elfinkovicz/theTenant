document.getElementById('contactForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const formData = {
        name: document.getElementById('name').value,
        email: document.getElementById('email').value,
        subject: document.getElementById('subject').value,
        message: document.getElementById('message').value,
        captcha: document.querySelector('input[name="captcha"]:checked')?.value
    };
    
    // Validate captcha
    if (formData.captcha !== '8') {
        showMessage('error', '❌ Falsche Antwort! 5 + 3 = 8');
        return;
    }
    
    // Validate email
    if (!formData.email || !formData.email.includes('@')) {
        showMessage('error', '❌ Bitte gib eine gültige E-Mail-Adresse ein.');
        return;
    }
    
    // Validate required fields
    if (!formData.subject || !formData.message) {
        showMessage('error', '❌ Bitte fülle alle Pflichtfelder aus.');
        return;
    }
    
    // Here you would normally send to your backend
    // For S3 static hosting, you can integrate with:
    // - AWS SES via API Gateway + Lambda
    // - FormSpree
    // - Netlify Forms
    // - EmailJS
    
    console.log('Form submitted:', formData);
    
    // Simulate success
    showMessage('success', '✅ Danke für deine Nachricht! Wir melden uns bald bei dir.');
    
    // Reset form
    document.getElementById('contactForm').reset();
});

function showMessage(type, text) {
    const successMsg = document.getElementById('formSuccess');
    const errorMsg = document.getElementById('formError');
    
    successMsg.style.display = 'none';
    errorMsg.style.display = 'none';
    
    if (type === 'success') {
        successMsg.textContent = text;
        successMsg.style.display = 'block';
    } else {
        errorMsg.textContent = text;
        errorMsg.style.display = 'block';
    }
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
        successMsg.style.display = 'none';
        errorMsg.style.display = 'none';
    }, 5000);
}
