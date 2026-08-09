/**
 * WelcomeManager - Engagement Module
 * Scientifically designed to increase user retention via the Hook Model and Zeigarnik Effect.
 */

window.WelcomeManager = class WelcomeManager {
    static HISTORY_KEY = 'welcome_message_history';
    static MAX_HISTORY = 7; // Remember the last 7 messages

    static getHistory() {
        try {
            return JSON.parse(localStorage.getItem(this.HISTORY_KEY) || '[]');
        } catch (e) {
            return [];
        }
    }

    static addToHistory(messageId) {
        let history = this.getHistory();
        history.push(messageId);
        if (history.length > this.MAX_HISTORY) {
            history.shift(); // Keep only the last N items
        }
        localStorage.setItem(this.HISTORY_KEY, JSON.stringify(history));
    }

    static async injectScientificBanner(username) {
        const welcomeText = document.querySelector('.welcome-text h1');
        const subtitle = document.querySelector('.welcome-text p');
        
        if (!welcomeText || !subtitle) return;

        const hour = new Date().getHours();
        const isWeekend = [0, 6].includes(new Date().getDay());
        
        let greeting = 'Good morning';
        let emoji = '☕️';
        let timeCategory = 'morning';

        // 1. Determine Time Context
        if (hour >= 12 && hour < 17) {
            greeting = 'Good afternoon';
            emoji = '☀️';
            timeCategory = 'afternoon';
        } else if (hour >= 17 && hour < 22) {
            greeting = 'Good evening';
            emoji = '🌇';
            timeCategory = 'evening';
        } else if (hour >= 22 || hour < 5) {
            greeting = 'Up late';
            emoji = '🦉'; // Cute owl for late night
            timeCategory = 'night';
        }

        // 2. Fetch Live Tasks (Zeigarnik Effect)
        let incompleteTasksCount = 0;
        try {
            if (window.HomeAPI && typeof window.HomeAPI.getTasks === 'function') {
                const tasks = await window.HomeAPI.getTasks();
                const completions = JSON.parse(localStorage.getItem('homeCompletions') || '{}');
                
                // Very basic heuristic: count tasks that are not completed today
                const today = new Date().toISOString().split('T')[0];
                const todaysCompletions = completions[today] || [];
                incompleteTasksCount = tasks.length - todaysCompletions.length;
                if (incompleteTasksCount < 0) incompleteTasksCount = 0;
            }
        } catch (e) {
            console.log("Could not fetch tasks for Zeigarnik nudge", e);
        }

        // 3. Categorized Pools
        const pools = {
            'morning': [
                { id: 'm1', text: "A fresh start! What’s the most important thing to tackle today?" },
                { id: 'm2', text: "Coffee first, conquering the world second. ☕️" },
                { id: 'm3', text: "Your home missed you while you were asleep! Let's make it shine." },
                { id: 'm4', text: "Rise and shine! The early bird catches the... clean house?" },
                { id: 'm5', text: "Start where you are. Use what you have. Do what you can. 🌟" }
            ],
            'afternoon': [
                { id: 'a1', text: "Halfway there! Take a deep breath and keep the momentum going." },
                { id: 'a2', text: "Afternoon slump? A quick 5-minute tidy up does wonders! 🧹" },
                { id: 'a3', text: "Hope your day is going smoother than a freshly mopped floor." },
                { id: 'a4', text: "Focus on being productive instead of just busy. You got this!" },
                { id: 'a5', text: "Don't forget to hydrate while you're busy dominating today. 💧" }
            ],
            'evening': [
                { id: 'e1', text: "Winding down? Time to relax and reflect on a great day." },
                { id: 'e2', text: "The dishes can wait... or can they? 🤔 (Yes, they can)." },
                { id: 'e3', text: "You survived the day! Treat yourself to something nice." },
                { id: 'e4', text: "A clean home at night means a peaceful morning tomorrow." },
                { id: 'e5', text: "What's for dinner? Hope it's something delicious! 🍽️" }
            ],
            'night': [
                { id: 'n1', text: "Up late? The brain needs rest to be productive tomorrow. 🌙" },
                { id: 'n2', text: "Midnight snacker or late-night planner? We don't judge. 🍕" },
                { id: 'n3', text: "Even superheroes need sleep. Don't stay up too late!" },
                { id: 'n4', text: "It's super quiet right now. Perfect time for some deep focus." },
                { id: 'n5', text: "Go to bed! Tomorrow is a whole new adventure. 😴" }
            ],
            'weekend': [
                { id: 'w1', text: "It's the weekend! Time to relax, recharge, and maybe do laundry." },
                { id: 'w2', text: "Weekends are for pajamas and zero regrets. Enjoy!" },
                { id: 'w3', text: "Take it easy today. You've earned a break. 🛋️" }
            ],
            'zeigarnik': [
                { id: 'z1', text: `You have ${incompleteTasksCount} tasks left. Ready to crush them? 💥` },
                { id: 'z2', text: `Just ${incompleteTasksCount} things standing between you and total relaxation!` },
                { id: 'z3', text: `Knock out those ${incompleteTasksCount} remaining tasks and feel amazing.` }
            ]
        };

        // 4. Select the active pool
        let activePool = pools[timeCategory];
        
        // Sprinkle in weekends or zeigarnik based on context
        if (isWeekend && Math.random() > 0.5) {
            activePool = activePool.concat(pools['weekend']);
        }
        
        if (incompleteTasksCount > 0 && Math.random() > 0.4) {
            activePool = activePool.concat(pools['zeigarnik']);
        }

        // 5. Anti-Habituation Filter (Find a message not in history)
        const history = this.getHistory();
        let candidateMessages = activePool.filter(msg => !history.includes(msg.id));
        
        // Fallback if everything was shown somehow
        if (candidateMessages.length === 0) {
            candidateMessages = activePool; 
        }

        const selectedMessage = candidateMessages[Math.floor(Math.random() * candidateMessages.length)];
        
        // 6. Inject and Update History
        welcomeText.innerHTML = `${greeting}, ${username}! ${emoji}`;
        subtitle.textContent = selectedMessage.text;
        
        this.addToHistory(selectedMessage.id);
    }
}
