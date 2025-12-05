// Sponsor Loader - Lädt aktive Sponsoren und zeigt sie an
document.addEventListener('DOMContentLoaded', function() {
    // Sponsor-Konfiguration (später aus Backend laden)
    const SPONSORS = {
        top: {
            active: false,
            company: '',
            image: '',
            url: ''
        },
        bottom: {
            active: false,
            company: '',
            image: '',
            url: ''
        },
        left: {
            active: false,
            company: '',
            image: '',
            url: ''
        },
        right: {
            active: false,
            company: '',
            image: '',
            url: ''
        }
    };

    // Lade und zeige Sponsoren
    function loadSponsors() {
        Object.keys(SPONSORS).forEach(slot => {
            const sponsor = SPONSORS[slot];
            const container = document.getElementById('sponsor' + capitalizeFirst(slot));
            
            if (!container) return;

            const link = container.querySelector(`#sponsor${capitalizeFirst(slot)}Link`);
            const image = container.querySelector(`#sponsor${capitalizeFirst(slot)}Image`);
            const placeholder = container.querySelector('.sponsor-placeholder');
            
            if (sponsor.active && sponsor.image && sponsor.url) {
                // Sponsor ist aktiv - zeige Sponsor, verstecke Platzhalter
                if (link && image) {
                    link.href = sponsor.url;
                    image.src = sponsor.image;
                    image.alt = sponsor.company;
                    link.style.display = 'block';
                    
                    if (placeholder) {
                        placeholder.style.display = 'none';
                    }
                    
                    // Track View
                    trackSponsorView(slot);
                    
                    // Track Click
                    link.addEventListener('click', function() {
                        trackSponsorClick(slot, sponsor.url);
                    });
                }
            } else {
                // Kein aktiver Sponsor - zeige Platzhalter, verstecke Sponsor
                if (link) {
                    link.style.display = 'none';
                }
                if (placeholder) {
                    placeholder.style.display = 'flex';
                }
            }
        });
    }

    // Tracking-Funktionen
    function trackSponsorView(slot) {
        console.log('📊 Sponsor View:', slot);
        // Hier: API-Call zum Backend für View-Tracking
        // fetch('/api/sponsors/track-view', {
        //     method: 'POST',
        //     body: JSON.stringify({ slot: slot, timestamp: Date.now() })
        // });
    }

    function trackSponsorClick(slot, url) {
        console.log('🖱️ Sponsor Click:', slot, url);
        // Hier: API-Call zum Backend für Click-Tracking
        // fetch('/api/sponsors/track-click', {
        //     method: 'POST',
        //     body: JSON.stringify({ slot: slot, url: url, timestamp: Date.now() })
        // });
    }

    // Helper: Capitalize first letter
    function capitalizeFirst(str) {
        return str.charAt(0).toUpperCase() + str.slice(1);
    }

    // Lade Sponsoren beim Start
    loadSponsors();

    // Optional: Aktualisiere Sponsoren alle 5 Minuten
    setInterval(loadSponsors, 5 * 60 * 1000);
});
