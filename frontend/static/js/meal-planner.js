/**
 * Meal Planner — Weekly meal scheduling with cook assignment
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── Config ──────────────────────────────────────────────
    const DAYS = ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const DAY_SHORT = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
    const MEAL_ICONS = ['🍳', '🥗', '🍛', '🍝', '🍲', '🥘', '🫕', '🍜', '🍱', '🍕', '🌮', '🥙', '🍣', '🥩', '🫔'];
    const MEAL_COLORS = ['purple', 'yellow', 'orange', 'cyan', 'green', 'red'];

    // Fetch real household members
    const getMembers = () => {
        const home = JSON.parse(localStorage.getItem('currentHome') || '{}');
        const members = home.members || [];
        if (members.length === 0) return [{ name: 'Me', avatar: '' }];
        return members.map(m => ({ name: m.username, avatar: m.avatar || '' }));
    };

    // ─── State ───────────────────────────────────────────────
    const getMeals = () => JSON.parse(localStorage.getItem('homeMeals') || '{}');
    const saveMeals = (meals) => {
        localStorage.setItem('homeMeals', JSON.stringify(meals));
        if (window.HomeAPI) window.HomeAPI.saveMeals(meals);
    };

    let editingDay = null; // index 0-6 (Sat-Fri)

    // ─── Get current week's Saturday as anchor ────────────────
    const getWeekStart = () => {
        const now = new Date();
        const day = now.getDay(); // 0=Sun, 6=Sat
        // Adjust so Saturday = 0
        const diff = (day === 6) ? 0 : (day + 1);
        const sat = new Date(now);
        sat.setDate(now.getDate() - diff);
        sat.setHours(0, 0, 0, 0);
        return sat;
    };

    const weekStart = getWeekStart();
    const getDayDate = (i) => {
        const d = new Date(weekStart);
        d.setDate(weekStart.getDate() + i);
        return d;
    };
    const getDayKey = (i) => {
        const d = getDayDate(i);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };
    const isToday = (i) => {
        const d = getDayDate(i);
        const now = new Date();
        return d.toDateString() === now.toDateString();
    };

    // ─── Render the planner ───────────────────────────────────
    const plannerGrid = document.getElementById('mealPlannerGrid');
    if (!plannerGrid) return;

    const render = () => {
        const meals = getMeals();
        plannerGrid.innerHTML = '';

        DAYS.forEach((dayName, i) => {
            const key = getDayKey(i);
            const meal = meals[key];
            const date = getDayDate(i);
            const todayClass = isToday(i) ? 'today' : '';

            const row = document.createElement('div');
            row.className = `meal-day-row ${todayClass}`;

            // Day label
            row.innerHTML = `
                <div class="meal-day-label">
                    <span class="day-name">${DAY_SHORT[i]}</span>
                    <span class="day-num">${date.getDate()}</span>
                </div>`;

            // Meal slot
            const slot = document.createElement('div');
            if (meal) {
                slot.className = 'meal-slot filled';
                slot.innerHTML = `
                    <div class="meal-slot-icon color-${meal.color || 'purple'}">${meal.icon || '🍳'}</div>
                    <div class="meal-slot-info">
                        <div class="meal-slot-name">${meal.name}</div>
                        <div class="meal-slot-meta">
                            ${meal.cook ? `<span class="meal-slot-cook"><span class="material-symbols-rounded">person</span>${meal.cook}</span>` : ''}
                            ${meal.note ? `<span class="meal-slot-note">${meal.note}</span>` : ''}
                        </div>
                    </div>
                    <button class="meal-slot-edit" title="Edit"><span class="material-symbols-rounded">edit</span></button>`;
                slot.addEventListener('click', (e) => {
                    openModal(i, meal);
                });
            } else {
                slot.className = 'meal-slot empty';
                slot.innerHTML = `
                    <div class="meal-slot-add">
                        <span class="material-symbols-rounded">add</span>
                        Add meal…
                    </div>`;
                slot.addEventListener('click', () => openModal(i, null));
            }

            row.appendChild(slot);
            plannerGrid.appendChild(row);
        });
    };

    // ─── Modal ────────────────────────────────────────────────
    const modal = document.getElementById('mealModal');
    const modalTitle = document.getElementById('mealModalTitle');
    const mealNameInput = document.getElementById('mealNameInput');
    const mealNoteInput = document.getElementById('mealNoteInput');
    const mealIconRow = document.getElementById('mealIconRow');
    const mealColorRow = document.getElementById('mealColorRow');
    const cookChips = document.getElementById('cookChips');
    const deleteMealBtn = document.getElementById('deleteMealBtn');

    let selectedIcon = MEAL_ICONS[0];
    let selectedColor = MEAL_COLORS[0];
    let selectedCook = null;

    const openModal = (dayIndex, existingMeal) => {
        editingDay = dayIndex;
        const date = getDayDate(dayIndex);
        modalTitle.textContent = `${DAYS[dayIndex]}, ${date.getDate()} ${date.toLocaleString('en', { month: 'long' })}`;

        // Populate fields
        mealNameInput.value = existingMeal?.name || '';
        mealNoteInput.value = existingMeal?.note || '';
        selectedIcon = existingMeal?.icon || MEAL_ICONS[0];
        selectedColor = existingMeal?.color || MEAL_COLORS[0];
        selectedCook = existingMeal?.cook || null;

        // Icons
        mealIconRow.innerHTML = '';
        MEAL_ICONS.forEach(icon => {
            const el = document.createElement('div');
            el.className = `meal-icon-opt ${icon === selectedIcon ? 'selected' : ''}`;
            el.textContent = icon;
            el.addEventListener('click', () => {
                selectedIcon = icon;
                mealIconRow.querySelectorAll('.meal-icon-opt').forEach(x => x.classList.remove('selected'));
                el.classList.add('selected');
            });
            mealIconRow.appendChild(el);
        });

        // Colors
        mealColorRow.innerHTML = '';
        MEAL_COLORS.forEach(color => {
            const el = document.createElement('div');
            el.className = `meal-color-swatch c-${color} ${color === selectedColor ? 'selected' : ''}`;
            el.addEventListener('click', () => {
                selectedColor = color;
                mealColorRow.querySelectorAll('.meal-color-swatch').forEach(x => x.classList.remove('selected'));
                el.classList.add('selected');
            });
            mealColorRow.appendChild(el);
        });

        // Cook chips
        cookChips.innerHTML = '';
        const members = getMembers();
        
        if (!selectedCook) {
            selectedCook = members[0].name;
        }

        members.forEach(m => {
            const chip = document.createElement('div');
            chip.className = `cook-chip ${selectedCook === m.name ? 'selected' : ''}`;
            
            let avatarHtml = '';
            if (m.avatar) {
                avatarHtml = `<img class="cook-avatar" src="${m.avatar}" alt="${m.name}">`;
            } else {
                avatarHtml = `<div class="cook-avatar" style="background:var(--primary-purple); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${m.name.charAt(0).toUpperCase()}</div>`;
            }
            
            chip.innerHTML = `${avatarHtml} ${m.name}`;
            chip.addEventListener('click', () => {
                selectedCook = m.name;
                cookChips.querySelectorAll('.cook-chip').forEach(x => x.classList.remove('selected'));
                chip.classList.add('selected');
            });
            cookChips.appendChild(chip);
        });

        // Delete btn
        deleteMealBtn.style.display = existingMeal ? 'flex' : 'none';

        modal.classList.add('active');
        setTimeout(() => mealNameInput.focus(), 50);
    };

    const closeModal = () => {
        modal.classList.remove('active');
        editingDay = null;
    };

    // Save
    document.getElementById('saveMealBtn').addEventListener('click', () => {
        const name = mealNameInput.value.trim();
        if (!name) {
            mealNameInput.focus();
            mealNameInput.style.borderColor = '#ef4444';
            setTimeout(() => mealNameInput.style.borderColor = '', 1500);
            return;
        }
        const meals = getMeals();
        meals[getDayKey(editingDay)] = {
            name,
            icon: selectedIcon,
            color: selectedColor,
            cook: selectedCook,
            note: mealNoteInput.value.trim()
        };
        saveMeals(meals);
        closeModal();
        render();
    });

    // Delete
    deleteMealBtn.addEventListener('click', () => {
        const meals = getMeals();
        delete meals[getDayKey(editingDay)];
        saveMeals(meals);
        closeModal();
        render();
    });

    // Close on overlay click / close btn
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
    document.getElementById('closeMealModalBtn').addEventListener('click', closeModal);

    // Enter key to save
    mealNameInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('saveMealBtn').click();
    });

    // ─── Initial render ───────────────────────────────────────
    render();
});
