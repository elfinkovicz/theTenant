// Authentication System
class AuthSystem {
    constructor() {
        this.config = window.HonigwabeConfig || {};
        this.apiEndpoint = this.config.api?.endpoint || 'YOUR_API_GATEWAY_URL';
        this.currentUser = null;
        this.init();
    }

    init() {
        // Check if user is logged in
        this.currentUser = this.getStoredUser();
        
        // Setup form handlers
        const loginForm = document.getElementById('loginForm');
        const registerForm = document.getElementById('registerForm');
        
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }
        
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const username = document.getElementById('registerUsername').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;
        const passwordConfirm = document.getElementById('registerPasswordConfirm').value;
        const acceptTerms = document.getElementById('acceptTerms').checked;
        
        // Validation
        if (!this.validateUsername(username)) {
            this.showMessage('error', 'Benutzername ungültig. Nur Buchstaben, Zahlen und _ erlaubt.');
            return;
        }
        
        if (password !== passwordConfirm) {
            this.showMessage('error', 'Passwörter stimmen nicht überein.');
            return;
        }
        
        if (!acceptTerms) {
            this.showMessage('error', 'Bitte akzeptiere die Datenschutzerklärung.');
            return;
        }
        
        this.showMessage('info', 'Account wird erstellt...');
        
        try {
            // For demo: Store locally (in production: call API)
            const user = {
                id: this.generateId(),
                username: username,
                email: email,
                role: 'member',
                createdAt: new Date().toISOString(),
                verified: false
            };
            
            // Store password hash (in production: done server-side)
            const passwordHash = await this.hashPassword(password);
            
            // Save to localStorage (in production: API call)
            localStorage.setItem(`user_${email}`, JSON.stringify({
                ...user,
                passwordHash
            }));
            
            this.showMessage('success', 'Account erfolgreich erstellt! Du wirst weitergeleitet...');
            
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            
        } catch (error) {
            console.error('Registration error:', error);
            this.showMessage('error', 'Fehler bei der Registrierung. Bitte versuche es erneut.');
        }
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const rememberMe = document.getElementById('rememberMe').checked;
        
        this.showMessage('info', 'Anmeldung läuft...');
        
        try {
            // For demo: Check localStorage (in production: API call)
            const storedUser = localStorage.getItem(`user_${email}`);
            
            if (!storedUser) {
                this.showMessage('error', 'E-Mail oder Passwort falsch.');
                return;
            }
            
            const userData = JSON.parse(storedUser);
            const passwordHash = await this.hashPassword(password);
            
            if (passwordHash !== userData.passwordHash) {
                this.showMessage('error', 'E-Mail oder Passwort falsch.');
                return;
            }
            
            // Login successful
            const user = {
                id: userData.id,
                username: userData.username,
                email: userData.email,
                role: userData.role,
                verified: userData.verified
            };
            
            // Store session
            if (rememberMe) {
                localStorage.setItem('honigwabe_user', JSON.stringify(user));
            } else {
                sessionStorage.setItem('honigwabe_user', JSON.stringify(user));
            }
            
            this.showMessage('success', 'Erfolgreich angemeldet! Du wirst weitergeleitet...');
            
            setTimeout(() => {
                window.location.href = 'live.html';
            }, 1500);
            
        } catch (error) {
            console.error('Login error:', error);
            this.showMessage('error', 'Fehler bei der Anmeldung. Bitte versuche es erneut.');
        }
    }

    validateUsername(username) {
        const config = this.config.auth?.username || { minLength: 3, maxLength: 20, pattern: /^[a-zA-Z0-9_]+$/ };
        
        if (username.length < config.minLength || username.length > config.maxLength) {
            return false;
        }
        
        return config.pattern.test(username);
    }

    async hashPassword(password) {
        // Simple hash for demo (in production: use bcrypt server-side)
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }

    generateId() {
        return 'user_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
    }

    getStoredUser() {
        const localUser = localStorage.getItem('honigwabe_user');
        const sessionUser = sessionStorage.getItem('honigwabe_user');
        
        if (localUser) return JSON.parse(localUser);
        if (sessionUser) return JSON.parse(sessionUser);
        
        return null;
    }

    logout() {
        localStorage.removeItem('honigwabe_user');
        sessionStorage.removeItem('honigwabe_user');
        window.location.href = 'index.html';
    }

    showMessage(type, message) {
        const messageEl = document.getElementById('authMessage');
        if (!messageEl) return;
        
        messageEl.className = `auth-message ${type}`;
        messageEl.textContent = message;
        messageEl.style.display = 'block';
        
        if (type === 'success' || type === 'error') {
            setTimeout(() => {
                messageEl.style.display = 'none';
            }, 5000);
        }
    }
}

// Initialize
const authSystem = new AuthSystem();
window.authSystem = authSystem;
