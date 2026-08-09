/**
 * Agenda Calendar Widget - Modularized
 */

window.AgendaWidget = (() => {
    // Legacy support for meals code
    // Legacy support for meals code
    // (Removed mockAvatars array)

    const getAvatarHTMLForUser = (username, additionalStyles = '') => {
        if (!window.me || !window.me.home || !window.me.home.members) {
            return '';
        }
        const member = window.me.home.members.find(m => m.username === username);
        if (!member) {
            // Fallback for unknown users
            const initial = username ? username.charAt(0).toUpperCase() : '?';
            return `<div class="pill-avatar" title="${username}" style="width:24px; height:24px; border-radius:50%; background:var(--primary-purple); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; border: 2px solid white; ${additionalStyles}">${initial}</div>`;
        }
        
        if (member.avatar) {
            return `<img src="${member.avatar}" alt="${member.username}" class="pill-avatar" title="${member.username}" style="border: 2px solid white; ${additionalStyles}">`;
        } else {
            const initial = member.username.charAt(0).toUpperCase();
            return `<div class="pill-avatar" title="${member.username}" style="width:24px; height:24px; border-radius:50%; background:var(--primary-purple); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; border: 2px solid white; ${additionalStyles}">${initial}</div>`;
        }
    };

    // --- Helper Functions ---
    const getDayName = (date) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    const getMonthName = (date) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    };

    const createTaskPillHTML = (taskObj, assignedUsers) => {
        // assignedUsers is now an array
        const myUsername = window.me && window.me.user ? window.me.user.username : null;
        const isOtherClass = (myUsername && !assignedUsers.includes(myUsername) && assignedUsers.length > 0) ? 'is-other' : '';
        const defaultColorMap = {
            'default-living': 'purple',
            'default-kitchen': 'yellow',
            'default-bedroom': 'green',
            'default-bath': 'cyan',
            'default-toilet': 'orange',
            'general': 'blue'
        };
        
        let colorClass = 'bg-blue'; // Default to blue for empty room or general
        
        if (taskObj.room && defaultColorMap[taskObj.room]) {
            colorClass = `bg-${defaultColorMap[taskObj.room]}`;
        } else if (taskObj.room) {
            const facilities = JSON.parse(localStorage.getItem('homeFacilities') || '[]');
            const facility = facilities.find(f => f.id === taskObj.room || f.id === taskObj.roomId);
            if (facility && facility.color) {
                colorClass = `bg-${facility.color}`;
            }
        }
        
        // Generate HTML for all assigned users
        let avatarsHTML = '';
        assignedUsers.forEach((user, index) => {
            // Add a small negative margin to overlap avatars slightly if there are multiple
            const marginStyle = index > 0 ? 'margin-left: -8px;' : '';
            avatarsHTML += getAvatarHTMLForUser(user, marginStyle);
        });
        
        return `
            <div class="task-pill ${colorClass} ${isOtherClass}" style="margin-bottom: 8px;">
                <div class="pill-content">
                    <span class="material-symbols-rounded pill-icon">${taskObj.icon}</span>
                    <div style="display:flex; flex-direction:column;">
                        <span class="pill-title">${taskObj.title}</span>
                        ${taskObj.allDay ? `<span style="font-size: 11px; color: #6b7280; font-weight: 500;">All Day</span>` : taskObj.time ? `<span style="font-size: 11px; color: #6b7280; font-weight: 500;">${taskObj.time}</span>` : ''}
                    </div>
                </div>
                <div style="display: flex; align-items: center;">
                    ${avatarsHTML}
                </div>
            </div>
        `;
    };

    class Agenda {
        constructor(containerId, options = {}) {
            this.container = document.getElementById(containerId);
            if (!this.container) return;

            this.options = Object.assign({
                showTasks: true,
                showMeals: true,
                onDayClick: null,
                onMealClick: null,
                onTaskClick: null
            }, options);

            this.currentDatePointer = new Date();
            this.isGenerating = false;
            
            // Empty container
            this.container.innerHTML = '';

            this.init();
        }

        generateDays(numDays) {
            if (this.isGenerating) return;
            this.isGenerating = true;

            const homeMeals = JSON.parse(localStorage.getItem('homeMeals') || '{}');
            let fragment = document.createDocumentFragment();

            for (let i = 0; i < numDays; i++) {
                const dayName = getDayName(this.currentDatePointer);
                const dayNumber = this.currentDatePointer.getDate();
                const monthName = getMonthName(this.currentDatePointer);
                const todayClass = isToday(this.currentDatePointer) ? 'today' : '';
                
                const dateKey = `${this.currentDatePointer.getFullYear()}-${String(this.currentDatePointer.getMonth()+1).padStart(2,'0')}-${String(this.currentDatePointer.getDate()).padStart(2,'0')}`;
                const plannedMeal = homeMeals[dateKey];
                
                const dayGroup = document.createElement('div');
                dayGroup.className = 'agenda-day-group';
                
                // --- Date Column ---
                const dateCol = document.createElement('div');
                dateCol.className = 'agenda-date-col';
                if (this.options.onDayClick) {
                    dateCol.style.cursor = 'pointer';
                    dateCol.title = 'Add to this day';
                    dateCol.addEventListener('click', () => this.options.onDayClick(dateKey));
                }
                dateCol.innerHTML = `
                    <span class="day-name">${dayName}</span>
                    <span class="day-number ${todayClass}">${dayNumber}</span>
                    <span class="month-name">${monthName}</span>
                `;
                dayGroup.appendChild(dateCol);

                // --- Tasks Column ---
                const tasksCol = document.createElement('div');
                tasksCol.className = 'agenda-tasks-col';
                let hasItems = false;

                // 1. Render Meals
                const mealData = homeMeals[dateKey];
                let mealsForDay = [];
                if (mealData) {
                    mealsForDay = Array.isArray(mealData) ? mealData : [mealData];
                }

                if (this.options.showMeals && mealsForDay.length > 0) {
                    hasItems = true;
                    mealsForDay.forEach((plannedMeal, index) => {
                        let avatarHTML = '';
                        if (plannedMeal.cook === 'Anyone' || !plannedMeal.cook) {
                            avatarHTML = `<div class="pill-avatar" style="background:#e5e7eb; color:#6b7280; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;"><span class="material-symbols-rounded" style="font-size:14px;">groups</span></div>`;
                        } else {
                            avatarHTML = getAvatarHTMLForUser(plannedMeal.cook);
                        }

                        const mealPill = document.createElement('div');
                        mealPill.className = 'task-pill bg-yellow is-meal';
                        mealPill.style.cssText = 'border: 2px solid #ffc107; background: #fffdf5; cursor: pointer; margin-bottom: 8px;';
                        mealPill.innerHTML = `
                            <div class="pill-content">
                                <span class="pill-icon" style="font-size: 18px; margin-right: 8px;">${plannedMeal.emoji}</span>
                                <div style="display: flex; flex-direction: column;">
                                    <span class="pill-title" style="color: #333; font-weight:700; line-height: 1.2;">${plannedMeal.name}</span>
                                    ${plannedMeal.type ? `<span style="font-size: 11px; color: #6b7280; font-weight: 500;">${plannedMeal.type}</span>` : ''}
                                </div>
                            </div>
                            ${avatarHTML}
                        `;
                        if (this.options.onMealClick) {
                            mealPill.addEventListener('click', () => this.options.onMealClick(plannedMeal, dateKey, index));
                        }
                        tasksCol.appendChild(mealPill);
                    });
                }

                // 2. Render Scheduled Tasks (Dynamic Time-Based Rotation)
                const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
                
                if (this.options.showTasks && scheduledTasks.length > 0) {
                    scheduledTasks.forEach(task => {
                        // Check if task falls on this date based on recurrence and startDate
                        const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
                        // Reset time for start date comparison
                        taskStart.setHours(0,0,0,0);
                        const currDateObj = new Date(this.currentDatePointer);
                        currDateObj.setHours(0,0,0,0);
                        
                        let occurrenceResult = null;
                        if (window.RecurrenceUtil) {
                            occurrenceResult = window.RecurrenceUtil.checkTaskOccursOnDate(task, currDateObj);
                        } else {
                            // Fallback minimal logic
                            const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
                            taskStart.setHours(0,0,0,0);
                            if (currDateObj >= taskStart && taskStart.getTime() === currDateObj.getTime()) {
                                occurrenceResult = { occurrenceIndex: 1 };
                            }
                        }
                        
                        if (occurrenceResult) {
                            hasItems = true;
                            
                            /*
                             * ۲. اگر گزینه Rotate خاموش باشد چه میشود؟ 
                             * سوال بسیار مهمی است! این منطق "تسک مشترک (Shared Task)" است.
                             * اگر گزینه Rotate (چرخش) خاموش باشد اما شما ۳ نفر را انتخاب کنید، یعنی این تسک بین هر ۳ نفر مشترک است 
                             * و باید با هم آن را انجام دهند (یا حداقل همه مسئولش هستند). 
                             * در این حالت، تقویم عکس هر ۳ نفر را به صورت روی‌هم‌افتاده (Stacked) نمایش می‌دهد تا مشخص شود این یک کار تیمی است.
                             */
                            let assignedUsers = task.assignees && task.assignees.length > 0 ? task.assignees : [];
                            
                            if (task.rotate && task.assignees && task.assignees.length > 1) {
                                // occurrenceIndex is 1-based, we want 0-based for array modulo
                                const zeroBasedIndex = Math.max(0, occurrenceResult.occurrenceIndex - 1);
                                const turnIndex = zeroBasedIndex % task.assignees.length;
                                assignedUsers = [task.assignees[turnIndex]]; // Array of one person for this turn
                            }
                            
                            const taskWrapper = document.createElement('div');
                            taskWrapper.innerHTML = createTaskPillHTML(task, assignedUsers);
                            const pillNode = taskWrapper.firstElementChild;
                            if (this.options.onTaskClick) {
                                pillNode.style.cursor = 'pointer';
                                pillNode.addEventListener('click', () => this.options.onTaskClick(task));
                            }
                            tasksCol.appendChild(pillNode);
                        }
                    });
                }

                if (!hasItems) {
                    tasksCol.innerHTML = `<div style="padding: 12px 16px; font-size: 13px; color: #9ca3af; font-style: italic; cursor:pointer;">No ${this.options.showTasks && !this.options.showMeals ? 'tasks' : 'plans'} scheduled. Click to add.</div>`;
                    if (this.options.onDayClick) {
                        tasksCol.firstElementChild.addEventListener('click', () => this.options.onDayClick(dateKey));
                    }
                }

                dayGroup.appendChild(tasksCol);
                fragment.appendChild(dayGroup);

                // Increment date by 1 day
                this.currentDatePointer.setDate(this.currentDatePointer.getDate() + 1);
            }

            this.container.appendChild(fragment);
            this.isGenerating = false;
        }

        init() {
            this.generateDays(30);

            this.container.addEventListener('scroll', () => {
                if (this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight - 200) {
                    setTimeout(() => {
                        this.generateDays(15);
                    }, 100);
                }
            });
        }
        
        refresh() {
            this.container.innerHTML = '';
            this.currentDatePointer = new Date();
            this.generateDays(30);
        }
    }

    return {
        init: (containerId, options) => {
            const instance = new Agenda(containerId, options);
            window.AgendaWidget.instance = instance;
            return instance;
        },
        refresh: () => {
            if (window.AgendaWidget && window.AgendaWidget.instance) {
                window.AgendaWidget.instance.refresh();
            }
        }
    };
})();

