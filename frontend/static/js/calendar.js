/**
 * Agenda Calendar Widget - Bi-directional Infinite Scroll & Completion Tracking
 */

window.AgendaWidget = (() => {
    const getAvatarHTMLForUser = (username, additionalStyles = '') => {
        if (!window.me || !window.me.home || !window.me.home.members) {
            return '';
        }
        const member = window.me.home.members.find(m => m.username === username);
        if (!member) {
            const initial = username ? username.charAt(0).toUpperCase() : '?';
            return `<div class="pill-avatar" title="${username}" style="width:24px; height:24px; border-radius:50%; background:var(--primary-purple, #8c52ff); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; border: 2px solid white; ${additionalStyles}">${initial}</div>`;
        }
        
        if (member.avatar) {
            return `<img src="${member.avatar}" alt="${member.username}" class="pill-avatar" title="${member.username}" style="border: 2px solid white; ${additionalStyles}">`;
        } else {
            const initial = member.username.charAt(0).toUpperCase();
            return `<div class="pill-avatar" title="${member.username}" style="width:24px; height:24px; border-radius:50%; background:var(--primary-purple, #8c52ff); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:bold; font-size:10px; border: 2px solid white; ${additionalStyles}">${initial}</div>`;
        }
    };

    // --- Helper Functions ---
    const getDayName = (date) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()];
    const getMonthName = (date) => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][date.getMonth()];
    const formatDateKey = (date) => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,'0')}-${String(date.getDate()).padStart(2,'0')}`;
    
    const isToday = (date) => {
        const today = new Date();
        return date.getDate() === today.getDate() && 
               date.getMonth() === today.getMonth() && 
               date.getFullYear() === today.getFullYear();
    };

    const isPastDate = (date) => {
        const today = new Date();
        today.setHours(0,0,0,0);
        const d = new Date(date);
        d.setHours(0,0,0,0);
        return d < today;
    };

    const createTaskPillHTML = (taskObj, assignedUsers, dateKey, isCompleted, completionRecord) => {
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
        
        let colorClass = 'bg-blue';
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
            const marginStyle = index > 0 ? 'margin-left: -8px;' : '';
            avatarsHTML += getAvatarHTMLForUser(user, marginStyle);
        });

        const isPast = isPastDate(new Date(dateKey + 'T00:00:00'));

        let completionBadge = '';
        let checkIcon = '';
        if (isCompleted) {
            const userName = completionRecord ? (completionRecord.userName || 'Member') : 'Member';
            completionBadge = `<span class="completion-user-badge" style="font-size: 11px; color: #047857; background: rgba(16, 185, 129, 0.15); padding: 1px 6px; border-radius: 6px; font-weight: 600; margin-top: 2px;">✓ ${userName}</span>`;
            checkIcon = `<span class="calendar-task-check material-symbols-rounded" style="color: #10b981; font-size: 22px; cursor: pointer; user-select: none;" data-task-id="${taskObj.id}" data-date="${dateKey}" data-action="incomplete" title="Completed by ${userName} (Click to undo)">check_circle</span>`;
        } else {
            if (isPast) {
                completionBadge = `<span style="font-size: 10px; font-weight: 600; color: #b45309; background: rgba(245, 158, 11, 0.15); padding: 1px 5px; border-radius: 4px; margin-top: 2px;">Missed</span>`;
            }
            checkIcon = `<span class="calendar-task-check material-symbols-rounded" style="color: rgba(0,0,0,0.3); font-size: 22px; cursor: pointer; user-select: none;" data-task-id="${taskObj.id}" data-date="${dateKey}" data-action="complete" title="Mark as Done">radio_button_unchecked</span>`;
        }

        const timeStr = taskObj.allDay ? 'All Day' : (taskObj.time || '');
        
        return `
            <div class="task-pill ${colorClass} ${isOtherClass} ${isCompleted ? 'is-completed' : ''}" style="margin-bottom: 8px;" data-task-id="${taskObj.id}" data-date="${dateKey}">
                <div class="pill-content">
                    <div style="display:flex; align-items:center; gap: 8px;">
                        ${checkIcon}
                        <span class="material-symbols-rounded pill-icon" style="${isCompleted ? 'color: #10b981;' : ''}">${taskObj.icon || 'check_circle'}</span>
                    </div>
                    <div style="display:flex; flex-direction:column;">
                        <span class="pill-title" style="${isCompleted ? 'text-decoration: line-through; opacity: 0.7;' : ''}">${taskObj.title || taskObj.name}</span>
                        <div style="display:flex; align-items:center; gap: 6px;">
                            ${timeStr ? `<span style="font-size: 11px; color: #6b7280; font-weight: 500;">${timeStr}</span>` : ''}
                            ${completionBadge}
                        </div>
                    </div>
                </div>
                <div style="display: flex; align-items: center; gap: 4px;">
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

            this.pastDaysCount = 7;
            this.futureDaysCount = 21;
            this.earliestDate = null;
            this.latestDate = null;
            this.isLoadingPast = false;
            this.isLoadingFuture = false;

            this.container.innerHTML = '';
            this.init();
        }

        createDayElement(dateObj) {
            const homeMeals = JSON.parse(localStorage.getItem('homeMeals') || '{}');
            const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
            const completions = JSON.parse(localStorage.getItem('taskCompletions') || '[]');

            const dayName = getDayName(dateObj);
            const dayNumber = dateObj.getDate();
            const monthName = getMonthName(dateObj);
            const isTodayDate = isToday(dateObj);
            const isPast = isPastDate(dateObj);
            const todayClass = isTodayDate ? 'today' : '';
            const dateKey = formatDateKey(dateObj);

            const dayGroup = document.createElement('div');
            dayGroup.className = `agenda-day-group ${isTodayDate ? 'is-today-group' : ''} ${isPast ? 'is-past-group' : ''}`;
            dayGroup.setAttribute('data-date', dateKey);

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
                            <span class="pill-icon" style="font-size: 18px; margin-right: 8px;">${plannedMeal.emoji || '🍽️'}</span>
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

            // 2. Render Scheduled Tasks
            if (this.options.showTasks && scheduledTasks.length > 0) {
                const currDateObj = new Date(dateObj);
                currDateObj.setHours(0,0,0,0);

                scheduledTasks.forEach(task => {
                    const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
                    taskStart.setHours(0,0,0,0);

                    let occurrenceResult = null;
                    if (window.RecurrenceUtil) {
                        occurrenceResult = window.RecurrenceUtil.checkTaskOccursOnDate(task, currDateObj);
                    } else {
                        if (currDateObj >= taskStart && taskStart.getTime() === currDateObj.getTime()) {
                            occurrenceResult = { occurrenceIndex: 1 };
                        }
                    }

                    if (occurrenceResult) {
                        hasItems = true;

                        let assignedUsers = task.assignees && task.assignees.length > 0 ? task.assignees : [];
                        if (task.rotate && task.assignees && task.assignees.length > 1) {
                            const zeroBasedIndex = Math.max(0, occurrenceResult.occurrenceIndex - 1);
                            const turnIndex = zeroBasedIndex % task.assignees.length;
                            assignedUsers = [task.assignees[turnIndex]];
                        }

                        const isCompleted = completions.some(c => c.taskId == task.id && c.date === dateKey);
                        const compRecord = completions.find(c => c.taskId == task.id && c.date === dateKey);

                        const taskWrapper = document.createElement('div');
                        taskWrapper.innerHTML = createTaskPillHTML(task, assignedUsers, dateKey, isCompleted, compRecord);
                        const pillNode = taskWrapper.firstElementChild;

                        // Wire Popover click
                        pillNode.addEventListener('click', (e) => {
                            // If checkbox clicked, do not open popover
                            if (e.target.classList.contains('calendar-task-check')) return;
                            if (this.options.onTaskClick) {
                                const popoverTask = Object.assign({}, task, { date: dateKey });
                                this.options.onTaskClick(popoverTask);
                            }
                        });

                        // Wire Checkbox toggle
                        const checkBtn = pillNode.querySelector('.calendar-task-check');
                        if (checkBtn) {
                            checkBtn.addEventListener('click', async (e) => {
                                e.stopPropagation();
                                const action = checkBtn.getAttribute('data-action');
                                checkBtn.textContent = 'hourglass_empty';
                                if (action === 'complete') {
                                    if (window.HomeAPI && window.HomeAPI.completeTask) {
                                        await window.HomeAPI.completeTask(task.id, dateKey);
                                    } else {
                                        completions.push({ taskId: task.id, date: dateKey, userName: 'Me' });
                                        localStorage.setItem('taskCompletions', JSON.stringify(completions));
                                    }
                                } else {
                                    if (window.HomeAPI && window.HomeAPI.incompleteTask) {
                                        await window.HomeAPI.incompleteTask(task.id, dateKey);
                                    } else {
                                        const remaining = completions.filter(c => !(c.taskId == task.id && c.date === dateKey));
                                        localStorage.setItem('taskCompletions', JSON.stringify(remaining));
                                    }
                                }
                                if (window.refreshAllData) {
                                    window.refreshAllData();
                                } else {
                                    window.AgendaWidget.refresh();
                                }
                            });
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
            return dayGroup;
        }

        prependPastDays(numDays) {
            if (this.isLoadingPast || !this.earliestDate) return;
            this.isLoadingPast = true;

            const fragment = document.createDocumentFragment();
            const current = new Date(this.earliestDate);

            const daysToAdd = [];
            for (let i = 1; i <= numDays; i++) {
                const prev = new Date(current);
                prev.setDate(prev.getDate() - i);
                daysToAdd.unshift(prev);
            }

            daysToAdd.forEach(d => {
                fragment.appendChild(this.createDayElement(d));
            });

            this.earliestDate = daysToAdd[0];

            const oldScrollHeight = this.container.scrollHeight;
            const oldScrollTop = this.container.scrollTop;

            this.container.prepend(fragment);

            const newScrollHeight = this.container.scrollHeight;
            this.container.scrollTop = oldScrollTop + (newScrollHeight - oldScrollHeight);

            this.isLoadingPast = false;
        }

        appendFutureDays(numDays) {
            if (this.isLoadingFuture || !this.latestDate) return;
            this.isLoadingFuture = true;

            const fragment = document.createDocumentFragment();
            const current = new Date(this.latestDate);

            for (let i = 1; i <= numDays; i++) {
                const next = new Date(current);
                next.setDate(next.getDate() + i);
                fragment.appendChild(this.createDayElement(next));
                this.latestDate = next;
            }

            this.container.appendChild(fragment);
            this.isLoadingFuture = false;
        }

        scrollToToday(smooth = true) {
            const todayGroup = this.container.querySelector('.is-today-group');
            if (todayGroup) {
                todayGroup.scrollIntoView({ block: 'start', behavior: smooth ? 'smooth' : 'auto' });
            }
        }

        checkTodayVisibility() {
            const jumpBtn = document.getElementById('agendaJumpTodayBtn');
            if (!jumpBtn) return;

            const todayGroup = this.container.querySelector('.is-today-group');
            if (!todayGroup) {
                jumpBtn.style.display = 'inline-flex';
                return;
            }

            const containerRect = this.container.getBoundingClientRect();
            const todayRect = todayGroup.getBoundingClientRect();

            const isVisible = (todayRect.top >= containerRect.top - 50) && (todayRect.bottom <= containerRect.bottom + 50);
            jumpBtn.style.display = isVisible ? 'none' : 'inline-flex';
        }

        init() {
            const today = new Date();
            today.setHours(0,0,0,0);

            this.earliestDate = new Date(today);
            this.earliestDate.setDate(this.earliestDate.getDate() - this.pastDaysCount);

            this.latestDate = new Date(today);
            this.latestDate.setDate(this.latestDate.getDate() + this.futureDaysCount);

            const fragment = document.createDocumentFragment();
            const iterDate = new Date(this.earliestDate);

            while (iterDate <= this.latestDate) {
                fragment.appendChild(this.createDayElement(new Date(iterDate)));
                iterDate.setDate(iterDate.getDate() + 1);
            }

            this.container.appendChild(fragment);

            // Center on Today after render
            requestAnimationFrame(() => {
                this.scrollToToday(false);
                this.checkTodayVisibility();
            });

            // Scroll Listener for bi-directional scroll
            this.container.addEventListener('scroll', () => {
                this.checkTodayVisibility();

                // Scroll Up -> Prepend Past Days
                if (this.container.scrollTop <= 60 && !this.isLoadingPast) {
                    this.prependPastDays(7);
                }

                // Scroll Down -> Append Future Days
                if (this.container.scrollTop + this.container.clientHeight >= this.container.scrollHeight - 120 && !this.isLoadingFuture) {
                    this.appendFutureDays(10);
                }
            });

            // Jump to Today button click
            const jumpBtn = document.getElementById('agendaJumpTodayBtn');
            if (jumpBtn) {
                jumpBtn.addEventListener('click', (e) => {
                    e.preventDefault();
                    this.scrollToToday(true);
                });
            }
        }

        refresh() {
            const today = new Date();
            today.setHours(0,0,0,0);
            
            const currentScrollTop = this.container.scrollTop;
            this.container.innerHTML = '';
            
            this.earliestDate = new Date(today);
            this.earliestDate.setDate(this.earliestDate.getDate() - this.pastDaysCount);

            this.latestDate = new Date(today);
            this.latestDate.setDate(this.latestDate.getDate() + this.futureDaysCount);

            const fragment = document.createDocumentFragment();
            const iterDate = new Date(this.earliestDate);

            while (iterDate <= this.latestDate) {
                fragment.appendChild(this.createDayElement(new Date(iterDate)));
                iterDate.setDate(iterDate.getDate() + 1);
            }

            this.container.appendChild(fragment);
            this.container.scrollTop = currentScrollTop;
            this.checkTodayVisibility();
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
