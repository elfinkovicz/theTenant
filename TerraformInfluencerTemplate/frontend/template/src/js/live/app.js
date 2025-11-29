// Main Live Stream Application
class HonigwabeLiveApp {
    constructor() {
        this.adManager = null;
        this.videoPlayer = null;
        this.chat = null;
    }

    init() {
        console.log('🍯 Honigwabe Live wird geladen...');
        
        // Initialize components
        this.adManager = new AdManager();
        this.videoPlayer = new VideoPlayer();
        this.chat = new Chat();
        
        // Make chat globally available for admin functions
        window.chat = this.chat;
        
        this.adManager.init();
        this.videoPlayer.init();
        this.chat.init();
        
        // Setup donate button
        this.setupDonateButton();
        
        console.log('✅ Honigwabe Live bereit!');
    }

    setupDonateButton() {
        const donateBtn = document.querySelector('.donate-btn');
        if (!donateBtn) return;

        donateBtn.addEventListener('click', () => {
            const config = window.HonigwabeConfig || {};
            const donateUrl = config.donations?.streamlabs || 'https://streamlabs.com/katzenspainfullhd/tip';
            window.open(donateUrl, '_blank');
            
            // Add feedback
            const originalText = donateBtn.textContent;
            donateBtn.textContent = '🍯 Danke für deine Unterstützung!';
            donateBtn.style.transform = 'scale(1.1)';
            
            setTimeout(() => {
                donateBtn.textContent = originalText;
                donateBtn.style.transform = '';
            }, 2000);
        });
    }
}

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    const app = new HonigwabeLiveApp();
    app.init();
});
