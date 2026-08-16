/**
 * Dashboard Logic - Dynamically render facilities and manage Setup Wizard (Edit/Create)
 */

document.addEventListener('DOMContentLoaded', () => {
    const facilitiesGrid = document.querySelector('.facilities-grid');
    if (!facilitiesGrid) return;

    const defaultZones = [
        { id: 'main-floor', name: 'Main Floor', icon: 'layers', color: 'purple' },
        { id: 'routines', name: 'Routines', icon: 'autorenew', color: 'green' }
    ];

    const getZones = () => {
        let zones = JSON.parse(localStorage.getItem('homeZones'));
        if (!zones || zones.length === 0) {
            zones = defaultZones;
            localStorage.setItem('homeZones', JSON.stringify(zones));
        } else {
            let updated = false;
            zones.forEach(z => {
                if (!z.icon) { z.icon = 'layers'; updated = true; }
                if (!z.color) { z.color = 'purple'; updated = true; }
            });
            if (updated) localStorage.setItem('homeZones', JSON.stringify(zones));
        }
        return zones;
    };

// Handle task completion UI
window.completeTaskUI = async function(checkbox, taskId) {
    const el = checkbox.closest('li').querySelector('.task-text');
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    
    let completions = JSON.parse(localStorage.getItem('taskCompletions') || '[]');
    
    if (checkbox.checked) {
        if (el) {
            el.style.textDecoration = 'line-through';
            el.style.opacity = '0.5';
        }
        
        // Show points toast
        const toast = document.createElement('div');
        toast.innerText = '🎉 +10 Points!';
        toast.style.position = 'fixed';
        toast.style.bottom = '20px';
        toast.style.left = '50%';
        toast.style.transform = 'translateX(-50%)';
        toast.style.backgroundColor = 'var(--primary-purple)';
        toast.style.color = '#fff';
        toast.style.padding = '10px 20px';
        toast.style.borderRadius = '50px';
        toast.style.fontWeight = 'bold';
        toast.style.zIndex = '9999';
        toast.style.boxShadow = '0 4px 10px rgba(0,0,0,0.2)';
        toast.style.animation = 'fadeUp 0.3s ease forwards';
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.animation = 'fadeDown 0.3s ease forwards';
            setTimeout(() => toast.remove(), 300);
        }, 2000);
        
        // Add locally immediately
        completions.push({ taskId: taskId, date: todayKey });
        localStorage.setItem('taskCompletions', JSON.stringify(completions));
        
        // Call API to give points
        if (window.HomeAPI && window.HomeAPI.completeTask) {
            await window.HomeAPI.completeTask(taskId, todayKey);
        }
        
        // If it's inside a priority card, remove it after 1 second for "Inbox Zero" feel
        const isPriorityCard = checkbox.closest('.priority-cards-container');
        if (isPriorityCard) {
            setTimeout(() => {
                const li = checkbox.closest('li');
                if (li && checkbox.checked) {
                    li.style.transition = 'all 0.3s ease';
                    li.style.height = li.offsetHeight + 'px';
                    li.style.overflow = 'hidden';
                    setTimeout(() => {
                        li.style.height = '0';
                        li.style.padding = '0';
                        li.style.opacity = '0';
                        li.style.margin = '0';
                        setTimeout(() => {
                            const ul = li.closest('ul');
                            li.remove();
                            // Update badge count
                            const card = ul ? ul.closest('section') : null;
                            if (card) {
                                const badge = card.querySelector('.progress-badge');
                                const remaining = ul.children.length;
                                if (badge) badge.innerText = `${remaining} Task${remaining !== 1 ? 's' : ''}`;
                                
                                // If no more tasks, remove the whole card
                                if (remaining === 0) {
                                    card.style.transition = 'all 0.4s ease';
                                    card.style.transform = 'scale(0.8)';
                                    card.style.opacity = '0';
                                    setTimeout(() => {
                                        card.remove();
                                        // Check if container is completely empty
                                        const container = document.getElementById('priorityCardsContainer');
                                        if (container && container.children.length === 0) {
                                            container.innerHTML = `
                                                <section class="facility-card green animate-fade-up" style="margin-bottom: 0; width: 100%; max-width: 100%;">
                                                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: white;">
                                                        <span class="material-symbols-rounded icon" style="font-size: 56px; margin-bottom: 16px; background: rgba(255,255,255,0.2); padding: 20px; border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">celebration</span>
                                                        <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; text-shadow: 0 2px 5px rgba(0,0,0,0.1);">All Caught Up!</h3>
                                                        <p style="opacity: 0.8; font-size: 15px; margin: 0;">You have completed all priority tasks for today.</p>
                                                    </div>
                                                </section>`;
                                        }
                                    }, 400);
                                }
                            }
                        }, 300);
                    }, 10);
                }
            }, 1000);
        }
    } else {
        if (el) {
            el.style.textDecoration = 'none';
            el.style.opacity = '1';
        }
        
        // Remove locally immediately
        completions = completions.filter(c => !(c.taskId == taskId && c.date === todayKey));
        localStorage.setItem('taskCompletions', JSON.stringify(completions));
        
        // Call API to remove points
        if (window.HomeAPI && window.HomeAPI.incompleteTask) {
            await window.HomeAPI.incompleteTask(taskId, todayKey);
        }
    }
    
    // Refresh progress widget
    if (window.updateHouseholdProgressWidget) {
        window.updateHouseholdProgressWidget();
    }
};

window.updateHouseholdProgressWidget = function() {
    const today = new Date();
    const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    
    const allTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
    let todaysTasks = allTasks.filter(task => {
        const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
        taskStart.setHours(0,0,0,0);
        if (today < taskStart) return false;
        
        if (window.RecurrenceUtil) {
            return window.RecurrenceUtil.checkTaskOccursOnDate(task, today) !== null;
        }
        return taskStart.getTime() === today.getTime();
    });
    
    const completions = JSON.parse(localStorage.getItem('taskCompletions') || '[]');
    let completedCount = 0;
    
    todaysTasks.forEach(task => {
        if (completions.some(c => c.taskId == task.id && c.date === todayKey)) {
            completedCount++;
        }
    });
    
    const totalCount = todaysTasks.length;
    
    const countEl = document.getElementById('householdProgressCount');
    const barEl = document.getElementById('householdProgressBar');
    const msgEl = document.getElementById('householdProgressMsg');
    
    if (countEl) countEl.innerText = `${completedCount}/${totalCount}`;
    if (barEl) {
        const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
        barEl.style.width = `${percentage}%`;
    }
    if (msgEl) {
        if (totalCount === 0) {
            msgEl.innerText = "No chores scheduled for today.";
        } else if (completedCount === totalCount) {
            msgEl.innerText = "All chores completed! Great job!";
        } else {
            const remaining = totalCount - completedCount;
            msgEl.innerText = `Almost there! Just ${remaining} more chore${remaining > 1 ? 's' : ''} to finish the day strong.`;
        }
    }
};

