window.RecurrenceUtil = {
    /**
     * Determine if a task occurs on a given date and optionally return the occurrence index.
     * @param {Object} task The task object
     * @param {Date} dateToCheck The date to evaluate
     * @returns {Object|null} Returns { occurrenceIndex: number } if it occurs, or null if it does not occur.
     */
    checkTaskOccursOnDate: function(task, dateToCheck) {
        if (!task || !dateToCheck) return null;

        const taskStart = task.startDate ? new Date(task.startDate) : new Date(task.createdAt);
        taskStart.setHours(0, 0, 0, 0);
        
        const currDateObj = new Date(dateToCheck);
        currDateObj.setHours(0, 0, 0, 0);
        
        // 1. Task hasn't started yet
        if (currDateObj < taskStart) return null;
        
        // 2. Check if task has ended by Date
        if (task.endType === 'date' && task.endDate) {
            const endD = new Date(task.endDate);
            endD.setHours(0, 0, 0, 0);
            if (currDateObj > endD) return null;
        }
        
        const diffTime = Math.abs(currDateObj - taskStart);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const interval = parseInt(task.interval) || 1;
        const recurrence = task.recurrence || 'none';
        
        let shouldRender = false;
        let occurrenceIndex = 0; // Number of valid occurrences before (and including) this one

        if (recurrence === 'none') {
            shouldRender = (diffDays === 0);
            occurrenceIndex = shouldRender ? 1 : 0;
        } 
        else if (recurrence === 'daily') {
            if (diffDays % interval === 0) {
                shouldRender = true;
                occurrenceIndex = Math.floor(diffDays / interval) + 1;
            } else {
                occurrenceIndex = Math.floor(diffDays / interval);
            }
        } 
        else if (recurrence === 'weekly') {
            // Calculate the Sunday of taskStart week
            const startSunday = new Date(taskStart);
            startSunday.setDate(startSunday.getDate() - startSunday.getDay());
            
            const currSunday = new Date(currDateObj);
            currSunday.setDate(currSunday.getDate() - currSunday.getDay());
            
            const calWeeksDiff = Math.round((currSunday - startSunday) / (1000 * 60 * 60 * 24 * 7));
            
            if (calWeeksDiff % interval === 0) {
                if (task.customDays && task.customDays.length > 0) {
                    if (task.customDays.includes(currDateObj.getDay())) {
                        shouldRender = true;
                    }
                } else {
                    // Default to same day of week as start date
                    if (currDateObj.getDay() === taskStart.getDay()) {
                        shouldRender = true;
                    }
                }
            }

            // Calculate exact occurrence index for Rotate and endType logic
            if ((task.endType === 'occurrences' && task.endOccurrences) || task.rotate) {
                // We need to count exactly how many active days happened between taskStart and currDateObj
                let tempDate = new Date(taskStart);
                let count = 0;
                while (tempDate <= currDateObj) {
                    const tempSunday = new Date(tempDate);
                    tempSunday.setDate(tempSunday.getDate() - tempSunday.getDay());
                    const tempWeeksDiff = Math.round((tempSunday - startSunday) / (1000 * 60 * 60 * 24 * 7));
                    
                    if (tempWeeksDiff % interval === 0) {
                        if (task.customDays && task.customDays.length > 0) {
                            if (task.customDays.includes(tempDate.getDay())) count++;
                        } else {
                            if (tempDate.getDay() === taskStart.getDay()) count++;
                        }
                    }
                    tempDate.setDate(tempDate.getDate() + 1);
                }
                occurrenceIndex = count;
            }
        } 
        else if (recurrence === 'monthly') {
            const monthsDiff = (currDateObj.getFullYear() - taskStart.getFullYear()) * 12 + (currDateObj.getMonth() - taskStart.getMonth());
            if (monthsDiff % interval === 0) {
                if (currDateObj.getDate() === taskStart.getDate()) {
                    shouldRender = true;
                    occurrenceIndex = Math.floor(monthsDiff / interval) + 1;
                } else {
                    occurrenceIndex = Math.floor(monthsDiff / interval);
                }
            } else {
                occurrenceIndex = Math.floor(monthsDiff / interval);
            }
        }
        else if (recurrence === 'yearly') {
            const yearsDiff = currDateObj.getFullYear() - taskStart.getFullYear();
            if (yearsDiff % interval === 0) {
                if (currDateObj.getMonth() === taskStart.getMonth() && currDateObj.getDate() === taskStart.getDate()) {
                    shouldRender = true;
                    occurrenceIndex = Math.floor(yearsDiff / interval) + 1;
                } else {
                    occurrenceIndex = Math.floor(yearsDiff / interval);
                }
            } else {
                occurrenceIndex = Math.floor(yearsDiff / interval);
            }
        }

        if (!shouldRender) return null;

        // 3. Check if task has ended by Occurrences
        if (task.endType === 'occurrences' && task.endOccurrences) {
            const maxOccurrences = parseInt(task.endOccurrences);
            if (occurrenceIndex > maxOccurrences) return null;
        }

        return { occurrenceIndex: occurrenceIndex };
    }
};
