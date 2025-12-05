class Chat {
    constructor() {
        this.messages = document.getElementById('messages');
        this.chatInput = document.getElementById('chatInput');
        this.sendBtn = document.getElementById('sendBtn');
        this.currentUser = this.getCurrentUser();
        this.activePoll = null;
        this.config = window.HonigwabeConfig || {};
        this.demoMessages = this.config.chat?.demoMessages || [
            { username: 'Kasper', message: 'Hallo zusammen! Lasst ordentlich Barne da 🐝', delay: 2000, role: 'admin' },
            { username: 'Zertifikatsmaurer Aron Pielka', message: 'Freue mich auf den Stream! Kauft mein Buch ihr Kufar', delay: 4000, role: 'member' },
            { username: 'Heidi Reichineck', message: 'Faschisten!! Ich werde diesen Stream melden', delay: 6000 },
            { username: 'DerArchitekt', message: 'Ich hoffe der Stream scheisst nicht ab 🍯', delay: 8000, role: 'member' },
            { username: 'MontanaBlack', message: 'Kuss Digga! ❤️', delay: 10000 }
        ];
    }

    getCurrentUser() {
        const localUser = localStorage.getItem('honigwabe_user');
        const sessionUser = sessionStorage.getItem('honigwabe_user');
        
        if (localUser) return JSON.parse(localUser);
        if (sessionUser) return JSON.parse(sessionUser);
        
        return null;
    }

    init() {
        if (!this.messages || !this.chatInput || !this.sendBtn) {
            console.error('Chat-Elemente nicht gefunden');
            return;
        }

        this.setupEventListeners();
        this.startDemoMessages();
        this.addMessage('System', 'Willkommen im Honigwabe Live Chat! 🍯', true);
        
        // Show login prompt if not logged in
        if (!this.currentUser) {
            this.showLoginPrompt();
        } else {
            this.addMessage('System', `Willkommen zurück, ${this.currentUser.username}! 🐝`, true);
            
            // Show admin controls if admin
            if (this.currentUser.role === 'admin') {
                this.showAdminControls();
            }
        }
    }

    setupEventListeners() {
        // Send Button
        this.sendBtn.addEventListener('click', () => {
            this.sendMessage();
        });

        // Enter Key
        this.chatInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                this.sendMessage();
            }
        });
    }

    sendMessage() {
        const message = this.chatInput.value.trim();
        if (message) {
            this.addMessage('Du', message);
            this.chatInput.value = '';
            
            // Simulate response
            setTimeout(() => {
                this.addRandomResponse(message);
            }, 1000 + Math.random() * 2000);
        }
    }

    addMessage(username, message, isSystem = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = isSystem ? 'message system' : 'message';
        messageDiv.innerHTML = `<span class="username">${username}:</span> ${message}`;
        
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    addRandomResponse(originalMessage) {
        const responses = [
            '👍 Stimmt!',
            '😂 Haha, genau!',
            '🐝 Buzzz!',
            '🍯 Sweet!',
            'Das sehe ich auch so!',
            'Interessant! 🤔',
            '💯 Absolut richtig!',
            '🎵 Gute Musik heute!',
            'Kuss geht raus! ❤️',
            'Barne! 🐝'
        ];
        
        const randomResponse = responses[Math.floor(Math.random() * responses.length)];
        const randomUser = `User${Math.floor(Math.random() * 999) + 1}`;
        
        this.addMessage(randomUser, randomResponse);
    }

    startDemoMessages() {
        this.demoMessages.forEach(({ username, message, delay }) => {
            setTimeout(() => {
                this.addMessage(username, message);
            }, delay);
        });
    }
}

