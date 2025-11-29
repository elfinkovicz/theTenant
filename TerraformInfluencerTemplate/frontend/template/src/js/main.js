/**
 * Main JavaScript for Creator Platform
 */

// Countdown Timer
function updateCountdown() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const currentHour = now.getHours();
    
    let nextStream = new Date(now);
    
    // Wenn heute Sonntag ist und es noch nicht 18:00 ist
    if (dayOfWeek === 0 && currentHour < 18) {
        nextStream.setHours(18, 0, 0, 0);
    } else {
        // Nächsten Sonntag finden
        const daysUntilSunday = (7 - dayOfWeek) % 7 || 7;
        nextStream.setDate(now.getDate() + daysUntilSunday);
        nextStream.setHours(18, 0, 0, 0);
    }
    
    const diff = nextStream - now;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);
    
    const daysEl = document.getElementById('days');
    const hoursEl = document.getElementById('hours');
    const minutesEl = document.getElementById('minutes');
    const secondsEl = document.getElementById('seconds');
    
    if (daysEl) daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = hours;
    if (minutesEl) minutesEl.textContent = minutes;
    if (secondsEl) secondsEl.textContent = seconds;
}

// Mobile Menu Toggle
function initMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const nav = document.querySelector('.nav');
    
    if (mobileMenuBtn && nav) {
        mobileMenuBtn.addEventListener('click', () => {
            nav.classList.toggle('active');
        });
    }
}

// Animated Elements (Sparkles/Particles)
function createAnimatedElement() {
    const container = document.getElementById('animated-container');
    if (!container) return;
    
    const element = document.createElement('div');
    element.className = 'animated-element';
    element.style.left = Math.random() * 100 + '%';
    element.style.animationDuration = (Math.random() * 10 + 10) + 's';
    element.style.animationDelay = Math.random() * 5 + 's';
    element.innerHTML = '✨';
    
    container.appendChild(element);
    
    // Remove after animation
    setTimeout(() => {
        element.remove();
    }, 20000);
}

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Start countdown
    if (document.getElementById('countdown')) {
        updateCountdown();
        setInterval(updateCountdown, 1000);
    }
    
    // Initialize mobile menu
    initMobileMenu();
    
    // Create animated elements
    for (let i = 0; i < 5; i++) {
        setTimeout(() => createAnimatedElement(), i * 2000);
    }
    
    // Recreate animated elements periodically
    setInterval(() => {
        if (document.querySelectorAll('.animated-element').length < 5) {
            createAnimatedElement();
        }
    }, 5000);
    
    console.log('✅ Creator Platform loaded');
});

// Add CSS for animated elements
const style = document.createElement('style');
style.textContent = `
    #animated-container {
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        pointer-events: none;
        z-index: 0;
        overflow: hidden;
    }
    
    .animated-element {
        position: absolute;
        font-size: 2rem;
        animation: float-up linear infinite;
        opacity: 0.6;
    }
    
    @keyframes float-up {
        0% {
            transform: translateY(100vh) rotate(0deg);
            opacity: 0;
        }
        10% {
            opacity: 0.6;
        }
        90% {
            opacity: 0.6;
        }
        100% {
            transform: translateY(-100px) rotate(360deg);
            opacity: 0;
        }
    }
    
    .nav.active {
        display: flex;
        flex-direction: column;
        position: absolute;
        top: 100%;
        left: 0;
        right: 0;
        background: rgba(17, 17, 17, 0.98);
        padding: 1rem;
        border-top: 2px solid rgba(255, 196, 0, 0.3);
    }
    
    @media (min-width: 769px) {
        .nav.active {
            display: flex;
            flex-direction: row;
            position: static;
            background: none;
            padding: 0;
            border: none;
        }
    }
`;
document.head.appendChild(style);