// For backward compatibility on the dashboard (index.html) where it expects an auto-init
document.addEventListener('DOMContentLoaded', () => {
    if (document.getElementById('agendaScrollArea') && !window.location.pathname.endsWith('meals.html')) {
        AgendaWidget.init('agendaScrollArea', {
            showTasks: true,
            showMeals: true,
            onTaskClick: (task) => {
                if (window.openEventDetailsPopover) {
                    window.openEventDetailsPopover(task, 'task');
                }
            },
            onDayClick: (dateKey) => {
                if (typeof window.openQuickAddModal === 'function') {
                    window.openQuickAddModal('', 'general', 'check_circle', dateKey);
                }
            },
            onMealClick: (meal, dateKey) => {
                if (window.openEventDetailsPopover) {
                    // Normalize meal object to work with the popover
                    const mealTask = {
                        isMeal: true,
                        name: meal.name,
                        icon: meal.emoji,
                        date: dateKey,
                        time: meal.type, // e.g. Lunch
                        assignees: [meal.cook],
                        description: meal.note || `A delicious ${meal.type ? meal.type.toLowerCase() : 'meal'} planned for ${dateKey}.`,
                        recipeId: meal.recipeId
                    };
                    window.openEventDetailsPopover(mealTask, 'meal');
                }
            }
        });
    }
});
