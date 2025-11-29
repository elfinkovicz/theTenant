class AdManager {
    constructor() {
        this.config = window.HonigwabeConfig || {};
        this.adVideo = null;
        this.adCountdown = this.config.advertising?.countdownDuration || 15;
        this.countdownInterval = null;
        this.adSkipped = false;
        this.trackingUrls = this.config.advertising?.tracking || {
            impression: "",
            start: "",
            complete: ""
        };
    }

    init() {
        this.adVideo = document.getElementById('adVideo');
        this.setupSkipButton();
        this.startAd();
    }

    setupSkipButton() {
        const skipBtn = document.getElementById('skipAdBtn');
        if (skipBtn) {
            skipBtn.addEventListener('click', () => this.skipAd());
        }

        // Mute/Unmute Button
        const muteBtn = document.getElementById('muteBtn');
        if (muteBtn && this.adVideo) {
            muteBtn.addEventListener('click', () => {
                this.adVideo.muted = !this.adVideo.muted;
                muteBtn.classList.toggle('unmuted', !this.adVideo.muted);
                
                // Update button title
                muteBtn.title = this.adVideo.muted ? 'Ton einschalten' : 'Ton ausschalten';
                
                console.log(this.adVideo.muted ? '🔇 Ton aus' : '🔊 Ton an');
            });
        }
    }

    startAd() {
        if (!this.adVideo) return;

        // Versuche mit Ton zu starten
        this.adVideo.muted = false;
        this.adVideo.volume = 0.7;
        
        this.adVideo.play().then(() => {
            console.log('🎬 Werbevideo startet mit Ton');
            this.sendTracking('impression');
            this.sendTracking('start');
            this.startCountdown();
        }).catch((error) => {
            console.log('🔇 Autoplay mit Ton blockiert, versuche mit Mute:', error);
            this.adVideo.muted = true;
            this.adVideo.play().then(() => {
                console.log('🎬 Werbevideo startet stumm');
                this.startCountdown();
            }).catch(() => {
                console.log('❌ Autoplay fehlgeschlagen, überspringe Werbung');
                this.skipAd();
            });
        });

        this.adVideo.addEventListener('ended', () => {
            console.log('✅ Werbung beendet');
            this.sendTracking('complete');
            this.skipAd();
        });
    }

    startCountdown() {
        const countdownElement = document.getElementById('countdownTimer');
        
        this.countdownInterval = setInterval(() => {
            this.adCountdown--;
            
            if (countdownElement) {
                countdownElement.textContent = this.adCountdown;
            }

            if (this.adCountdown <= 0) {
                clearInterval(this.countdownInterval);
                this.skipAd();
            }
        }, 1000);
    }

    skipAd() {
        if (this.adSkipped) return;
        
        this.adSkipped = true;
        clearInterval(this.countdownInterval);

        if (this.adVideo) {
            this.adVideo.pause();
        }

        const adContainer = document.getElementById('adContainer');
        const videoContainer = document.getElementById('videoContainer');
        
        if (adContainer) {
            adContainer.style.display = 'none';
        }
        
        if (videoContainer) {
            videoContainer.classList.remove('hidden');
        }

        console.log('🎥 Stream wird geladen...');
        window.dispatchEvent(new CustomEvent('adFinished'));
    }

    sendTracking(event) {
        if (this.trackingUrls[event]) {
            const img = new Image();
            img.src = this.trackingUrls[event];
            console.log(`📊 Tracking gesendet: ${event}`);
        }
    }
}

// Make available globally
window.AdManager = AdManager;
