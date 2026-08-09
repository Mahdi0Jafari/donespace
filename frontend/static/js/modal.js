/**
 * Quick Add Task Modal Logic
 */
document.addEventListener('DOMContentLoaded', () => {
    const modal = document.getElementById('quickAddModal');
    const closeModalBtn = document.getElementById('closeModalBtn');
    
    // Inputs
    const nameInput = document.getElementById('taskName');
    const descInput = document.getElementById('taskDescription');
    const dateInput = document.getElementById('taskDate');
    const timeInput = document.getElementById('taskTime');
    const roomInput = document.getElementById('taskRoom');
    const recurrenceInput = document.getElementById('taskRecurrence');
    
    // Initialize Flatpickr for date and time for a beautiful native-like UI
    let fpDate;
    if (typeof flatpickr !== 'undefined' && dateInput) {
        fpDate = flatpickr(dateInput, {
            dateFormat: "Y-m-d",
            defaultDate: "today",
            disableMobile: true // Forces the custom UI on mobile devices
        });
    }
    
    let fpTime;
    if (typeof flatpickr !== 'undefined' && timeInput) {
        fpTime = flatpickr(timeInput, {
            enableTime: true,
            noCalendar: true,
            dateFormat: "H:i",
            time_24hr: true,
            disableMobile: true // Forces the custom UI on mobile devices
        });
    }
    
    // UI Groups
    const fixedTaskHeader = document.getElementById('fixedTaskHeader');
    const fixedTaskName = document.getElementById('fixedTaskName');
    const fixedTaskRoom = document.getElementById('fixedTaskRoom');
    const fixedTaskIcon = document.getElementById('fixedTaskIcon');
    const taskNameGroup = document.getElementById('taskNameGroup');
    const taskRoomGroup = document.getElementById('taskRoomGroup');
    const timeInputGroup = document.getElementById('timeInputGroup');
    const weekdayPickerGroup = document.getElementById('weekdayPickerGroup');
    
    // Custom Recurrence UI
    const customRecurrenceGroup = document.getElementById('customRecurrenceGroup');
    const customFrequency = document.getElementById('customFrequency');
    const customInterval = document.getElementById('customInterval');
    const customWeekdayPickerGroup = document.getElementById('customWeekdayPickerGroup');
    const customEndDate = document.getElementById('customEndDate');
    const customEndOccurrences = document.getElementById('customEndOccurrences');
    const recurrenceEndsRadios = document.getElementsByName('recurrenceEnds');
    
    // Toggles
    const taskAllDayToggle = document.getElementById('taskAllDay');
    const rotateToggleContainer = document.getElementById('rotateToggleContainer');
    const taskRotateToggle = document.getElementById('taskRotate');
    const saveBtn = modal ? modal.querySelector('.primary-btn') : null;

    let currentTaskIcon = 'check_circle';
    let isFixedTask = false;

    // Global function to open modal
    window.editingTaskId = null;
    window.openQuickAddModal = (name = '', roomId = 'general', icon = 'check_circle', prefilledDate = null, taskObj = null) => {
        if (!modal) return;
        modal.classList.add('active');
        
        window.editingTaskId = taskObj ? taskObj.id : null;
        
        currentTaskIcon = icon;
        isFixedTask = !!name; // If a name is passed, it's a pre-defined task

        // Dynamically populate room options
        if (roomInput) {
            const facilities = JSON.parse(localStorage.getItem('homeFacilities')) || [];
            roomInput.innerHTML = '<option value="general">General Home</option>';
            facilities.forEach(fac => {
                const opt = document.createElement('option');
                opt.value = fac.id;
                opt.textContent = fac.name;
                roomInput.appendChild(opt);
            });
        }

        // Handle Fixed vs Editable UI
        // Handle Fixed vs Editable UI
        const stickyHeader = document.querySelector('.modal-sticky-header');
        const modalTitle = document.querySelector('.modal-header h2');
        const closeBtn = document.querySelector('.modal-close-btn');
        const stickyFooter = document.querySelector('.modal-actions');
        const primaryBtn = stickyFooter ? stickyFooter.querySelector('.primary-btn') : null;
        const secondaryBtn = stickyFooter ? stickyFooter.querySelector('.secondary-btn') : null;

        if (isFixedTask) {
            fixedTaskHeader.style.display = 'block';
            taskNameGroup.style.display = 'none';
            taskRoomGroup.style.display = 'none';
            
            fixedTaskName.textContent = name;
            fixedTaskIcon.textContent = icon;
            
            // Exact card colors from CSS
            const hexColorMap = {
                'general': '#3b82f6', 
                'default-kitchen': '#ffc107', 
                'default-bath': '#00bcd4', 
                'default-living': '#8c52ff', 
                'default-routines': '#20bf6b' 
            };
            const themeColor = hexColorMap[roomId] || '#8c52ff';
            const isYellow = roomId === 'default-kitchen';
            const textColor = isYellow ? '#333333' : '#ffffff';
            const mutedTextColor = isYellow ? 'rgba(0,0,0,0.6)' : 'rgba(255,255,255,0.8)';
            
            // Apply solid background to header
            if (stickyHeader) {
                stickyHeader.style.backgroundColor = themeColor;
                stickyHeader.style.color = textColor;
                stickyHeader.style.borderBottom = 'none';
                stickyHeader.classList.add('themed-gradient');
            }
            if (modalTitle) modalTitle.style.color = textColor;
            if (closeBtn) closeBtn.style.color = textColor;
            
            // Apply solid background to footer
            if (stickyFooter) {
                stickyFooter.style.backgroundColor = themeColor;
                stickyFooter.style.borderTop = 'none';
                stickyFooter.classList.add('themed-gradient');
            }
            if (primaryBtn) {
                primaryBtn.style.backgroundColor = textColor;
                primaryBtn.style.color = themeColor;
                primaryBtn.style.boxShadow = `0 4px 15px rgba(0,0,0,0.15)`;
            }
            if (secondaryBtn) {
                secondaryBtn.style.backgroundColor = isYellow ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,255,0.2)';
                secondaryBtn.style.color = textColor;
            }
            
            fixedTaskName.style.color = textColor;
            fixedTaskRoom.style.color = mutedTextColor;
            
            // Icon styling (white background, colored icon)
            fixedTaskIcon.style.color = themeColor;
            fixedTaskIcon.style.backgroundColor = '#ffffff';
            fixedTaskIcon.style.boxShadow = `0 4px 15px rgba(0,0,0,0.1)`;
            
            // Map room ID to human readable text
            const roomOptions = Array.from(roomInput.options);
            const foundRoom = roomOptions.find(o => o.value === roomId);
            fixedTaskRoom.textContent = foundRoom ? foundRoom.text : 'General Home';
            
            nameInput.value = name;
            roomInput.value = roomId;
        } else {
            fixedTaskHeader.style.display = 'none';
            taskNameGroup.style.display = 'block';
            taskRoomGroup.style.display = 'block';
            
            // Revert header to white
            if (stickyHeader) {
                stickyHeader.style.backgroundColor = '#ffffff';
                stickyHeader.style.color = '#111827';
                stickyHeader.style.borderBottom = '1px solid #f1f5f9';
                stickyHeader.classList.remove('themed-gradient');
            }
            if (modalTitle) modalTitle.style.color = '#111827';
            if (closeBtn) closeBtn.style.color = '#9ca3af';
            
            // Revert footer to white
            if (stickyFooter) {
                stickyFooter.style.backgroundColor = '#ffffff';
                stickyFooter.style.borderTop = '1px solid #f1f5f9';
                stickyFooter.classList.remove('themed-gradient');
            }
            if (primaryBtn) {
                primaryBtn.style.backgroundColor = '';
                primaryBtn.style.color = '';
                primaryBtn.style.boxShadow = '';
            }
            if (secondaryBtn) {
                secondaryBtn.style.backgroundColor = '';
                secondaryBtn.style.color = '';
            }
            
            nameInput.value = '';
            roomInput.value = (roomId && roomId !== 'null') ? roomId : 'general';
        }

        // Reset fields or prepopulate from taskObj
        descInput.value = taskObj && taskObj.description ? taskObj.description : '';
        recurrenceInput.value = taskObj && taskObj.recurrence ? (['none', 'daily', 'weekly', 'monthly', 'yearly', 'custom'].includes(taskObj.recurrence) ? taskObj.recurrence : 'custom') : 'none';
        weekdayPickerGroup.style.display = 'none';
        customRecurrenceGroup.style.display = 'none';
        customFrequency.value = 'daily';
        customInterval.value = '1';
        customWeekdayPickerGroup.style.display = 'none';
        document.querySelector('input[name="recurrenceEnds"][value="never"]').checked = true;
        customEndDate.disabled = true;
        customEndOccurrences.disabled = true;
        
        document.querySelectorAll('.weekday-circle').forEach(c => c.classList.remove('selected'));
        if (taskObj && taskObj.recurrence === 'weekly' && taskObj.customDays) {
            taskObj.customDays.forEach(day => {
                document.querySelector(`#weekdayPickerGroup .weekday-circle[data-day="${day}"]`)?.classList.add('selected');
                document.querySelector(`#customWeekdayPickerGroup .weekday-circle[data-day="${day}"]`)?.classList.add('selected');
            });
        }
        
        // All Day Toggle Default
        taskAllDayToggle.checked = taskObj ? taskObj.allDay : true;
        timeInputGroup.style.display = taskAllDayToggle.checked ? 'none' : 'block';

        // Set default date and time via flatpickr if available
        let targetDate = prefilledDate;
        if (taskObj && taskObj.startDate) targetDate = taskObj.startDate;
        
        if (targetDate) {
            if (fpDate) {
                fpDate.setDate(targetDate);
            } else if (dateInput) {
                dateInput.value = targetDate;
            }
        } else {
            const today = new Date();
            const yyyy = today.getFullYear();
            const mm = String(today.getMonth() + 1).padStart(2, '0');
            const dd = String(today.getDate()).padStart(2, '0');
            
            if (fpDate) {
                fpDate.setDate(`${yyyy}-${mm}-${dd}`);
            } else if (dateInput) {
                dateInput.value = `${yyyy}-${mm}-${dd}`;
            }
        }
        
        if (taskObj && taskObj.time) {
            if (fpTime) {
                fpTime.setDate(taskObj.time);
            } else if (timeInput) {
                timeInput.value = taskObj.time;
            }
        } else {
            if (fpTime) {
                fpTime.setDate("10:00");
            } else if (timeInput) {
                timeInput.value = '10:00';
            }
        }
        
        // Reset assignees
        const assigneeOptions = document.querySelectorAll('.assignee-option');
        assigneeOptions.forEach(opt => opt.classList.remove('selected'));
        
        if (taskObj && taskObj.assignees && taskObj.assignees.length > 0) {
            taskObj.assignees.forEach(assignee => {
                const opt = Array.from(assigneeOptions).find(o => o.getAttribute('data-user') === assignee);
                if (opt) opt.classList.add('selected');
            });
        } else if (assigneeOptions.length > 0) {
            assigneeOptions[0].classList.add('selected');
        }
        
        if (taskRotateToggle && taskObj) {
            taskRotateToggle.checked = !!taskObj.rotate;
        }
        
        // Trigger change events for visibility logic
        recurrenceInput.dispatchEvent(new Event('change'));
        
        checkRotationToggle();

        // Focus logic
        setTimeout(() => {
            if (!isFixedTask && nameInput) nameInput.focus();
            else if (descInput) descInput.focus();
        }, 100);
    };

    // Close Logic
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    
    // Close Modal
    function closeModal() {
        if (modal) modal.classList.remove('active');
    }
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });
    }

    // Trigger buttons
    document.querySelectorAll('.fab-btn, .agenda-header .icon-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.preventDefault();
            window.openQuickAddModal();
        });
    });

    // All Day Toggle Listener
    if (taskAllDayToggle) {
        taskAllDayToggle.addEventListener('change', (e) => {
            timeInputGroup.style.display = e.target.checked ? 'none' : 'block';
        });
    }

    // Recurrence Listeners
    if (recurrenceInput) {
        recurrenceInput.addEventListener('change', (e) => {
            weekdayPickerGroup.style.display = 'none';
            customRecurrenceGroup.style.display = 'none';
            
            if (e.target.value === 'weekly') {
                weekdayPickerGroup.style.display = 'block';
                if (document.querySelectorAll('#weekdayPickerGroup .weekday-circle.selected').length === 0) {
                    const today = new Date().getDay();
                    document.querySelector(`#weekdayPickerGroup .weekday-circle[data-day="${today}"]`)?.classList.add('selected');
                }
            } else if (e.target.value === 'custom') {
                customRecurrenceGroup.style.display = 'block';
                customFrequency.dispatchEvent(new Event('change'));
            }
        });
    }

    if (customFrequency) {
        customFrequency.addEventListener('change', (e) => {
            if (e.target.value === 'weekly') {
                customWeekdayPickerGroup.style.display = 'block';
                if (document.querySelectorAll('#customWeekdayPickerGroup .weekday-circle.selected').length === 0) {
                    const today = new Date().getDay();
                    document.querySelector(`#customWeekdayPickerGroup .weekday-circle[data-day="${today}"]`)?.classList.add('selected');
                }
            } else {
                customWeekdayPickerGroup.style.display = 'none';
            }
        });
    }

    if (recurrenceEndsRadios) {
        recurrenceEndsRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                const val = e.target.value;
                customEndDate.disabled = (val !== 'date');
                customEndOccurrences.disabled = (val !== 'occurrences');
                if (val === 'date' && !customEndDate.value) {
                    const nextMonth = new Date();
                    nextMonth.setMonth(nextMonth.getMonth() + 1);
                    customEndDate.value = nextMonth.toISOString().split('T')[0];
                }
            });
        });
    }

    // Weekday Circle Click
    document.querySelectorAll('.weekday-circle').forEach(circle => {
        circle.addEventListener('click', () => {
            circle.classList.toggle('selected');
            // Prevent deselecting all
            if (document.querySelectorAll('.weekday-circle.selected').length === 0) {
                circle.classList.add('selected');
            }
        });
    });

    // Assignee Picker Logic
    const taskAssigneePicker = document.getElementById('taskAssigneePicker');
    if (taskAssigneePicker) {
        taskAssigneePicker.addEventListener('click', (e) => {
            const option = e.target.closest('.assignee-option');
            if (option) {
                const user = option.getAttribute('data-user');
                
                if (user === 'Anyone') {
                    // Deselect all others, select Anyone
                    taskAssigneePicker.querySelectorAll('.assignee-option').forEach(opt => opt.classList.remove('selected'));
                    option.classList.add('selected');
                } else {
                    // Toggle the clicked user
                    option.classList.toggle('selected');
                    
                    // Deselect Anyone if a specific user is selected
                    const anyoneOpt = taskAssigneePicker.querySelector('.assignee-option[data-user="Anyone"]');
                    if (anyoneOpt) anyoneOpt.classList.remove('selected');
                    
                    // If no one is selected, fallback to Anyone
                    if (taskAssigneePicker.querySelectorAll('.assignee-option.selected').length === 0) {
                        if (anyoneOpt) anyoneOpt.classList.add('selected');
                        else option.classList.add('selected');
                    }
                }
                
                checkRotationToggle();
            }
        });
    }
    
    function checkRotationToggle() {
        if (!taskAssigneePicker) return;
        const selectedCount = taskAssigneePicker.querySelectorAll('.assignee-option.selected').length;
        if (rotateToggleContainer) {
            if (selectedCount > 1) {
                rotateToggleContainer.style.display = 'flex';
            } else {
                rotateToggleContainer.style.display = 'none';
                if (taskRotateToggle) taskRotateToggle.checked = false;
            }
        }
    }


    // ==========================================
    // Read-Only Event Details Popover Logic
    // ==========================================
    const popover = document.getElementById('eventDetailsPopover');
    const popoverCloseBtn = document.getElementById('popoverCloseBtn');
    const popoverEditBtn = document.getElementById('popoverEditBtn');
    let currentPopoverTask = null;

    const popoverDeleteBtn = document.getElementById('popoverDeleteBtn');
    
    if (popoverCloseBtn) {
        popoverCloseBtn.addEventListener('click', () => {
            if (popover) popover.classList.remove('active');
        });
    }

    if (popoverEditBtn) {
        popoverEditBtn.addEventListener('click', () => {
            if (popover) popover.classList.remove('active');
            if (currentPopoverTask) {
                // Open edit modal with task details
                window.openQuickAddModal(
                    currentPopoverTask.name || currentPopoverTask.title,
                    currentPopoverTask.roomId || currentPopoverTask.room,
                    currentPopoverTask.icon,
                    currentPopoverTask.startDate || currentPopoverTask.date,
                    currentPopoverTask
                );
            }
        });
    }

    if (popoverDeleteBtn) {
        popoverDeleteBtn.addEventListener('click', async () => {
            if (!currentPopoverTask || !currentPopoverTask.id) return;
            if (confirm(`Are you sure you want to delete "${currentPopoverTask.name || currentPopoverTask.title}"?`)) {
                if (window.HomeAPI && window.HomeAPI.deleteTask) {
                    await window.HomeAPI.deleteTask(currentPopoverTask.id);
                } else {
                    let scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
                    scheduledTasks = scheduledTasks.filter(t => t.id !== currentPopoverTask.id);
                    localStorage.setItem('scheduledTasks', JSON.stringify(scheduledTasks));
                    window.location.reload();
                }
                if (popover) popover.classList.remove('active');
                if (window.refreshAllData) window.refreshAllData(); // Refresh UI if possible
            }
        });
    }
    
    if (popover) {
        popover.addEventListener('click', (e) => {
            if (e.target === popover) popover.classList.remove('active');
        });
    }

    window.openEventDetailsPopover = (task, type = 'task') => {
        if (!popover) return;
        currentPopoverTask = task;
        
        // 1. Set Themed Header
        const hexColorMap = {
            'general': '#3b82f6', 
            'default-kitchen': '#ffc107', 
            'default-bath': '#00bcd4', 
            'default-living': '#8c52ff', 
            'default-routines': '#20bf6b' 
        };
        
        let themeColor = '#3b82f6';
        let textColor = '#ffffff';
        let isYellow = false;
        
        if (task.isMeal) {
            themeColor = '#ffc107'; // Yellow for meals
            textColor = '#333333';
            isYellow = true;
        } else {
            const roomId = task.roomId || 'general';
            themeColor = hexColorMap[roomId] || '#3b82f6';
            isYellow = roomId === 'default-kitchen';
            textColor = isYellow ? '#333333' : '#ffffff';
        }
        
        const popoverHeader = document.getElementById('popoverHeader');
        if (popoverHeader) {
            popoverHeader.style.backgroundColor = themeColor;
            popoverHeader.style.color = textColor;
        }
        
        // Add icon to title
        const popoverTitle = document.getElementById('popoverTitle');
        if (task.icon) {
            popoverTitle.innerHTML = `<span class="material-symbols-rounded" style="margin-right: 8px; font-size: 28px; vertical-align: middle;">${task.icon}</span>${task.name || task.title || 'Task'}`;
        } else {
            popoverTitle.textContent = task.name || task.title || 'Task';
        }
        popoverTitle.style.color = textColor;
        
        const actionBtns = [document.getElementById('popoverEditBtn'), document.getElementById('popoverDeleteBtn'), document.getElementById('popoverCloseBtn')];
        actionBtns.forEach(btn => {
            if(btn) btn.style.color = textColor;
        });

        // 2. Set Body Details
        document.getElementById('popoverDate').textContent = task.date || 'Today';
        document.getElementById('popoverTime').textContent = task.allDay ? 'All Day' : (task.time || 'Anytime');
        
        const popoverRoomElement = document.getElementById('popoverRoom');
        const roomIconElement = popoverRoomElement.parentElement.previousElementSibling;
        
        if (task.isMeal) {
            roomIconElement.textContent = 'restaurant';
            popoverRoomElement.textContent = 'Home Kitchen';
        } else {
            roomIconElement.textContent = 'location_on';
            const roomOptions = document.getElementById('taskRoom') ? Array.from(document.getElementById('taskRoom').options) : [];
            const foundRoom = roomOptions.find(o => o.value === task.roomId);
            popoverRoomElement.textContent = foundRoom ? foundRoom.text : 'General Home';
        }
        
        // 3. Set Assignees (Avatars)
        const popoverAssigneesRow = document.getElementById('popoverAssigneesRow');
        const popoverAssignees = document.getElementById('popoverAssignees');
        popoverAssignees.innerHTML = '';
        const assignees = task.assignees && task.assignees.length > 0 ? task.assignees : ['Me'];
        
        // Use real avatars from dashboard.js logic if available
        assignees.forEach(name => {
            if (window.getAssigneeAvatarHTML) {
                const avatarStr = window.getAssigneeAvatarHTML(name, themeColor);
                const tmp = document.createElement('div');
                tmp.innerHTML = avatarStr;
                const node = tmp.firstElementChild;
                if (node) {
                    node.style.width = '32px';
                    node.style.height = '32px';
                    node.style.border = `2px solid ${themeColor}`;
                    node.title = name;
                    popoverAssignees.appendChild(node);
                }
            } else {
                const img = document.createElement('img');
                img.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random`;
                img.alt = name;
                img.title = name;
                img.style.width = '32px';
                img.style.height = '32px';
                img.style.borderRadius = '50%';
                img.style.objectFit = 'cover';
                img.style.border = `2px solid ${themeColor}`;
                popoverAssignees.appendChild(img);
            }
        });
        
        // 4. Set Description
        const descRow = document.getElementById('popoverDescRow');
        const popoverDesc = document.getElementById('popoverDesc');
        
        let finalDesc = task.description || '';
        
        // 5. Recipe Details
        const recipeDetailsRow = document.getElementById('popoverRecipeDetails');
        if (recipeDetailsRow) {
            recipeDetailsRow.style.display = 'none';
            if (task.isMeal && task.recipeId) {
                const homeRecipes = JSON.parse(localStorage.getItem('homeRecipes') || '[]');
                const recipe = homeRecipes.find(r => r.id === task.recipeId);
                
                if (recipe) {
                    recipeDetailsRow.style.display = 'flex';
                    document.getElementById('popoverRecipeTime').textContent = recipe.time ? `${recipe.time} min` : 'Unknown';
                    
                    const ingredientsContainer = document.getElementById('popoverRecipeIngredients');
                    ingredientsContainer.innerHTML = '';
                    if (recipe.ingredients && recipe.ingredients.length > 0) {
                        recipe.ingredients.forEach(ing => {
                            const chip = document.createElement('span');
                            chip.textContent = ing;
                            chip.style.cssText = 'background: var(--surface-main); border: 1px solid var(--border-color); padding: 4px 10px; border-radius: 12px; font-size: 12px; color: var(--text-main); font-weight: 500;';
                            ingredientsContainer.appendChild(chip);
                        });
                    } else {
                        ingredientsContainer.innerHTML = '<span style="font-size: 12px; color: var(--text-muted); font-style: italic;">No ingredients listed</span>';
                    }
                    
                    if (recipe.notes) {
                        finalDesc = recipe.notes; // Use recipe notes if available
                    }
                }
            }
        }
        
        if (finalDesc) {
            popoverDesc.textContent = finalDesc;
            descRow.style.display = 'flex';
        } else {
            descRow.style.display = 'none';
        }

        // 6. Open Popover
        popover.classList.add('active');
    };

    // Save Logic
    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            if (!nameInput.value.trim()) {
                alert("Please enter a task name.");
                return;
            }
            
            const selectedAssignees = Array.from(document.querySelectorAll('.assignee-option.selected'))
                                           .map(opt => opt.getAttribute('data-user'));
                                           
            let finalRecurrence = recurrenceInput.value;
            let finalInterval = 1;
            let finalCustomDays = [];
            let finalEndType = 'never';
            let finalEndDate = null;
            let finalEndOccurrences = null;

            if (finalRecurrence === 'weekly') {
                finalCustomDays = Array.from(document.querySelectorAll('#weekdayPickerGroup .weekday-circle.selected')).map(c => parseInt(c.getAttribute('data-day')));
            } else if (finalRecurrence === 'custom') {
                finalRecurrence = customFrequency.value;
                finalInterval = parseInt(customInterval.value) || 1;
                if (finalRecurrence === 'weekly') {
                    finalCustomDays = Array.from(document.querySelectorAll('#customWeekdayPickerGroup .weekday-circle.selected')).map(c => parseInt(c.getAttribute('data-day')));
                }
                
                const endRadio = document.querySelector('input[name="recurrenceEnds"]:checked');
                finalEndType = endRadio ? endRadio.value : 'never';
                if (finalEndType === 'date') finalEndDate = customEndDate.value;
                if (finalEndType === 'occurrences') finalEndOccurrences = parseInt(customEndOccurrences.value);
            }

            const newTask = {
                id: window.editingTaskId ? window.editingTaskId : 'temp-task-' + Date.now(),
                title: nameInput.value.trim(),
                description: descInput.value.trim(),
                icon: currentTaskIcon,
                room: roomInput.value,
                recurrence: finalRecurrence,
                interval: finalInterval,
                customDays: finalCustomDays,
                endType: finalEndType,
                endDate: finalEndDate,
                endOccurrences: finalEndOccurrences,
                startDate: dateInput.value,
                allDay: taskAllDayToggle.checked,
                time: taskAllDayToggle.checked ? null : timeInput.value,
                assignees: selectedAssignees,
                rotate: taskRotateToggle ? taskRotateToggle.checked : false,
                createdAt: new Date().toISOString()
            };
            
            if (window.HomeAPI) {
                await window.HomeAPI.saveTask(newTask);
            } else {
                const scheduledTasks = JSON.parse(localStorage.getItem('scheduledTasks') || '[]');
                scheduledTasks.push(newTask);
                localStorage.setItem('scheduledTasks', JSON.stringify(scheduledTasks));
            }
            
            closeModal();
            // We don't need to manually refresh here because SSE will broadcast tasks_updated
            // which triggers refreshAllData(). But for immediate local UI feedback we can optionally do it:
            if (window.renderPriorityCards) {
                window.renderPriorityCards();
            }
            if (window.AgendaWidget && typeof window.AgendaWidget.refresh === 'function') {
                window.AgendaWidget.refresh();
            }
        });
    }
});

// Dynamic Modal Builders for Onboarding
window.showCreateHomeModal = function() {
    const existing = document.getElementById('dynamicCreateHomeModal');
    if (existing) existing.remove();

    const modalHTML = `
        <div class="modal-overlay active" id="dynamicCreateHomeModal">
            <div class="modal-content" style="max-width: 400px; padding: 32px 24px;" id="createHomeModalContent">
                <h3 style="margin-bottom: 12px; font-size: 20px;">Create a New Home</h3>
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Set up a new space for you and your family/roommates.</p>
                
                <div class="input-wrap" style="margin-bottom: 24px; position: relative; display: flex; align-items: center;">
                    <span class="material-symbols-rounded" style="position: absolute; left: 16px; color: #9ca3af;">home</span>
                    <input type="text" id="createHomeNameInput" placeholder="Home Name (e.g. My Apartment)" style="width: 100%; padding: 14px 16px 14px 48px; border: 1px solid #e5e7eb; border-radius: 12px; font-size: 15px; outline: none;">
                </div>

                <div style="display: flex; gap: 12px; justify-content: space-between;">
                    <button class="secondary-btn" onclick="document.getElementById('dynamicCreateHomeModal').remove();" style="flex: 1; padding: 10px 20px;">Cancel</button>
                    <button class="primary-btn" id="submitCreateHomeBtn" style="flex: 1; padding: 10px 20px;">Create Home</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    document.getElementById('submitCreateHomeBtn').onclick = async () => {
        const input = document.getElementById('createHomeNameInput');
        const name = input ? input.value : '';
        if (!name || name.trim() === '') {
            alert("Please enter a home name.");
            return;
        }
        
        const btn = document.getElementById('submitCreateHomeBtn');
        btn.disabled = true;
        btn.textContent = "Creating...";

        const res = await window.HomeAPI.createHome(name.trim());
        if (res.error) {
            alert("Error: " + res.error);
            btn.disabled = false;
            btn.textContent = "Create Home";
        } else {
            // Success! Show CTA instead of reloading immediately
            const content = document.getElementById('createHomeModalContent');
            content.innerHTML = `
                <div style="text-align: center;">
                    <div style="width: 60px; height: 60px; border-radius: 50%; background: #E9EFFD; color: var(--primary-purple); display: flex; align-items: center; justify-content: center; margin: 0 auto 16px auto;">
                        <span class="material-symbols-rounded" style="font-size: 32px;">celebration</span>
                    </div>
                    <h3 style="margin-bottom: 8px; font-size: 22px;">Home Created!</h3>
                    <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Your home <strong>${res.home_name}</strong> is ready. Invite your roommates using this join code:</p>
                    
                    <div style="background: #f8fafc; border: 2px dashed #cbd5e1; border-radius: 16px; padding: 20px; margin-bottom: 24px;">
                        <h2 style="font-size: 32px; letter-spacing: 8px; color: var(--primary-purple); margin: 0;">${res.join_code}</h2>
                    </div>

                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="primary-btn" id="shareInviteBtn" style="width: 100%; padding: 14px 20px; font-size: 16px; display: flex; justify-content: center; align-items: center; gap: 8px;">
                            <span class="material-symbols-rounded">share</span> Share Invite Link
                        </button>
                        <button class="secondary-btn" onclick="window.location.reload();" style="width: 100%; padding: 14px 20px; font-size: 16px;">Got it, let's go!</button>
                    </div>
                </div>
            `;

            document.getElementById('shareInviteBtn').onclick = async function() {
                const inviteUrl = window.location.origin + '/login?join=' + res.join_code;
                if (navigator.share) {
                    try {
                        await navigator.share({
                            title: 'Join my home on DoneSpace',
                            text: 'Click this link to join my home and collaborate on tasks and meals!',
                            url: inviteUrl
                        });
                    } catch (err) {
                        console.error('Share failed:', err);
                    }
                } else {
                    // Fallback to clipboard
                    navigator.clipboard.writeText(inviteUrl);
                    const originalHTML = this.innerHTML;
                    this.innerHTML = '<span class="material-symbols-rounded">check</span> Copied!';
                    setTimeout(() => { this.innerHTML = originalHTML; }, 2000);
                }
            };
        }
    };
};

window.showJoinHomeModal = function() {
    const existing = document.getElementById('dynamicJoinHomeModal');
    if (existing) existing.remove();

    const modalHTML = `
        <div class="modal-overlay active" id="dynamicJoinHomeModal">
            <div class="modal-content" style="max-width: 400px; padding: 32px 24px; text-align: center;">
                <h3 style="margin-bottom: 12px; font-size: 20px;">Join an Existing Home</h3>
                <p style="color: #6b7280; font-size: 14px; margin-bottom: 24px;">Ask your roommate for the 6-letter Join Code and enter it below.</p>
                
                <div id="otpContainer" style="display: flex; gap: 8px; justify-content: center; margin-bottom: 32px;">
                    <input type="text" maxlength="1" class="otp-box" style="width: 45px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 12px; border: 1px solid #e5e7eb; text-transform: uppercase; outline: none; transition: border-color 0.2s;">
                    <input type="text" maxlength="1" class="otp-box" style="width: 45px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 12px; border: 1px solid #e5e7eb; text-transform: uppercase; outline: none; transition: border-color 0.2s;">
                    <input type="text" maxlength="1" class="otp-box" style="width: 45px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 12px; border: 1px solid #e5e7eb; text-transform: uppercase; outline: none; transition: border-color 0.2s;">
                    <input type="text" maxlength="1" class="otp-box" style="width: 45px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 12px; border: 1px solid #e5e7eb; text-transform: uppercase; outline: none; transition: border-color 0.2s;">
                    <input type="text" maxlength="1" class="otp-box" style="width: 45px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 12px; border: 1px solid #e5e7eb; text-transform: uppercase; outline: none; transition: border-color 0.2s;">
                    <input type="text" maxlength="1" class="otp-box" style="width: 45px; height: 50px; text-align: center; font-size: 20px; font-weight: bold; border-radius: 12px; border: 1px solid #e5e7eb; text-transform: uppercase; outline: none; transition: border-color 0.2s;">
                </div>

                <div style="display: flex; gap: 12px; justify-content: space-between;">
                    <button class="secondary-btn" onclick="document.getElementById('dynamicJoinHomeModal').remove();" style="flex: 1; padding: 10px 20px;">Cancel</button>
                    <button class="primary-btn" id="submitJoinHomeBtn" style="flex: 1; padding: 10px 20px;">Join Home</button>
                </div>
            </div>
        </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // OTP Logic
    const otpBoxes = document.querySelectorAll('.otp-box');
    otpBoxes.forEach((box, idx) => {
        box.addEventListener('input', (e) => {
            box.value = box.value.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
            if (box.value && idx < otpBoxes.length - 1) {
                otpBoxes[idx + 1].focus();
            }
        });
        box.addEventListener('keydown', (e) => {
            if (e.key === 'Backspace' && !box.value && idx > 0) {
                otpBoxes[idx - 1].focus();
                otpBoxes[idx - 1].value = '';
            }
        });
        box.addEventListener('focus', () => {
            box.style.borderColor = 'var(--primary-purple)';
        });
        box.addEventListener('blur', () => {
            box.style.borderColor = '#e5e7eb';
        });
    });

    // Focus first box
    if(otpBoxes.length > 0) setTimeout(() => otpBoxes[0].focus(), 100);

    document.getElementById('submitJoinHomeBtn').onclick = async () => {
        let code = '';
        otpBoxes.forEach(b => code += b.value);
        if (code.length < 6) {
            alert("Please enter the full 6-character join code.");
            return;
        }
        
        const btn = document.getElementById('submitJoinHomeBtn');
        btn.disabled = true;
        btn.textContent = "Joining...";

        const res = await window.HomeAPI.joinHome(code.toUpperCase());
        if (res.error) {
            alert("Error: " + res.error);
            btn.disabled = false;
            btn.textContent = "Join Home";
        } else {
            window.location.reload();
        }
    };
};