window.getAssigneeAvatarHTML = function(assignName, color = 'var(--primary-purple)') {
    const currentHome = JSON.parse(localStorage.getItem('currentHome') || '{}');
    const members = currentHome.members || [];
    const member = members.find(m => m.username === assignName);
    
    let displayName = assignName;
    if (member && member.display_name) {
        displayName = member.display_name;
    }

    if (member && member.avatar) {
        return `<img src="${member.avatar}" alt="${displayName}" title="${displayName}" class="assignee-avatar" style="width:24px; height:24px; border-radius:50%; object-fit:cover; border:1px solid rgba(0,0,0,0.1);">`;
    }
    
    // Fallback to circle initial
    const initial = displayName.charAt(0).toUpperCase();
    return `<div class="assignee-avatar" title="${displayName}" style="width:24px; height:24px; border-radius:50%; background:${color}; color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${initial}</div>`;
};

    const renderPriorityCards = () => {
        const container = document.getElementById('priorityCardsContainer');
        if (!container) return;

        // 1. Get scheduled tasks, facilities, zones, and meals
        const allTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
        const facilities = JSON.parse(localStorage.getItem('homeFacilities') || '[]');
        const zones = JSON.parse(localStorage.getItem('homeZones') || '[]');
        const homeMeals = JSON.parse(localStorage.getItem('homeMeals') || '{}');
        const completions = JSON.parse(localStorage.getItem('taskCompletions') || '[]');
        
        // Default facilities if missing
        const defaultFacilities = {
            'default-living': { id: 'default-living', name: 'Living Room', type: 'living', zoneId: 'main-floor', color: 'purple', icon: 'chair' },
            'default-kitchen': { id: 'default-kitchen', name: 'Kitchen', type: 'kitchen', zoneId: 'main-floor', color: 'yellow', icon: 'kitchen' },
            'default-bedroom': { id: 'default-bedroom', name: 'Bedroom', type: 'bedroom', zoneId: 'main-floor', color: 'green', icon: 'bed' },
            'default-bath': { id: 'default-bath', name: 'Bathroom', type: 'bathroom', zoneId: 'main-floor', color: 'cyan', icon: 'bathtub' },
            'default-toilet': { id: 'default-toilet', name: 'Restroom', type: 'other', zoneId: 'main-floor', color: 'orange', icon: 'wc' }
        };

        const getFacility = (id) => {
            let f = facilities.find(fac => fac.id === id);
            if (f) {
                if (!f.color && defaultFacilities[id]) f.color = defaultFacilities[id].color;
                return f;
            }
            return defaultFacilities[id] || { name: 'General', type: 'other', color: 'blue', zoneId: 'main-floor' };
        };
        const getZoneName = (zoneId) => {
            const z = zones.find(z => z.id === zoneId);
            return z ? z.name : 'Home';
        };

        // 2. Filter for today's tasks
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        
        const currentUserUsername = window.me ? window.me.user.username : '';
        const currentUserDisplayName = window.me ? window.me.user.display_name : '';
        
        const todaysTasks = allTasks.filter(task => {
            const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
            taskStart.setHours(0,0,0,0);
            if (today < taskStart) return false;
            
            let isDateMatch = false;
            let occurrenceResult = null;
            if (window.RecurrenceUtil) {
                occurrenceResult = window.RecurrenceUtil.checkTaskOccursOnDate(task, today);
                isDateMatch = occurrenceResult !== null;
            } else {
                // Fallback just in case
                isDateMatch = taskStart.getTime() === today.getTime();
                if (isDateMatch) occurrenceResult = { occurrenceIndex: 1 };
            }
            if (!isDateMatch) return false;
            
            // Determine active assignees for this occurrence
            let activeAssignees = task.assignees && task.assignees.length > 0 ? task.assignees : [];
            if (task.rotate && activeAssignees.length > 1 && occurrenceResult) {
                const zeroBasedIndex = Math.max(0, occurrenceResult.occurrenceIndex - 1);
                const turnIndex = zeroBasedIndex % activeAssignees.length;
                activeAssignees = [activeAssignees[turnIndex]];
            }
            task._activeAssignees = activeAssignees; // attach for rendering
            
            // Filter by active assignee
            let isAssignedToMe = true;
            if (activeAssignees.length > 0) {
                isAssignedToMe = activeAssignees.includes('Anyone') || 
                                 activeAssignees.includes('Me') || 
                                 activeAssignees.includes(currentUserUsername) ||
                                 activeAssignees.includes(currentUserDisplayName);
            }
            return isAssignedToMe;
        });

        const todaysMealsRaw = Array.isArray(homeMeals[todayKey]) ? homeMeals[todayKey] : (homeMeals[todayKey] ? [homeMeals[todayKey]] : []);
        const todaysMeals = todaysMealsRaw.filter(meal => {
            let isAssignedToMe = true;
            if (meal.cook && meal.cook.length > 0) {
                isAssignedToMe = meal.cook === 'Anyone' || 
                                 meal.cook === 'Me' || 
                                 meal.cook === currentUserUsername ||
                                 meal.cook === currentUserDisplayName;
            }
            return isAssignedToMe;
        });

        // 3. Group by Room and Filter Pending Tasks
        const grouped = {};
        todaysTasks.forEach(task => {
            const roomId = task.room || 'general';
            if (!grouped[roomId]) grouped[roomId] = [];
            
            // Filter out completed tasks so the inbox only shows pending ones
            if (!completions.some(c => c.taskId == task.id && c.date === todayKey)) {
                grouped[roomId].push(task);
            }
        });

        // Helper to parse time string "HH:MM" to float hours for sorting
        const parseTime = (timeStr, allDay) => {
            if (allDay || !timeStr) return 24; // All day tasks pushed to the end of the day
            const parts = timeStr.split(':');
            if (parts.length === 2) {
                return parseInt(parts[0]) + (parseInt(parts[1]) / 60);
            }
            return 24;
        };

        // 3.5 Sort rooms and tasks by earliest time
        const roomEarliest = {};
        const sortedRoomIds = Object.keys(grouped).filter(roomId => grouped[roomId].length > 0);
        
        sortedRoomIds.forEach(roomId => {
            // Sort tasks inside the room by time
            grouped[roomId].sort((a, b) => parseTime(a.time, a.allDay) - parseTime(b.time, b.allDay));
            
            // The room's priority is dictated by its earliest task
            roomEarliest[roomId] = parseTime(grouped[roomId][0].time, grouped[roomId][0].allDay);
        });

        sortedRoomIds.sort((a, b) => roomEarliest[a] - roomEarliest[b]);

        // 4. Render HTML
        container.innerHTML = '';
        let delay = 0.4;
        
        sortedRoomIds.forEach(roomId => {
            const pendingRoomTasks = grouped[roomId];
            
            const facility = getFacility(roomId);
            const zoneName = getZoneName(facility.zoneId);
            
            const iconMap = {
                'kitchen': 'kitchen', 'bathroom': 'bathroom', 'living': 'chair',
                'bedroom': 'bed', 'routine': 'autorenew', 'other': 'category'
            };
            const fIcon = facility.icon || iconMap[facility.type] || 'category';
            const badgeBg = facility.color === 'yellow' ? 'rgba(0,0,0,0.15)' : 'rgba(255,255,255,0.2)';
            const badgeColor = facility.color === 'yellow' ? '#333' : '#fff';
            const facilityColor = facility.color || 'blue';
            
            let tasksHTML = '';
            pendingRoomTasks.forEach(task => {
                let assigneeAvatar = '';
                const displayAssignees = task._activeAssignees || task.assignees || [];
                
                if (displayAssignees.length > 0 && displayAssignees[0] !== 'Me' && displayAssignees[0] !== 'Anyone') {
                    assigneeAvatar = '<div style="display:flex; margin-left: 4px;">';
                    displayAssignees.forEach((assignName, idx) => {
                        const zIndex = 10 - idx;
                        const margin = idx > 0 ? '-6px' : '0';
                        if (window.getAssigneeAvatarHTML) {
                            assigneeAvatar += `<div style="z-index: ${zIndex}; margin-left: ${margin};">${window.getAssigneeAvatarHTML(assignName, `var(--primary-${facilityColor})`)}</div>`;
                        }
                    });
                    assigneeAvatar += '</div>';
                }
                const timeStr = task.allDay ? 'All Day' : (task.time || 'Anytime');
                
                tasksHTML += `
                    <li data-task-id="${task.id}" style="cursor: pointer;" onclick="if(window.openEventDetailsPopover) window.openEventDetailsPopover(JSON.parse(this.dataset.task), 'task')" data-task='${JSON.stringify(task).replace(/'/g, "&apos;")}'>
                        <label class="custom-checkbox" onclick="event.stopPropagation()">
                            <input type="checkbox" onchange="window.completeTaskUI(this, '${task.id}')">
                            <span class="checkmark" style="border-color: rgba(0,0,0,0.3);"></span>
                            <span class="task-text" style="display:flex; align-items:center; gap:6px;">
                                <span class="material-symbols-rounded" style="font-size: 16px; opacity: 0.7;">${task.icon || 'cleaning_services'}</span>
                                ${task.title}
                            </span>
                        </label>
                        <div style="display: flex; align-items: center; gap: 12px;">
                            <span style="font-size: 12px; opacity: 0.8; display: flex; align-items: center; gap: 4px;">
                                <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${timeStr}
                            </span>
                            ${assigneeAvatar}
                        </div>
                    </li>
                `;
            });

            const card = document.createElement('section');
            card.className = `facility-card ${facilityColor} animate-fade-up`;
            card.style.animationDelay = `${delay}s`;
            card.style.flexShrink = '0';
            delay += 0.1;
            
            card.innerHTML = `
                <div class="card-summary" onclick="this.closest('.facility-card').classList.toggle('active')">
                    <div class="card-top-row">
                        <span class="material-symbols-rounded icon">${fIcon}</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="progress-badge" style="background: ${badgeBg}; color: ${badgeColor}; border: none;">${pendingRoomTasks.length} Task${pendingRoomTasks.length > 1 ? 's' : ''}</span>
                            <button class="icon-btn small" style="background: transparent; border: none; padding: 4px;"><span class="material-symbols-rounded" style="font-size: 20px; color: inherit;">more_horiz</span></button>
                        </div>
                    </div>
                    <div>
                        <h3 style="margin-bottom: 0; display: flex; align-items: center;">${facility.name} <span style="font-size: 13px; font-weight: 400; opacity: 0.75; margin-left: 6px;">• ${zoneName}</span></h3>
                    </div>
                </div>
                <div class="card-details">
                    <ul class="task-list">
                        ${tasksHTML}
                    </ul>
                </div>
            `;
            container.appendChild(card);
        });

        // 5. Render Meals Card (if any)
        if (todaysMeals.length > 0) {
            let mealsHTML = '';
            
            // Filter pending meals
            const pendingMeals = todaysMeals.map((meal, idx) => ({meal, idx})).filter(({meal}) => {
                return !meal.completed;
            });
            
            if (pendingMeals.length > 0) {
                pendingMeals.forEach(({meal, idx}) => {
                    let assigneeAvatar = '';
                    if (meal.cook && meal.cook !== 'Anyone') {
                        assigneeAvatar = window.getAssigneeAvatarHTML(meal.cook, 'var(--secondary-cyan)');
                    }
                    
                    const mappedMeal = {
                        isMeal: true,
                        name: meal.name,
                        icon: meal.emoji,
                        date: todayKey,
                        time: meal.type,
                        assignees: [meal.cook],
                        description: meal.note || `A delicious ${meal.type ? meal.type.toLowerCase() : 'meal'} planned for today.`,
                        recipeId: meal.recipeId
                    };
                    
                    mealsHTML += `
                        <li data-meal-index="${idx}" style="cursor: pointer;" onclick="if(window.openEventDetailsPopover) window.openEventDetailsPopover(JSON.parse(this.dataset.task), 'meal')" data-task='${JSON.stringify(mappedMeal).replace(/'/g, "&apos;")}'>
                            <label class="custom-checkbox" onclick="event.stopPropagation()">
                                <input type="checkbox" onchange="window.completeTaskUI(this, 'meal-${meal.id}')">
                                <span class="checkmark" style="border-color: rgba(0,0,0,0.3);"></span>
                                <span class="task-text" style="display:flex; align-items:center; gap:8px;">
                                    <span style="font-size: 18px;">${meal.emoji || '🍽️'}</span>
                                    <span style="font-weight: 500;">${meal.name}</span>
                                </span>
                            </label>
                            <div style="display: flex; align-items: center; gap: 12px;">
                                <span style="font-size: 12px; opacity: 0.8; display: flex; align-items: center; gap: 4px;">
                                    <span class="material-symbols-rounded" style="font-size: 14px;">schedule</span> ${meal.type || 'Meal'}
                                </span>
                                ${assigneeAvatar}
                            </div>
                        </li>
                    `;
                });
    
                const mealCardHTML = `
                    <section class="facility-card orange animate-fade-up" style="animation-delay: ${delay}s; flex-shrink: 0;">
                        <div class="card-summary" onclick="this.closest('.facility-card').classList.toggle('active')">
                            <div class="card-top-row">
                                <span class="material-symbols-rounded icon">restaurant</span>
                                <div style="display: flex; gap: 8px; align-items: center;">
                                    <span class="progress-badge" style="background: rgba(255,255,255,0.2); color: #fff; border: none;">${pendingMeals.length} Meal${pendingMeals.length > 1 ? 's' : ''}</span>
                                    <button class="icon-btn small" style="background: transparent; border: none; padding: 4px;"><span class="material-symbols-rounded" style="font-size: 20px; color: inherit;">more_horiz</span></button>
                                </div>
                            </div>
                            <div>
                                <h3 style="margin-bottom: 0; display: flex; align-items: center;">Meal Plan <span style="font-size: 13px; font-weight: 400; opacity: 0.75; margin-left: 6px;">• Kitchen</span></h3>
                            </div>
                        </div>
                        <div class="card-details">
                            <ul class="task-list" style="list-style: none; padding: 0;">
                                ${mealsHTML}
                            </ul>
                        </div>
                    </section>
                `;
                container.innerHTML += mealCardHTML;
            }
        }

        // If completely empty initially, show the All Caught Up state
        if (container.children.length === 0) {
            container.innerHTML = `
                <section class="facility-card green animate-fade-up" style="margin-bottom: 0; width: 100%; max-width: 100%;">
                    <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 40px 20px; text-align: center; color: white;">
                        <span class="material-symbols-rounded icon" style="font-size: 56px; margin-bottom: 16px; background: rgba(255,255,255,0.2); padding: 20px; border-radius: 50%; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">celebration</span>
                        <h3 style="margin: 0 0 8px 0; font-size: 24px; font-weight: 700; text-shadow: 0 2px 5px rgba(0,0,0,0.1);">All Caught Up!</h3>
                        <p style="opacity: 0.8; font-size: 15px; margin: 0;">You have completed all priority tasks for today.</p>
                    </div>
                </section>`;
        }

        // 6. Update progress widget
        if (window.updateHouseholdProgressWidget) {
            window.updateHouseholdProgressWidget();
        }
    };

    window.renderPriorityCards = renderPriorityCards;
    renderPriorityCards();

    const renderZoneDropdowns = () => {
        const zones = getZones();
        const zoneFilter = document.getElementById('zoneFilter');

        if (zoneFilter) {
            const currentVal = zoneFilter.value || 'all';
            zoneFilter.innerHTML = '<option value="all">All Zones</option>';
            zones.forEach(z => {
                zoneFilter.innerHTML += `<option value="${z.id}">${z.name}</option>`;
            });
            zoneFilter.innerHTML += `<option value="__add_new__" style="font-weight: bold; color: var(--primary-purple);">+ Add New Zone...</option>`;
            zoneFilter.value = currentVal;
        }
    };

    // --- EVENT LISTENERS ---

    // Add Zone Modal Logic
    const addZoneModal = document.getElementById('addZoneModal');
    const newZoneNameInput = document.getElementById('newZoneNameInput');
    const newZoneIconInput = document.getElementById('newZoneIconInput');
    const newZoneColorInput = document.getElementById('newZoneColorInput');
    const zoneIconOptions = document.querySelectorAll('#zoneIconGrid .icon-option');
    const zoneColorOptions = document.querySelectorAll('#zoneColorGrid .color-swatch');
    
    const closeZoneModalBtn = document.getElementById('closeZoneModalBtn');
    const cancelZoneBtn = document.getElementById('cancelZoneBtn');
    const saveZoneBtn = document.getElementById('saveZoneBtn');

    const closeAddZoneModal = () => {
        addZoneModal.classList.remove('active');
        setTimeout(() => {
            addZoneModal.style.display = 'none';
        }, 300); // Wait for opacity transition
        newZoneNameInput.value = '';
        
        // Reset selections
        if(zoneIconOptions.length) {
            zoneIconOptions.forEach(o => o.classList.remove('selected'));
            zoneIconOptions[0].classList.add('selected');
            if(newZoneIconInput) newZoneIconInput.value = zoneIconOptions[0].getAttribute('data-icon');
        }
        if(zoneColorOptions.length) {
            zoneColorOptions.forEach(o => o.classList.remove('selected'));
            zoneColorOptions[0].classList.add('selected');
            if(newZoneColorInput) newZoneColorInput.value = zoneColorOptions[0].getAttribute('data-color');
        }
    };

    // Zone Icon & Color Selections
    zoneIconOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            zoneIconOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            newZoneIconInput.value = opt.getAttribute('data-icon');
        });
    });

    zoneColorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            zoneColorOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            newZoneColorInput.value = opt.getAttribute('data-color');
        });
    });

    [closeZoneModalBtn, cancelZoneBtn].forEach(btn => {
        if(btn) btn.addEventListener('click', closeAddZoneModal);
    });

    if (saveZoneBtn) {
        saveZoneBtn.addEventListener('click', () => {
            const newZoneName = newZoneNameInput.value.trim();
            const newZoneIcon = newZoneIconInput ? newZoneIconInput.value : 'layers';
            const newZoneColor = newZoneColorInput ? newZoneColorInput.value : 'purple';
            if (newZoneName) {
                const zones = getZones();
                const newZoneId = 'zone-' + Date.now();
                zones.push({ id: newZoneId, name: newZoneName, icon: newZoneIcon, color: newZoneColor });
                localStorage.setItem('homeZones', JSON.stringify(zones));
                renderZoneDropdowns();
                const zoneFilter = document.getElementById('zoneFilter');
                if(zoneFilter) zoneFilter.value = newZoneId;
                window.loadFacilitiesToDashboard();
                closeAddZoneModal();
            }
        });
    }

    // Zone Filter change listener
    const zoneFilter = document.getElementById('zoneFilter');
    if (zoneFilter) {
        zoneFilter.addEventListener('change', (e) => {
            if (e.target.value === '__add_new__') {
                // Open Add Zone Modal
                zoneFilter.value = 'all'; // reset temporarily
                addZoneModal.style.display = 'flex';
                // Small delay to allow display block to render before triggering opacity transition
                setTimeout(() => addZoneModal.classList.add('active'), 10);
                newZoneNameInput.focus();
                return; // don't load facilities yet
            }
            window.loadFacilitiesToDashboard();
        });
    }

    // Default mock data (Beautiful initial state)
    const defaultFacilities = [
        {
            id: 'default-living',
            name: 'Living Room',
            icon: 'chair',
            color: 'purple',
            zone: 'main-floor',
            tasks: [
                { name: 'Tidy Up (Daily)', icon: 'cleaning_services' },
                { name: 'Vacuum House (Weekly)', icon: 'vacuum' },
                { name: 'Dust Furniture, Doors & Cabinets (Monthly)', icon: 'dry_cleaning' }
            ]
        },
        {
            id: 'default-kitchen',
            name: 'Kitchen',
            icon: 'kitchen',
            color: 'yellow',
            zone: 'main-floor',
            tasks: [
                { name: 'Wash Dishes (Daily)', icon: 'local_dining' },
                { name: 'Cook Lunch & Dinner (Daily)', icon: 'restaurant' },
                { name: 'Wash Sink (Daily)', icon: 'countertops' },
                { name: 'Take Out Trash (2 Days)', icon: 'delete' },
                { name: 'Wipe Counters & Stove (Weekly)', icon: 'cleaning_services' },
                { name: 'Kitchen Dusting (Weekly/Monthly)', icon: 'dry_cleaning' },
                { name: 'Wash Kitchen Floor (Bi-weekly)', icon: 'mop' },
                { name: 'Defrost Fridge (Every 25 Days)', icon: 'kitchen' }
            ]
        },
        {
            id: 'default-bedroom',
            name: 'Bedroom',
            icon: 'bed',
            color: 'green',
            zone: 'main-floor',
            tasks: [
                { name: 'Make Bed (Daily)', icon: 'bed' },
                { name: 'Organize Clothes (Weekly)', icon: 'checkroom' },
                { name: 'Vacuum (Weekly)', icon: 'vacuum' },
                { name: 'Dust Room, Decor, Mirror & Desk (Monthly)', icon: 'dry_cleaning' },
                { name: 'Change Sheets (Bi-weekly)', icon: 'laundry' }
            ]
        },
        {
            id: 'default-bath',
            name: 'Bathroom',
            icon: 'bathtub',
            color: 'cyan',
            zone: 'main-floor',
            tasks: [
                { name: 'Wash Bathroom (Short Term)', icon: 'shower' },
                { name: 'Deep Clean w/ Disinfectant (Monthly)', icon: 'cleaning_services' },
                { name: 'Wash Towels (Weekly)', icon: 'dry_cleaning' }
            ]
        },
        {
            id: 'default-toilet',
            name: 'Restroom',
            icon: 'wc',
            color: 'orange',
            zone: 'main-floor',
            tasks: [
                { name: 'Wash Toilet (Short Term)', icon: 'wc' },
                { name: 'Deep Clean w/ Disinfectant (Monthly)', icon: 'cleaning_services' },
                { name: 'Empty Trash (Weekly)', icon: 'delete' }
            ]
        }
    ];

    let editingSpaceId = null;

    // --- 1. RENDER FACILITIES & GHOST CARD ---
    window.loadFacilitiesToDashboard = () => {
        let facilitiesRaw = localStorage.getItem('homeFacilities');
        let facilities = facilitiesRaw ? JSON.parse(facilitiesRaw) : null;
        
        // Only load defaults if it's the very first visit (null) OR if it's the old legacy default-1
        if (facilities === null || (facilities.length === 1 && facilities[0].id === 'default-1')) {
            facilities = defaultFacilities;
            localStorage.setItem('homeFacilities', JSON.stringify(facilities));
        }

        // Apply Zone Filter
        const zoneFilterEl = document.getElementById('zoneFilter');
        const zoneFilterIcon = document.getElementById('zoneFilterIcon');
        const currentZone = zoneFilterEl ? zoneFilterEl.value : 'all';
        let filteredFacilities = facilities;
        
        if (zoneFilterIcon) {
            if (currentZone === 'all') {
                zoneFilterIcon.textContent = 'layers';
                zoneFilterIcon.style.color = 'var(--text-muted)';
            } else {
                const zones = getZones();
                const z = zones.find(x => x.id === currentZone);
                if (z) {
                    zoneFilterIcon.textContent = z.icon || 'layers';
                    zoneFilterIcon.style.color = `var(--primary-${z.color || 'purple'}, #8c52ff)`;
                }
            }
        }

        if (currentZone !== 'all') {
            filteredFacilities = facilities.filter(f => f.zone === currentZone);
        }

        // Capture currently active (expanded) cards
        const activeCards = [];
        document.querySelectorAll('.facility-card.active').forEach(card => {
            const btn = card.querySelector('.edit-space-btn');
            if (btn) activeCards.push(btn.getAttribute('data-id'));
        });

        facilitiesGrid.innerHTML = ''; 
        
        let pendingTasksCount = 0;
        let totalTasksCount = 0;
        let spacesNeedingAttention = 0;

        filteredFacilities.forEach((fac, index) => {
            const facTotalTasks = fac.tasks ? fac.tasks.length : 0;
            const facCompletedTasks = 0; // Defaulting to 0 since completion status isn't tracked yet in mock data
            
            totalTasksCount += facTotalTasks;
            pendingTasksCount += (facTotalTasks - facCompletedTasks);
            
            if (facTotalTasks > facCompletedTasks) {
                spacesNeedingAttention++;
            }

            const card = document.createElement('div');
            card.className = `facility-card ${fac.color} animate-fade-up`;
            card.style.animationDelay = `${0.2 + (index * 0.1)}s`;

            let tasksHTML = '';
            if (fac.tasks && fac.tasks.length > 0) {
                fac.tasks.forEach(task => {
                    const taskName = typeof task === 'string' ? task : task.name;
                    const taskIcon = typeof task === 'string' ? 'check_circle' : task.icon;

                    let avatarImg = '';
                    const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
                    const actualTask = scheduledTasks.find(st => (st.title === taskName || st.name === taskName) && (st.room === fac.id || st.roomId === fac.id || st.room === fac.name));
                    
                    let targetAssignees = [];
                    if (actualTask && actualTask.assignees && actualTask.assignees.length > 0) {
                        targetAssignees = actualTask.assignees;
                    } else if (task.assignees && task.assignees.length > 0) {
                        targetAssignees = task.assignees;
                    }
                    
                    if (targetAssignees.length > 0 && targetAssignees[0] !== 'Me' && targetAssignees[0] !== 'Anyone') {
                        avatarImg = '<div style="display:flex; margin-left: 4px;">';
                        targetAssignees.forEach((assignName, idx) => {
                            const zIndex = 10 - idx;
                            const margin = idx > 0 ? '-6px' : '0';
                            if (window.getAssigneeAvatarHTML) {
                                avatarImg += `<div style="z-index: ${zIndex}; margin-left: ${margin};">${window.getAssigneeAvatarHTML(assignName, 'var(--primary-purple)')}</div>`;
                            }
                        });
                        avatarImg += '</div>';
                    }

                    const taskIdAttr = actualTask ? `data-task-id="${actualTask.id}"` : '';
                    tasksHTML += `
                        <li class="task-item-clickable" data-task-name="${taskName}" data-task-icon="${taskIcon}" data-facility-id="${fac.id}" ${taskIdAttr}>
                            <span class="task-text" style="display:flex; align-items:center; gap:6px;">
                                <span class="material-symbols-rounded" style="font-size: 16px; color: #9ca3af;">${taskIcon}</span>
                                ${taskName}
                            </span>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <span style="font-size: 11px; color: #9ca3af; font-weight: 500;">All Day</span>
                                ${avatarImg}
                            </div>
                        </li>
                    `;
                });
            } else {
                tasksHTML = `<li style="color: #9ca3af; font-size: 13px; font-style: italic; display: block; text-align: center; margin-top: 10px;">No routine tasks setup yet.</li>`;
            }

            let zoneBadgeHTML = '';
            const allZones = getZones();
            const spaceZone = allZones.find(z => z.id === fac.zone);
            if (spaceZone && currentZone === 'all') {
                zoneBadgeHTML = `<span style="font-size: 13px; font-weight: 400; opacity: 0.75; margin-left: 6px;">• ${spaceZone.name}</span>`;
            }

            card.innerHTML = `
                <div class="card-summary">
                    <div class="card-top-row">
                        <span class="material-symbols-rounded icon">${fac.icon}</span>
                        <div style="display: flex; gap: 8px; align-items: center;">
                            <span class="progress-badge">0/${fac.tasks ? fac.tasks.length : 0} Done</span>
                            <button class="icon-btn small edit-space-btn" data-id="${fac.id}" style="background: transparent; border: none; padding: 4px;"><span class="material-symbols-rounded" style="font-size: 20px;">more_horiz</span></button>
                        </div>
                    </div>
                    <div>
                        <h3 style="margin-bottom: 0; display: flex; align-items: center;">${fac.name} ${zoneBadgeHTML}</h3>
                    </div>
                </div>
                <div class="card-details">
                    <ul class="task-list">
                        ${tasksHTML}
                    </ul>
                </div>
            `;
            facilitiesGrid.appendChild(card);
        });

        // Update Header Stats
        const pendingStatText = document.getElementById('pendingTasksText');
        if (pendingStatText) {
            pendingStatText.textContent = `${pendingTasksCount} Tasks Left`;
        }
        
        const spacesLeftText = document.getElementById('spacesLeftText');
        if (spacesLeftText) {
            spacesLeftText.textContent = `${spacesNeedingAttention} Spaces`;
        }

        const overallProgressText = document.getElementById('overallProgressText');
        const overallProgressBar = document.getElementById('overallProgressBar');
        if (overallProgressText && overallProgressBar) {
            let progressPercent = 0;
            if (totalTasksCount > 0) {
                progressPercent = Math.round(((totalTasksCount - pendingTasksCount) / totalTasksCount) * 100);
            }
            overallProgressText.textContent = `${progressPercent}%`;
            overallProgressBar.style.width = `${progressPercent}%`;
        }

        // Add Ghost Card (Trigger for Wizard Create)
        const ghostCard = document.createElement('div');
        ghostCard.className = `facility-card add-new animate-fade-up`;
        ghostCard.style.animationDelay = `${0.2 + (filteredFacilities.length * 0.1)}s`;
        ghostCard.innerHTML = `
            <span class="material-symbols-rounded icon">add_circle</span>
            <p>Add New Space</p>
        `;
        ghostCard.addEventListener('click', () => openWizard(null));
        facilitiesGrid.appendChild(ghostCard);

        // Re-attach accordion functionality and restore active state
        const facilityCards = facilitiesGrid.querySelectorAll('.facility-card:not(.add-new)');
        facilityCards.forEach(card => {
            const btn = card.querySelector('.edit-space-btn');
            if (btn && activeCards.includes(btn.getAttribute('data-id'))) {
                card.classList.add('active');
            }
            
            const summary = card.querySelector('.card-summary');
            if (summary) {
                summary.addEventListener('click', (e) => {
                    // Prevent accordion if clicking edit button
                    if (e.target.closest('.edit-space-btn')) return;
                    card.classList.toggle('active');
                });
            }
        });

        // Attach edit handlers
        document.querySelectorAll('.edit-space-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent accordion
                openWizard(e.currentTarget.getAttribute('data-id'));
            });
        });

        // Attach click handlers to tasks to open the quick add/edit modal
        document.querySelectorAll('.task-item-clickable').forEach(item => {
            item.addEventListener('click', (e) => {
                e.stopPropagation(); // prevent accordion
                const taskName = e.currentTarget.getAttribute('data-task-name');
                const taskIcon = e.currentTarget.getAttribute('data-task-icon');
                const facilityId = e.currentTarget.getAttribute('data-facility-id');
                const taskId = e.currentTarget.getAttribute('data-task-id');
                
                const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
                let actualTask = null;
                if (taskId) {
                    actualTask = scheduledTasks.find(st => String(st.id) === String(taskId));
                }
                if (!actualTask) {
                    actualTask = scheduledTasks.find(st => (st.title === taskName || st.name === taskName) && (st.room === facilityId || st.roomId === facilityId));
                }
                if (!actualTask) {
                    actualTask = scheduledTasks.find(st => (st.title === taskName || st.name === taskName));
                }
                
                if (typeof window.openQuickAddModal === 'function') {
                    if (actualTask) {
                        window.openQuickAddModal(
                            actualTask.title || actualTask.name || taskName,
                            actualTask.roomId || actualTask.room || facilityId,
                            actualTask.icon || taskIcon,
                            actualTask.startDate || actualTask.date,
                            actualTask
                        );
                    } else {
                        window.openQuickAddModal(taskName, facilityId, taskIcon);
                    }
                }
            });
        });
    };


    // --- 2. SETUP WIZARD LOGIC ---
    const wizardModal = document.getElementById('setupWizardModal');
    const closeWizardBtn = document.getElementById('closeWizardBtn');
    
    const stepIndicators = document.querySelectorAll('.wizard-steps .step');
    const stepPanes = document.querySelectorAll('.wizard-step-pane');
    const nextBtn = document.getElementById('wizardNextBtn');
    const prevBtn = document.getElementById('wizardPrevBtn');
    const submitBtn = document.getElementById('wizardSubmitBtn');
    const deleteBtn = document.getElementById('wizardDeleteBtn');
    const wizardHeaderTitle = document.querySelector('.wizard-header h2');
    
    // Form Inputs
    const spaceNameInput = document.getElementById('wizardSpaceName');
    const templatesContainer = document.getElementById('wizardTemplatesContainer');
    const iconOptions = document.querySelectorAll('#wizardIconGrid .icon-option');
    const colorOptions = document.querySelectorAll('#wizardColorGrid .color-swatch');
    const iconInput = document.getElementById('wizardIcon');
    const colorInput = document.getElementById('wizardColor');
    
    // Task Inputs
    const newTaskInput = document.getElementById('wizardNewTask');
    const addTaskBtn = document.getElementById('wizardAddTaskBtn');
    const taskList = document.getElementById('wizardTaskList');
    const taskIconBtn = document.getElementById('taskIconBtn');
    const taskIconDropdown = document.getElementById('taskIconDropdown');
    const wizardTaskIconInput = document.getElementById('wizardTaskIcon');
    
    let currentStep = 1;
    let pendingTasks = [];

    // --- TEMPLATES LOGIC ---
    const spaceTemplates = [
        {
            name: 'Kitchen',
            icon: 'kitchen',
            color: 'yellow',
            zone: 'main-floor',
            tasks: [
                { name: 'Wipe Countertops', icon: 'cleaning_services' },
                { name: 'Clean Microwave', icon: 'microwave' },
                { name: 'Organize Fridge', icon: 'kitchen' },
                { name: 'Load Dishwasher', icon: 'restaurant' },
                { name: 'Take Out Trash', icon: 'delete' }
            ]
        },
        {
            name: 'Bathroom',
            icon: 'bathtub',
            color: 'cyan',
            zone: 'main-floor',
            tasks: [
                { name: 'Scrub Toilet', icon: 'wc' },
                { name: 'Clean Mirrors', icon: 'window' },
                { name: 'Clean Bathtub', icon: 'bathtub' },
                { name: 'Restock Soap & TP', icon: 'sanitizer' }
            ]
        },
        {
            name: 'Living Room',
            icon: 'chair',
            color: 'purple',
            zone: 'main-floor',
            tasks: [
                { name: 'Vacuum Carpet', icon: 'cleaning_services' },
                { name: 'Dust TV & Shelves', icon: 'tv' },
                { name: 'Tidy Couch', icon: 'weekend' },
                { name: 'Water Plants', icon: 'potted_plant' }
            ]
        },
        {
            name: 'Bedroom',
            icon: 'bed',
            color: 'blue',
            zone: 'main-floor',
            tasks: [
                { name: 'Make the Bed', icon: 'bed' },
                { name: 'Organize Closet', icon: 'checkroom' },
                { name: 'Fold Clothes', icon: 'local_laundry_service' }
            ]
        },
        {
            name: 'Yard',
            icon: 'yard',
            color: 'green',
            zone: 'main-floor',
            tasks: [
                { name: 'Water Garden', icon: 'yard' },
                { name: 'Sweep Patio', icon: 'mop' },
                { name: 'Feed Pets', icon: 'pets' }
            ]
        }
    ];

    const renderTemplates = () => {
        if (!templatesContainer) return;
        templatesContainer.innerHTML = '';
        spaceTemplates.forEach(template => {
            const chip = document.createElement('div');
            chip.className = 'template-chip';
            chip.innerHTML = `<span class="material-symbols-rounded" style="color: var(--primary-${template.color});">${template.icon}</span> ${template.name}`;
            chip.addEventListener('click', () => applyTemplate(template));
            templatesContainer.appendChild(chip);
        });
    };

    const applyTemplate = (template) => {
        spaceNameInput.value = template.name;
        
        // Select Icon
        iconOptions.forEach(o => o.classList.remove('selected'));
        const targetIconOpt = Array.from(iconOptions).find(o => o.getAttribute('data-icon') === template.icon);
        if (targetIconOpt) targetIconOpt.classList.add('selected');
        iconInput.value = template.icon;

        // Select Color
        colorOptions.forEach(o => o.classList.remove('selected'));
        const targetColorOpt = Array.from(colorOptions).find(o => o.getAttribute('data-color') === template.color);
        if (targetColorOpt) targetColorOpt.classList.add('selected');
        colorInput.value = template.color;

        // Populate Tasks
        pendingTasks = [...template.tasks];
        renderPendingTasks();

        // Jump to Step 3
        currentStep = 3;
        updateWizardUI();
    };

    const openWizard = (spaceId = null) => {
        editingSpaceId = spaceId;
        if(wizardModal) {
            wizardModal.classList.add('active');
            currentStep = 1;
            document.getElementById('setupWizardForm').reset();
            pendingTasks = [];
            
            if (editingSpaceId) {
                // EDIT MODE
                wizardHeaderTitle.textContent = "Edit Space";
                deleteBtn.style.display = 'block';
                
                // Hide templates in edit mode
                const templatesSec = document.getElementById('templatesSection');
                if(templatesSec) templatesSec.style.display = 'none';
                
                const facilities = JSON.parse(localStorage.getItem('homeFacilities')) || [];
                const space = facilities.find(f => f.id === editingSpaceId);
                
                if (space) {
                    spaceNameInput.value = space.name;
                    
                    // Set visual pickers
                    iconOptions.forEach(o => o.classList.remove('selected'));
                    const targetIconOpt = Array.from(iconOptions).find(o => o.getAttribute('data-icon') === space.icon);
                    if (targetIconOpt) targetIconOpt.classList.add('selected');
                    iconInput.value = space.icon;

                    colorOptions.forEach(o => o.classList.remove('selected'));
                    const targetColorOpt = Array.from(colorOptions).find(o => o.getAttribute('data-color') === space.color);
                    if (targetColorOpt) targetColorOpt.classList.add('selected');
                    colorInput.value = space.color;

                    // Set tasks
                    pendingTasks = (space.tasks || []).map(t => {
                        return typeof t === 'string' ? {name: t, icon: 'check_circle'} : t;
                    });
                }
            } else {
                // CREATE MODE
                wizardHeaderTitle.textContent = "Add New Space";
                deleteBtn.style.display = 'none';
                
                // Show templates in create mode
                const templatesSec = document.getElementById('templatesSection');
                if(templatesSec) templatesSec.style.display = 'block';

                spaceNameInput.value = '';

                // reset visual pickers
                iconOptions.forEach(o => o.classList.remove('selected'));
                iconOptions[0].classList.add('selected');
                iconInput.value = iconOptions[0].getAttribute('data-icon');

                colorOptions.forEach(o => o.classList.remove('selected'));
                colorOptions[0].classList.add('selected');
                colorInput.value = colorOptions[0].getAttribute('data-color');
            }

            renderPendingTasks();
            updateWizardUI();
            if(!editingSpaceId) renderTemplates();
            setTimeout(() => spaceNameInput.focus(), 300);
        }
    };

    const closeWizard = () => {
        if(wizardModal) wizardModal.classList.remove('active');
        editingSpaceId = null;
    };

    if(closeWizardBtn) closeWizardBtn.addEventListener('click', closeWizard);

    const updateWizardUI = () => {
        stepPanes.forEach((pane, idx) => {
            if (idx + 1 === currentStep) pane.classList.add('active');
            else pane.classList.remove('active');
        });

        stepIndicators.forEach((indicator, idx) => {
            indicator.classList.remove('active', 'completed');
            if (idx + 1 < currentStep) indicator.classList.add('completed');
            else if (idx + 1 === currentStep) indicator.classList.add('active');
        });

        if (currentStep === 1) {
            prevBtn.style.visibility = 'hidden';
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
            deleteBtn.style.display = editingSpaceId ? 'block' : 'none';
        } else if (currentStep === 3) {
            prevBtn.style.visibility = 'visible';
            nextBtn.style.display = 'none';
            submitBtn.style.display = 'block';
            deleteBtn.style.display = 'none';
        } else {
            prevBtn.style.visibility = 'visible';
            nextBtn.style.display = 'block';
            submitBtn.style.display = 'none';
            deleteBtn.style.display = 'none';
        }
    };

    nextBtn.addEventListener('click', () => {
        if (currentStep === 1 && !spaceNameInput.value.trim()) {
            alert('Please enter a space name.');
            spaceNameInput.focus();
            return;
        }
        if (currentStep < 3) {
            currentStep++;
            updateWizardUI();
        }
    });

    prevBtn.addEventListener('click', () => {
        if (currentStep > 1) {
            currentStep--;
            updateWizardUI();
        }
    });

    // Selections
    iconOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            iconOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            iconInput.value = opt.getAttribute('data-icon');
        });
    });

    colorOptions.forEach(opt => {
        opt.addEventListener('click', () => {
            colorOptions.forEach(o => o.classList.remove('selected'));
            opt.classList.add('selected');
            colorInput.value = opt.getAttribute('data-color');
        });
    });

    // Task Icon Dropdown Logic
    taskIconBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        taskIconDropdown.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.task-icon-selector')) {
            taskIconDropdown.classList.remove('active');
        }
    });

    taskIconDropdown.querySelectorAll('.material-symbols-rounded').forEach(iconEl => {
        iconEl.addEventListener('click', () => {
            const selectedIco = iconEl.getAttribute('data-icon');
            wizardTaskIconInput.value = selectedIco;
            taskIconBtn.innerHTML = `<span class="material-symbols-rounded">${selectedIco}</span>`;
            taskIconDropdown.classList.remove('active');
        });
    });

    // Auto-suggest Icon Logic based on Task Name
    const iconKeywords = {
        'cleaning_services': ['clean', 'sweep', 'dust', 'tidy', 'گردگیری', 'خاک', 'تمیز', 'نظافت'],
        'vacuum': ['vacuum', 'carpet', 'rug', 'hoover', 'جارو', 'جاروبرقی', 'فرش', 'موکت'],
        'mop': ['mop', 'floor', 'طی', 'زمین', 'کف', 'سرامیک'],
        'window': ['window', 'glass', 'mirror', 'پنجره', 'شیشه', 'آینه'],
        'sanitizer': ['sanitize', 'disinfect', 'spray', 'ضدعفونی', 'اسپری'],
        'delete': ['trash', 'garbage', 'bin', 'empty', 'throw', 'waste', 'زباله', 'آشغال', 'سطل', 'دور انداختن'],
        'local_laundry_service': ['laundry', 'wash', 'clothes', 'fold', 'لباس', 'رخت', 'شستشو', 'ماشین'],
        'iron': ['iron', 'clothes', 'اتو'],
        'inventory_2': ['organize', 'put away', 'box', 'مرتب', 'چیدن', 'جمع کردن', 'کمد', 'کابینت'],
        'bed': ['bed', 'sheets', 'pillow', 'تخت', 'ملافه', 'خواب', 'بالش'],
        'shower': ['shower', 'bath', 'حمام', 'دوش'],
        'wc': ['toilet', 'restroom', 'دستشویی', 'توالت'],
        'restaurant': ['cook', 'dinner', 'lunch', 'meal', 'food', 'آشپزی', 'غذا', 'شام', 'ناهار', 'پختن', 'ظرف', 'ظروف'],
        'shopping_cart': ['shop', 'groceries', 'buy', 'store', 'خرید', 'فروشگاه', 'سوپر'],
        'water_drop': ['water', 'spill', 'آب'],
        'yard': ['yard', 'garden', 'mow', 'grass', 'weeds', 'حیاط', 'باغچه', 'آبیاری'],
        'pets': ['dog', 'cat', 'pet', 'walk', 'feed', 'سگ', 'گربه', 'حیوان'],
        'microwave': ['microwave', 'مایکروویو', 'مایکروفر'],
        'tv': ['tv', 'television', 'تلویزیون', 'میز تلویزیون'],
        'blender': ['blender', 'mix', 'مخلوط'],
        'weekend': ['couch', 'sofa', 'مبل', 'کاناپه'],
        'potted_plant': ['plant', 'flower', 'گلدان'],
        'checkroom': ['closet', 'hanger', 'کمد لباس', 'جالباسی'],
        'soap': ['soap', 'detergent', 'صابون', 'مایع', 'شوینده'],
        'dry_cleaning': ['dust', 'wipe', 'گردگیری'],
        'build': ['fix', 'repair', 'maintenance', 'wrench', 'تعمیر', 'آچار', 'خراب', 'درست کردن'],
        'local_florist': ['plant', 'flower', 'water', 'گل', 'گیاه', 'گلدان', 'آب دادن'],
        'payments': ['bill', 'pay', 'rent', 'قبض', 'پرداخت', 'قسط', 'شارژ', 'اجاره', 'بانک'],
        'kitchen': ['kitchen', 'fridge', 'oven', 'stove', 'آشپزخانه', 'یخچال', 'اجاق', 'گاز'],
        'bathtub': ['bathtub', 'tub', 'وان', 'حمام'],
        'chair': ['chair', 'seat', 'صندلی', 'نشیمن'],
        'garage': ['garage', 'car', 'parking', 'گاراژ', 'پارکینگ', 'ماشین', 'خودرو'],
        'deck': ['deck', 'patio', 'balcony', 'terrace', 'بالکن', 'تراس', 'حیاط خلوت'],
        'stairs': ['stair', 'step', 'پله', 'راه پله']
    };

    newTaskInput.addEventListener('input', (e) => {
        const text = e.target.value.toLowerCase();
        let suggestedIcon = 'check_circle'; // default

        for (const [icon, keywords] of Object.entries(iconKeywords)) {
            if (keywords.some(keyword => text.includes(keyword))) {
                suggestedIcon = icon;
                break;
            }
        }

        wizardTaskIconInput.value = suggestedIcon;
        taskIconBtn.innerHTML = `<span class="material-symbols-rounded">${suggestedIcon}</span>`;
    });

    let editingTaskIndex = null;

    const resetTaskInput = () => {
        newTaskInput.value = '';
        wizardTaskIconInput.value = 'check_circle';
        taskIconBtn.innerHTML = `<span class="material-symbols-rounded">check_circle</span>`;
        editingTaskIndex = null;
        addTaskBtn.innerHTML = `<span class="material-symbols-rounded">add</span>`;
        addTaskBtn.style.backgroundColor = ''; // default purple
    };

    // Tasks logic
    const renderPendingTasks = () => {
        taskList.innerHTML = '';
        pendingTasks.forEach((task, index) => {
            const li = document.createElement('li');
            li.innerHTML = `
                <span style="display:flex; align-items:center; gap:8px;">
                    <span class="material-symbols-rounded" style="color:#9ca3af; font-size:18px;">${task.icon}</span>
                    ${task.name}
                </span>
                <div style="display: flex; gap: 4px;">
                    <button type="button" class="edit-task-btn" data-index="${index}"><span class="material-symbols-rounded" style="font-size: 18px; color: #3b82f6;">edit</span></button>
                    <button type="button" class="delete-task-btn" data-index="${index}"><span class="material-symbols-rounded" style="font-size: 18px; color: #ef4444;">close</span></button>
                </div>
            `;
            
            // Delete
            li.querySelector('.delete-task-btn').addEventListener('click', () => {
                pendingTasks.splice(index, 1);
                if(editingTaskIndex === index) resetTaskInput();
                renderPendingTasks();
            });

            // Edit
            li.querySelector('.edit-task-btn').addEventListener('click', () => {
                editingTaskIndex = index;
                newTaskInput.value = task.name;
                wizardTaskIconInput.value = task.icon;
                taskIconBtn.innerHTML = `<span class="material-symbols-rounded">${task.icon}</span>`;
                addTaskBtn.innerHTML = `<span class="material-symbols-rounded">check</span>`;
                addTaskBtn.style.backgroundColor = '#10b981'; // green for save
                newTaskInput.focus();
            });

            taskList.appendChild(li);
        });
    };

    const handleAddTask = () => {
        const text = newTaskInput.value.trim();
        const icon = wizardTaskIconInput.value;
        if (text) {
            if (editingTaskIndex !== null) {
                pendingTasks[editingTaskIndex] = { name: text, icon: icon };
            } else {
                pendingTasks.push({ name: text, icon: icon });
            }
            resetTaskInput();
            renderPendingTasks();
            newTaskInput.focus();
        }
    };

    addTaskBtn.addEventListener('click', handleAddTask);
    newTaskInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTask();
        }
    });

    // Submit Wizard (Create or Edit)
    submitBtn.addEventListener('click', () => {
        const name = spaceNameInput.value.trim();
        const icon = iconInput.value;
        const color = colorInput.value;
        
        // Inherit zone from filter
        const zFilter = document.getElementById('zoneFilter');
        let zone = (zFilter && zFilter.value !== 'all' && zFilter.value !== '__add_new__') 
            ? zFilter.value 
            : (getZones()[0] ? getZones()[0].id : 'main-floor');

        if (!name) {
            alert('Please enter a space name.');
            return;
        }

        const facilities = JSON.parse(localStorage.getItem('homeFacilities')) || [];

        if (editingSpaceId) {
            // Update existing
            const idx = facilities.findIndex(f => f.id === editingSpaceId);
            if (idx !== -1) {
                facilities[idx].name = name;
                facilities[idx].icon = icon;
                facilities[idx].color = color;
                facilities[idx].zone = zone;
                facilities[idx].tasks = pendingTasks;
            }
        } else {
            // Create new
            const newFacility = {
                id: 'space-' + Date.now(),
                name,
                icon,
                color,
                zone,
                tasks: pendingTasks
            };
            facilities.push(newFacility);
        }

        localStorage.setItem('homeFacilities', JSON.stringify(facilities));
        closeWizard();
        window.loadFacilitiesToDashboard();
    });

    // Delete Facility
    deleteBtn.addEventListener('click', () => {
        if (!editingSpaceId) return;
        if (confirm('Are you sure you want to delete this space and all its tasks?')) {
            let existingFacilities = JSON.parse(localStorage.getItem('homeFacilities')) || [];
            existingFacilities = existingFacilities.filter(f => f.id !== editingSpaceId);
            localStorage.setItem('homeFacilities', JSON.stringify(existingFacilities));
            closeWizard();
            window.loadFacilitiesToDashboard();
        }
    });

    // Initialize Dashboard
    renderZoneDropdowns();
    window.loadFacilitiesToDashboard();
});