// Make available globally
window.Chat = Chat;


    showLoginPrompt() {
        const loginPrompt = document.createElement('div');
        loginPrompt.className = 'chat-login-prompt';
        loginPrompt.innerHTML = `
            <div class="login-prompt-content">
                <i class="fas fa-lock" style="font-size: 2rem; color: var(--honey-gold); margin-bottom: 1rem;"></i>
                <p>Melde dich an, um am Chat teilzunehmen!</p>
                <a href="login.html" class="btn btn-primary" style="margin-top: 1rem;">
                    <i class="fas fa-sign-in-alt"></i> Jetzt anmelden
                </a>
                <a href="register.html" class="btn btn-secondary" style="margin-top: 0.5rem;">
                    <i class="fas fa-user-plus"></i> Registrieren
                </a>
            </div>
        `;
        
        const inputArea = document.getElementById('inputArea');
        if (inputArea) {
            inputArea.style.display = 'none';
            inputArea.parentNode.insertBefore(loginPrompt, inputArea);
        }
    }

    showAdminControls() {
        const adminPanel = document.createElement('div');
        adminPanel.className = 'admin-panel';
        adminPanel.innerHTML = `
            <button class="admin-btn" onclick="window.chat.createPoll()">
                <i class="fas fa-poll"></i> Umfrage erstellen
            </button>
            <button class="admin-btn" onclick="window.chat.clearChat()">
                <i class="fas fa-trash"></i> Chat leeren
            </button>
        `;
        
        const chatHeader = document.querySelector('.chat-header');
        if (chatHeader) {
            chatHeader.appendChild(adminPanel);
        }
    }

    createPoll() {
        if (this.activePoll) {
            alert('Es läuft bereits eine Umfrage!');
            return;
        }

        const question = prompt('Umfrage-Frage:');
        if (!question) return;

        const optionsStr = prompt('Antwortmöglichkeiten (kommagetrennt):');
        if (!optionsStr) return;

        const options = optionsStr.split(',').map(o => o.trim()).filter(o => o);
        if (options.length < 2) {
            alert('Mindestens 2 Antwortmöglichkeiten erforderlich!');
            return;
        }

        this.activePoll = {
            question,
            options: options.map(opt => ({ text: opt, votes: 0 })),
            voters: new Set()
        };

        this.displayPoll();
    }

    displayPoll() {
        // Remove existing poll
        const existingPoll = document.querySelector('.poll-container');
        if (existingPoll) existingPoll.remove();

        const pollContainer = document.createElement('div');
        pollContainer.className = 'poll-container';
        
        let optionsHTML = '';
        this.activePoll.options.forEach((option, index) => {
            const percentage = this.activePoll.voters.size > 0 
                ? Math.round((option.votes / this.activePoll.voters.size) * 100) 
                : 0;
            
            optionsHTML += `
                <div class="poll-option" onclick="window.chat.vote(${index})">
                    <div class="poll-option-text">${option.text}</div>
                    <div class="poll-option-bar">
                        <div class="poll-option-fill" style="width: ${percentage}%"></div>
                    </div>
                    <div class="poll-option-votes">${option.votes} Stimmen (${percentage}%)</div>
                </div>
            `;
        });

        pollContainer.innerHTML = `
            <div class="poll-header">
                <i class="fas fa-poll"></i>
                <span>Umfrage</span>
                ${this.currentUser && this.currentUser.role === 'admin' ? 
                    '<button class="poll-close" onclick="window.chat.closePoll()"><i class="fas fa-times"></i></button>' : 
                    ''}
            </div>
            <div class="poll-question">${this.activePoll.question}</div>
            <div class="poll-options">
                ${optionsHTML}
            </div>
            <div class="poll-footer">
                Gesamt: ${this.activePoll.voters.size} Stimmen
            </div>
        `;

        const chatSection = document.querySelector('.chat-section');
        if (chatSection) {
            chatSection.insertBefore(pollContainer, chatSection.firstChild);
        }
    }

    vote(optionIndex) {
        if (!this.currentUser) {
            alert('Bitte melde dich an, um abzustimmen!');
            return;
        }

        if (this.activePoll.voters.has(this.currentUser.id)) {
            alert('Du hast bereits abgestimmt!');
            return;
        }

        this.activePoll.options[optionIndex].votes++;
        this.activePoll.voters.add(this.currentUser.id);
        
        this.displayPoll();
        this.addMessage('System', `${this.currentUser.username} hat abgestimmt! 🗳️`, true);
    }

    closePoll() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;

        const pollContainer = document.querySelector('.poll-container');
        if (pollContainer) {
            pollContainer.remove();
        }

        this.addMessage('System', 'Umfrage wurde beendet! 📊', true);
        this.activePoll = null;
    }

    clearChat() {
        if (!this.currentUser || this.currentUser.role !== 'admin') return;

        if (confirm('Chat wirklich leeren?')) {
            this.messages.innerHTML = '';
            this.addMessage('System', 'Chat wurde geleert! 🧹', true);
        }
    }

    addMessage(username, message, isSystem = false) {
        const messageDiv = document.createElement('div');
        
        // Determine user role
        let role = null;
        if (this.currentUser && username === this.currentUser.username) {
            role = this.currentUser.role;
        } else {
            // Check demo messages for role
            const demoMsg = this.demoMessages.find(m => m.username === username);
            if (demoMsg) role = demoMsg.role;
        }
        
        messageDiv.className = isSystem ? 'message system' : 'message';
        
        if (role === 'admin') {
            messageDiv.classList.add('admin-message');
        } else if (role === 'member') {
            messageDiv.classList.add('member-message');
        }
        
        let badge = '';
        if (role === 'admin') {
            badge = '<span class="user-badge admin-badge"><i class="fas fa-crown"></i> Admin</span>';
        } else if (role === 'member') {
            badge = '<span class="user-badge member-badge"><i class="fas fa-star"></i> Mitglied</span>';
        }
        
        messageDiv.innerHTML = `<span class="username">${username}:</span>${badge} ${message}`;
        
        this.messages.appendChild(messageDiv);
        this.messages.scrollTop = this.messages.scrollHeight;
    }

    sendMessage() {
        if (!this.currentUser) {
            alert('Bitte melde dich an, um zu chatten!');
            return;
        }

        const message = this.chatInput.value.trim();
        if (message) {
            this.addMessage(this.currentUser.username, message);
            this.chatInput.value = '';
            
            // Simulate response
            setTimeout(() => {
                this.addRandomResponse(message);
            }, 1000 + Math.random() * 2000);
        }
    }
}

// Make chat available globally
window.Chat = Chat;
window.chat = null; // Will be initialized by app.js
