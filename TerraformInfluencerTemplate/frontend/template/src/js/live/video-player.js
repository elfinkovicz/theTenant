class VideoPlayer {
    constructor() {
        this.config = window.HonigwabeConfig || {};
        this.channel = this.config.stream?.twitchChannel || 'kasperkast';
        this.parentDomain = window.location.hostname || 'localhost';
        this.initialized = false;
    }

    init() {
        // Wait for ad to finish
        window.addEventListener('adFinished', () => {
            this.initializeStream();
        });
    }

    initializeStream() {
        if (this.initialized) return;
        this.initialized = true;

        const videoContainer = document.getElementById('videoContainer');
        if (!videoContainer) return;

        videoContainer.innerHTML = '';

        // Use Twitch embed instead of X/Twitter (X blocks iframe embedding)
        const iframe = document.createElement('iframe');
        iframe.src = `https://player.twitch.tv/?channel=kasperkast&parent=${this.parentDomain}&autoplay=true`;
        iframe.width = '100%';
        iframe.height = '100%';
        iframe.frameBorder = '0';
        iframe.allowFullscreen = true;
        iframe.allow = 'autoplay; fullscreen';

        videoContainer.appendChild(iframe);

        console.log('✅ Twitch Stream initialisiert');
    }
}

// Make available globally
window.VideoPlayer = VideoPlayer;
