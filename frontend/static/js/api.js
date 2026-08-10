/**
 * API Wrapper and SSE Listener
 */
const API_BASE = '/api';

window.HomeAPI = {
    getToken() {
        return localStorage.getItem('authToken');
    },
    
    setToken(token) {
        if (token) {
            localStorage.setItem('authToken', token);
            document.cookie = `authToken=${token}; path=/; max-age=31536000`; // Set cookie for 1 year
        } else {
            localStorage.removeItem('authToken');
            document.cookie = `authToken=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`; // Clear cookie
        }
    },
    
    // Core fetch wrapper
    async fetch(endpoint, options = {}) {
        const token = this.getToken();
        if (!options.headers) options.headers = {};
        if (token) {
            options.headers['Authorization'] = `Bearer ${token}`;
        }
        
        const res = await fetch(`${API_BASE}${endpoint}`, options);
        if (res.status === 401 && !window.location.pathname.includes('/login')) {
            this.setToken(null);
            window.location.href = '/login' + window.location.search;
        }
        return res;
    },

    async register(data) {
        try {
            const res = await fetch(`${API_BASE}/auth/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            return await res.json();
        } catch (e) {
            return { error: 'Connection failed' };
        }
    },
    
    async login(username, password) {
        try {
            const res = await fetch(`${API_BASE}/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: username, password })
            });
            return await res.json();
        } catch (e) {
            return { error: 'Connection failed' };
        }
    },
    
    async getMe() {
        try {
            const res = await this.fetch('/auth/me');
            if (res.ok) return await res.json();
            return null;
        } catch (e) {
            return null;
        }
    },

    async getTasks() {
        try {
            const res = await this.fetch('/tasks');
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch tasks", e);
            return [];
        }
    },
    
    async saveTask(taskData) {
        try {
            const res = await this.fetch('/tasks', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(taskData)
            });
            return await res.json();
        } catch (e) {
            console.error("Failed to save task", e);
            return null;
        }
    },
    
    async deleteTask(taskId) {
        try {
            const res = await this.fetch(`/tasks/${taskId}`, { method: 'DELETE' });
            return await res.json();
        } catch (e) {
            console.error("Failed to delete task", e);
        }
    },

    async getMeals() {
        try {
            const res = await this.fetch('/meals');
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch meals", e);
            return {};
        }
    },

    async saveMeals(mealsData) {
        try {
            const res = await this.fetch('/meals', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(mealsData)
            });
            return await res.json();
        } catch (e) {
            console.error("Failed to save meals", e);
            return null;
        }
    },

    async getRecipes() {
        try {
            const res = await this.fetch('/recipes');
            return await res.json();
        } catch (e) {
            console.error("Failed to fetch recipes", e);
            return [];
        }
    },

    async saveRecipes(recipes) {
        try {
            return await this.fetch('/recipes', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(recipes)
            });
        } catch (e) {
            console.error('Error saving recipes:', e);
            return null;
        }
    },

    async createHome(homeName) {
        try {
            const res = await this.fetch('/auth/create_home', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ home_name: homeName })
            });
            return await res.json();
        } catch (e) {
            console.error("Failed to create home", e);
            return { error: 'Network error' };
        }
    },

    async joinHome(joinCode) {
        try {
            const res = await this.fetch('/auth/join_home', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ join_code: joinCode })
            });
            return await res.json();
        } catch (e) {
            console.error("Failed to join home", e);
            return { error: 'Network error' };
        }
    },
    
    async completeTask(taskId, dateStr = null) {
        try {
            const body = dateStr ? JSON.stringify({ date: dateStr }) : '{}';
            const res = await this.fetch(`/tasks/${taskId}/complete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            return await res.json();
        } catch (e) {
            console.error('Error completing task:', e);
            return null;
        }
    },

    async incompleteTask(taskId, dateStr = null) {
        try {
            const body = dateStr ? JSON.stringify({ date: dateStr }) : '{}';
            const res = await this.fetch(`/tasks/${taskId}/incomplete`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: body
            });
            return await res.json();
        } catch (e) {
            console.error('Error incompleting task:', e);
            return null;
        }
    },
    
    async getCompletions() {
        try {
            const res = await this.fetch('/completions');
            if (res.ok) return await res.json();
            return [];
        } catch (e) {
            console.error('Error fetching completions:', e);
            return [];
        }
    },

    async getNotifications() {
        try {
            const res = await this.fetch('/notifications');
            if (res.ok) return await res.json();
            return { notifications: [], unread_count: 0 };
        } catch (e) {
            return { notifications: [], unread_count: 0 };
        }
    },

    async markNotificationRead(notifId) {
        try {
            await this.fetch(`/notifications/${notifId}/read`, { method: 'POST' });
        } catch (e) {}
    },

    async markAllNotificationsRead() {
        try {
            await this.fetch('/notifications/read-all', { method: 'POST' });
        } catch (e) {}
    },

    initSSE() {
        if (this._evtSource) return;
        const token = this.getToken();
        if (!token || !window.me || !window.me.home) return;
        this._evtSource = new EventSource(`${API_BASE}/stream?token=${token}`);
        
        this._evtSource.onmessage = (event) => {
            // Note: Flask yields events with custom names or generic 'message'
            // We use generic onmessage but could parse custom event types if implemented.
            // For now, if we get any message, we can just trigger a full app refresh.
            // A more optimized way is to parse event.type and event.data.
            try {
                // If it's a generic message, just refresh dashboard and calendar
                if (window.renderPriorityCards) window.renderPriorityCards();
                if (window.AgendaWidget && typeof window.AgendaWidget.refresh === 'function') {
                    window.AgendaWidget.refresh();
                }
                if (window.initMealPlanner) window.initMealPlanner();
            } catch (e) {
                console.error("Error processing SSE message", e);
            }
        };

        this._evtSource.addEventListener('tasks_updated', (e) => {
            console.log("Tasks updated via SSE", e.data);
            if (window.refreshAllData) window.refreshAllData();
        });
        
        this._evtSource.addEventListener('meals_updated', (e) => {
            console.log("Meals updated via SSE", e.data);
            if (window.refreshAllData) window.refreshAllData();
        });

        this._evtSource.addEventListener('recipes_updated', (e) => {
            console.log("Recipes updated via SSE", e.data);
            if (window.refreshAllData) window.refreshAllData();
        });

        this._evtSource.addEventListener('notifications_updated', (e) => {
            console.log("Notifications updated via SSE");
            if (window.refreshNotifications) window.refreshNotifications();
        });

        this._evtSource.onerror = (err) => {
            console.error("SSE Error:", err);
        };
    }
};

// Global data refresh handler (called by SSE or initial load)
window.refreshAllData = async function() {
    console.log("[Auth Debug] refreshAllData started. Current URL:", window.location.href);
    const urlParams = new URLSearchParams(window.location.search);
    
    // Check if a token was passed in the URL (e.g. from Google OAuth)
    const urlToken = urlParams.get('token');
    if (urlToken) {
        console.log("[Auth Debug] Token found in URL, saving to localStorage...");
        window.HomeAPI.setToken(urlToken);
        // Remove the token from the URL for security and clean appearance
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        console.log("[Auth Debug] URL token saved and cleared from address bar.");
    }

    const currentToken = window.HomeAPI.getToken();
    console.log("[Auth Debug] Current localStorage token:", currentToken ? "Exists (length: " + currentToken.length + ")" : "NULL");

    // If not authenticated, redirect to login
    if (!currentToken && !window.location.pathname.includes('/login')) {
        console.warn("[Auth Debug] User is NOT authenticated! Redirecting to login page...");
        window.location.href = '/login' + window.location.search;
        return;
    }
    
    console.log("[Auth Debug] User is authenticated, proceeding to load data...");
    
    // Fetch Me to ensure we are logged in and get user data
    
    // Check for join parameter and attempt auto-join
    const joinCode = urlParams.get('join');
    if (joinCode && window.HomeAPI.getToken()) {
        // Strip from URL immediately to prevent loop
        const newUrl = window.location.pathname;
        window.history.replaceState({}, document.title, newUrl);
        
        if (window.showConfirmInviteModal) {
            window.showConfirmInviteModal(joinCode);
        } else {
            console.error('showConfirmInviteModal not loaded');
        }
    }
    
    const me = await window.HomeAPI.getMe();
    if (me) {
        window.me = me;
        window.HomeAPI.initSSE(); // Initialize SSE now that we have user info
        localStorage.setItem('currentUser', JSON.stringify(me.user));
        localStorage.setItem('currentHome', JSON.stringify(me.home));
        
        // Update UI headers if they exist
        const nameToUse = me.user.display_name || me.user.username;
        if (window.WelcomeManager) {
            window.WelcomeManager.injectScientificBanner(nameToUse);
        } else {
            const welcomeText = document.querySelector('.welcome-text h1');
            if (welcomeText) {
                welcomeText.innerHTML = `Good morning, ${nameToUse}! ✨`;
            }
        }
        
        // Update top-right header profile
        const headerUsername = document.getElementById('headerUsername');
        if (headerUsername) headerUsername.textContent = me.user.display_name || me.user.username;
        
        // Update all profile images on the page
        if (me.user.avatar) {
            const profileImgs = document.querySelectorAll('.user-profile img');
            profileImgs.forEach(img => {
                img.src = me.user.avatar;
                img.style.display = 'inline-block';
            });
        }
        
        // Render Members list dynamically
        const membersList = document.getElementById('realMembersList');
        if (membersList && me.home && me.home.members) {
            membersList.innerHTML = '';
            
            // Sort members by points (descending)
            const sortedMembers = [...me.home.members].sort((a, b) => (b.points || 0) - (a.points || 0));
            
            sortedMembers.forEach((member, index) => {
                const defaultAvatar = 'https://ui-avatars.com/api/?name=' + encodeURIComponent(member.display_name || member.username) + '&background=random';
                const avatarUrl = member.avatar || defaultAvatar;
                
                const points = member.points || 0;
                // Give a star to the 1st place if they have more than 0 points
                const star = (index === 0 && points > 0) ? ' ⭐️' : '';
                
                const memberEl = document.createElement('div');
                memberEl.className = 'member';
                memberEl.innerHTML = `
                    <img src="${avatarUrl}" alt="${member.username}">
                    <span class="name">${member.username}</span>
                    <span class="role points">${points} pts${star}</span>
                `;
                membersList.appendChild(memberEl);
            });
            
            // Also populate the Assignee Picker in the task modal
            const assigneePicker = document.getElementById('taskAssigneePicker');
            if (assigneePicker) {
                assigneePicker.innerHTML = '';
                
                sortedMembers.forEach((member, index) => {
                    const initial = member.username.charAt(0).toUpperCase();
                    const avatarHTML = member.avatar 
                        ? `<img src="${member.avatar}" alt="${member.username}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">`
                        : `<div class="assignee-avatar" style="width:40px; height:40px; border-radius:50%; background:var(--primary-purple); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold;">${initial}</div>`;
                        
                    // Select the first member by default just so it's not totally empty
                    const selectedClass = index === 0 ? 'selected' : '';
                        
                    assigneePicker.innerHTML += `
                        <div class="assignee-option ${selectedClass}" data-user="${member.username}">
                            ${avatarHTML}
                            <span>${member.username}</span>
                        </div>
                    `;
                });
            }
        }
    }
    
    // 1. Fetch fresh data from backend
    const [tasks, meals, recipes, completions] = await Promise.all([
        window.HomeAPI.getTasks(),
        window.HomeAPI.getMeals(),
        window.HomeAPI.getRecipes(),
        window.HomeAPI.getCompletions()
    ]);
    
    // 2. Cache locally for components that expect synchronous read
    if (Array.isArray(tasks)) localStorage.setItem('scheduledTasks', JSON.stringify(tasks));
    if (meals && !meals.error) localStorage.setItem('homeMeals', JSON.stringify(meals));
    if (Array.isArray(recipes)) localStorage.setItem('homeRecipes', JSON.stringify(recipes));
    if (Array.isArray(completions)) localStorage.setItem('taskCompletions', JSON.stringify(completions));
    
    // 3. Trigger UI renders
    if (window.renderPriorityCards) window.renderPriorityCards();
    if (window.loadFacilitiesToDashboard) window.loadFacilitiesToDashboard();
    if (window.AgendaWidget && typeof window.AgendaWidget.refresh === 'function') {
        window.AgendaWidget.refresh();
    }
    if (window.initMealPlanner) window.initMealPlanner();
};

document.addEventListener('DOMContentLoaded', () => {
    // Only init data if not on login page
    if (!window.location.pathname.includes('/login')) {
        window.refreshAllData();
    }
});
