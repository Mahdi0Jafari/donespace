/**
 * Meals & Recipes — JavaScript
 * Recipe Bank + Weekly Planning + Integration with main calendar
 */

document.addEventListener('DOMContentLoaded', () => {

    // ─── Constants ─────────────────────────────────────────────
    const EMOJIS = ['🍳','🥗','🍛','🍝','🍲','🥘','🫕','🍜','🍱','🍕','🌮','🥙','🍣','🥩','🫔','🥞','🍗','🥚','🫙','🥣'];

    const getMembers = () => {
        const home = JSON.parse(localStorage.getItem('currentHome') || '{}');
        const members = home.members || [];
        if (members.length === 0) return [{ username: 'Me', name: 'Me', avatar: '' }];
        return members.map(m => ({ username: m.username, name: m.display_name || m.username, avatar: m.avatar || '' }));
    };
    const DAYS_SHORT = ['Sat', 'Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'];

    // ─── Data helpers ───────────────────────────────────────────
    const getRecipes  = () => JSON.parse(localStorage.getItem('homeRecipes') || '[]');
    const saveRecipes = (r) => {
        localStorage.setItem('homeRecipes', JSON.stringify(r));
        if (window.HomeAPI) window.HomeAPI.saveRecipes(r);
    };
    const getMeals    = () => JSON.parse(localStorage.getItem('homeMeals') || '{}');
    const saveMeals   = (m) => {
        localStorage.setItem('homeMeals', JSON.stringify(m));
        if (window.HomeAPI) window.HomeAPI.saveMeals(m);
    };

    const genId = () => 'temp-recipe-' + Date.now() + '_' + Math.random().toString(36).slice(2,6);

    // Week helpers (Sat-based)
    const getWeekStart = () => {
        const now = new Date();
        const diff = (now.getDay() === 6) ? 0 : (now.getDay() + 1);
        const sat = new Date(now);
        sat.setDate(now.getDate() - diff);
        sat.setHours(0,0,0,0);
        return sat;
    };
    const weekStart = getWeekStart();
    const getDayDate = (i) => { const d = new Date(weekStart); d.setDate(weekStart.getDate() + i); return d; };
    const getDayKey  = (i) => {
        const d = getDayDate(i);
        return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    };

    // ─── Default demo recipes (first load only) ─────────────────
    const seedDefaults = () => {
        let existing = localStorage.getItem('homeRecipes');
        if (existing !== null && JSON.parse(existing).length > 0) return;
        saveRecipes([
            { id: genId(), name: 'Classic Avocado Toast with Poached Egg', emoji: '🥑', category: 'breakfast', time: 15,
              ingredients: ['2 thick slices Artisan Sourdough Bread', '1 large ripe Hass Avocado', '2 large Pasture-raised Eggs', '1 tbsp White Vinegar (for poaching)', '1/2 tsp Sea Salt & freshly ground Black Pepper', '1/4 tsp Red Pepper Flakes', '1/2 Lemon (juiced)', '1 tsp Extra Virgin Olive Oil'],
              notes: '1. Toast the sourdough slices until golden and crisp.\n2. In a bowl, mash the avocado with lemon juice, salt, and pepper until chunky but spreadable.\n3. Bring a pot of water to a gentle simmer, add vinegar. Create a vortex with a spoon, gently drop in the eggs, and poach for exactly 3 minutes.\n4. Spread the avocado mash evenly over the toast.\n5. Carefully place one poached egg on each slice. Drizzle with olive oil, sprinkle red pepper flakes, and serve immediately.' },
              
            { id: genId(), name: 'Fluffy Buttermilk Pancakes', emoji: '🥞', category: 'breakfast', time: 25,
              ingredients: ['2 cups All-purpose Flour', '1/4 cup Granulated Sugar', '2 tsp Baking Powder', '1 tsp Baking Soda', '1/2 tsp Salt', '2 cups Buttermilk', '2 large Eggs', '1/4 cup Unsalted Butter (melted)', '1 tsp Vanilla Extract', 'Maple Syrup & Fresh Berries (for serving)'],
              notes: '1. In a large bowl, whisk together flour, sugar, baking powder, baking soda, and salt.\n2. In a separate bowl, whisk the buttermilk, eggs, melted butter, and vanilla extract.\n3. Pour the wet ingredients into the dry ingredients. Stir gently just until combined (small lumps are okay; do not overmix).\n4. Heat a lightly buttered griddle or skillet over medium heat.\n5. Pour 1/4 cup of batter per pancake. Cook until bubbles form on the surface and edges look set (about 2-3 mins). Flip and cook for another 1-2 mins until golden brown.\n6. Serve warm with maple syrup and fresh berries.' },
              
            { id: genId(), name: 'Grilled Chicken Caesar Salad', emoji: '🥗', category: 'lunch', time: 30,
              ingredients: ['2 Boneless Skinless Chicken Breasts', '2 large heads Romaine Lettuce (chopped)', '1/2 cup Caesar Dressing', '1 cup Homemade or Artisan Croutons', '1/2 cup Shaved Parmesan Cheese', '1 tbsp Olive Oil', '1/2 tsp Garlic Powder', 'Salt and Pepper to taste', '1 Lemon (cut into wedges)'],
              notes: '1. Pound the chicken breasts to an even thickness. Season generously with olive oil, garlic powder, salt, and pepper.\n2. Preheat grill or grill pan to medium-high heat. Grill chicken for 6-7 minutes per side until the internal temperature reaches 165°F (74°C).\n3. Remove chicken from grill, let it rest for 5 minutes, then slice diagonally.\n4. In a large mixing bowl, toss the chopped romaine lettuce with Caesar dressing until evenly coated.\n5. Plate the greens, top with the sliced grilled chicken, croutons, and shaved Parmesan. Serve with a lemon wedge.' },
              
            { id: genId(), name: 'Authentic Spaghetti Bolognese', emoji: '🍝', category: 'dinner', time: 60,
              ingredients: ['1 lb (450g) Lean Ground Beef', '1 medium Onion (finely diced)', '2 cloves Garlic (minced)', '1 large Carrot (finely diced)', '1 celery stalk (finely diced)', '1 jar (24 oz) High-quality Marinara Sauce', '1/4 cup Dry Red Wine (optional)', '1/2 cup Whole Milk', '1 lb (450g) Spaghetti', '2 tbsp Olive Oil', '1 tsp Dried Oregano', 'Salt & Pepper to taste', 'Fresh Parmesan (for garnish)'],
              notes: '1. Heat olive oil in a large heavy-bottomed pot over medium heat. Sauté the onion, carrot, celery, and garlic until softened (about 5-7 mins).\n2. Add the ground beef, breaking it apart with a spoon. Cook until fully browned. Drain excess fat if necessary.\n3. Pour in the red wine to deglaze the pan, scraping up any browned bits. Let it simmer until the wine reduces (about 2 mins).\n4. Stir in the milk and simmer for 2 mins to tenderize the meat.\n5. Pour in the marinara sauce, oregano, salt, and pepper. Bring to a gentle boil, then reduce heat to low, cover, and simmer for at least 30-40 minutes (stirring occasionally).\n6. While sauce simmers, boil pasta in heavily salted water until al dente. Drain and toss pasta with the sauce. Garnish with fresh grated Parmesan.' },
              
            { id: genId(), name: 'Pan-Seared Salmon with Garlic Asparagus', emoji: '🐟', category: 'dinner', time: 25,
              ingredients: ['2 (6 oz) Salmon Fillets (skin-on)', '1 bunch Fresh Asparagus (ends trimmed)', '3 cloves Garlic (minced)', '2 tbsp Olive Oil', '1 tbsp Unsalted Butter', '1 Lemon (juiced)', '1/2 tsp Paprika', 'Salt and freshly ground Black Pepper'],
              notes: '1. Pat the salmon fillets completely dry with a paper towel. Season generously with salt, pepper, and paprika.\n2. In a large skillet, heat 1 tbsp olive oil over medium-high heat until shimmering. Place salmon skin-side up and sear for 4 minutes until a golden crust forms.\n3. Flip the salmon. Add the butter, garlic, and asparagus to the skillet around the salmon.\n4. Cook for another 3-4 minutes, tossing the asparagus in the garlic butter, until the salmon is cooked to your liking (internal temp 145°F/62°C) and asparagus is tender-crisp.\n5. Squeeze fresh lemon juice over the salmon and asparagus right before serving.' },
              
            { id: genId(), name: 'Persian Zereshk Polo ba Morgh', emoji: '🍚', category: 'dinner', time: 90,
              ingredients: ['2 cups Premium Basmati Rice', '4 Chicken Thighs or Breasts', '1 large Onion (sliced)', '1 cup Dried Barberries (Zereshk)', '1/2 tsp High-quality Saffron threads', '3 tbsp Butter', '2 tbsp Vegetable Oil', '1 tbsp Tomato Paste', '1 tsp Turmeric', '1 tbsp Sugar', 'Salt and Black Pepper'],
              notes: '1. Wash rice until water runs clear, then soak in salted water for 1 hour.\n2. Grind saffron threads and steep in 3 tbsp of hot water.\n3. In a pot, sauté onions in oil until golden. Add chicken pieces and turmeric, browning on all sides. Stir in tomato paste, salt, pepper, and 2 cups of water. Cover and simmer on low for 45-60 mins until chicken is tender.\n4. Boil rice in a large pot of salted water for 7-10 mins until the grains are slightly soft on the outside but firm in the center. Drain, then steam the rice in a covered pot on low heat for 45 mins.\n5. Wash barberries and sauté them in butter with 1 tbsp sugar on very low heat for 2 minutes (do not burn!). Mix half the saffron water with the barberries.\n6. Mix the remaining saffron water with a cup of cooked rice. Serve the white rice on a platter, top with the saffron-barberry rice mixture, and place the chicken alongside.' },

            { id: genId(), name: 'Persian Macaroni', emoji: '🍝', category: 'lunch', time: 45,
              ingredients: ['1 lb Spaghetti or Bucatini', '400g Ground Beef', '1 large Onion (finely chopped)', '1 Potato (sliced for Tahdig)', '3 tbsp Tomato Paste', '1 tsp Turmeric', '1/2 tsp Cinnamon', 'Salt, Black Pepper, and a pinch of Red Pepper', '2 tbsp Oil'],
              notes: '1. Sauté onions in oil until golden. Add ground beef and brown it well.\n2. Add turmeric, salt, pepper, and cinnamon. Stir in the tomato paste and cook for 3 minutes until the raw smell is gone. Add 1/2 cup of water and let it simmer until the sauce thickens.\n3. Boil the pasta in salted water for 5-7 minutes (should still be slightly firm). Drain it.\n4. In a large non-stick pot, heat some oil. Arrange the potato slices at the bottom for Tahdig.\n5. Layer the pasta and the meat sauce alternately in the pot. \n6. Cover the lid with a cloth (damkoni) and steam on very low heat for 30 minutes.' },

            { id: genId(), name: 'Classic Kotlet (Meat Patties)', emoji: '🥩', category: 'lunch', time: 40,
              ingredients: ['400g Ground Beef or Lamb', '3 medium Potatoes', '1 large Onion', '2 large Eggs', '1 tsp Turmeric', '1 tsp Garlic Powder', 'Salt and Black Pepper', 'Frying Oil', 'Bread and Pickles (for serving)'],
              notes: '1. Peel the potatoes and the onion. Grate them finely. IMPORTANT: Squeeze out the excess juice from the grated onion and potatoes to prevent the patties from falling apart.\n2. In a large bowl, mix the ground meat, grated potatoes, grated onion, eggs, turmeric, garlic powder, salt, and pepper.\n3. Knead the mixture well for about 5 minutes until it becomes sticky and cohesive.\n4. Heat a generous amount of oil in a large skillet over medium heat.\n5. Take a small handful of the mixture, shape it into an oval patty (about 1/2 inch thick), and carefully place it in the hot oil.\n6. Fry each side for about 5-6 minutes until golden brown and crispy. Serve warm with bread, fresh herbs, and pickles.' },
              
            { id: genId(), name: 'Tropical Berry Acai Bowl', emoji: '🥣', category: 'snack', time: 10,
              ingredients: ['1 packet (100g) Frozen Unsweetened Acai Purée', '1/2 cup Frozen Mixed Berries (blueberries, raspberries)', '1/2 Frozen Banana', '1/4 cup Almond Milk or Coconut Water', 'Toppings: 1/4 cup Granola', 'Toppings: 1/2 Fresh Banana (sliced)', 'Toppings: 1 tbsp Chia Seeds', 'Toppings: 1 tbsp Coconut Flakes', '1 tsp Honey (optional)'],
              notes: '1. Run the frozen acai packet under warm water for 5 seconds to loosen, then break it into chunks directly into a high-powered blender.\n2. Add the frozen mixed berries, frozen banana half, and almond milk.\n3. Blend on medium-high, using a tamper if necessary, until the mixture is completely smooth, thick, and resembles soft-serve ice cream.\n4. Scoop the acai mixture into a serving bowl.\n5. Arrange the sliced banana, granola, coconut flakes, and chia seeds on top in neat rows. Drizzle lightly with honey if extra sweetness is desired. Serve immediately before it melts.' }
        ]);
    };
    seedDefaults();

    // ─── State ──────────────────────────────────────────────────
    let currentFilter   = 'all';
    let currentSearch   = '';
    let openRecipeId    = null;   // recipe being viewed/edited
    let isEditing       = false;
    let editIngredients = [];
    let editEmoji       = EMOJIS[0];
    let planRecipeId    = null;
    let planSelectedDay = null;
    let planSelectedCook = null;
    let planMealIndex   = null;
    let planSelectedMealType = 'Dinner';

    // ─── DOM refs ───────────────────────────────────────────────
    const recipeGrid    = document.getElementById('recipeGrid');
    const recipeSearch  = document.querySelector('.search-bar input');
    const addRecipeBtn  = document.getElementById('addRecipeBtn');
    const fabBtn        = document.getElementById('fabAddRecipe');
    const statTotal     = document.getElementById('statTotal');
    const statAvgTime   = document.getElementById('statAvgTime');
    const mealsAgendaArea = document.getElementById('mealsAgendaArea');
    const suggestionBox = document.getElementById('suggestionBox');
    const randomPickBtn = document.getElementById('randomPickBtn');

    // Modal
    const recipeModal       = document.getElementById('recipeModal');
    const recipeModalBox    = document.getElementById('recipeModalBox');
    const closeRecipeModal  = document.getElementById('closeRecipeModal');
    const editModeBtn       = document.getElementById('editModeBtn');
    const recipeViewMode    = document.getElementById('recipeViewMode');
    const recipeEditMode    = document.getElementById('recipeEditMode');
    const modalEmoji        = document.getElementById('modalEmoji');
    const modalTitle        = document.getElementById('modalTitle');
    const viewTags          = document.getElementById('viewTags');
    const viewMeta          = document.getElementById('viewMeta');
    const viewIngredients   = document.getElementById('viewIngredients');
    const viewNotes         = document.getElementById('viewNotes');
    const viewNotesSection  = document.getElementById('viewNotesSection');
    const deleteRecipeBtn   = document.getElementById('deleteRecipeBtn');
    const planMealBtn       = document.getElementById('planMealBtn');
    const editEmojiRow      = document.getElementById('editEmojiRow');
    const editName          = document.getElementById('editName');
    const editCategory      = document.getElementById('editCategory');
    const editTime          = document.getElementById('editTime');
    const editNotes         = document.getElementById('editNotes');
    const ingredientInput   = document.getElementById('ingredientInput');
    const addIngredientBtn  = document.getElementById('addIngredientBtn');
    const editIngredientsList = document.getElementById('editIngredientsList');
    const saveRecipeBtn     = document.getElementById('saveRecipeBtn');
    const cancelEditBtn     = document.getElementById('cancelEditBtn');

    // Plan modal
    const planModal         = document.getElementById('planModal');
    const planModalTitle    = document.getElementById('planModalTitle');
    const closePlanModal    = document.getElementById('closePlanModal');
    const cancelPlanBtn     = document.getElementById('cancelPlanBtn');
    const savePlanBtn       = document.getElementById('savePlanBtn');
    const planDaysGrid      = document.getElementById('planDaysGrid');
    const planCookChips     = document.getElementById('planCookChips');
    const planRecipeCustomList = document.getElementById('planRecipeCustomList');
    const planRecipeSearch  = document.getElementById('planRecipeSearch');
    const planMealTypeChips = document.getElementById('planMealTypeChips');
    const deletePlanBtn     = document.getElementById('deletePlanBtn');
    
    // Agenda Widget Instance
    let mealsAgenda = null;

    // ─── Render Recipe Grid ──────────────────────────────────────
    const CATEGORY_COLOR = { dinner: 'purple', lunch: 'orange', breakfast: 'yellow', snack: 'green' };
    const COLORS = ['purple', 'orange', 'cyan', 'green', 'blue', 'red', 'yellow'];

    const renderGrid = () => {
        const recipes = getRecipes();
        const filtered = recipes.filter(r => {
            const matchFilter = currentFilter === 'all' || r.category === currentFilter;
            const matchSearch = !currentSearch || r.name.toLowerCase().includes(currentSearch.toLowerCase());
            return matchFilter && matchSearch;
        });

        recipeGrid.innerHTML = '';

        if (filtered.length === 0) {
            recipeGrid.innerHTML = `
                <div class="recipes-empty-state">
                    <div class="empty-emoji">📖</div>
                    <h3>No recipes yet</h3>
                    <p>Add your first recipe to start building your household cookbook.</p>
                </div>`;
            return;
        }

        filtered.forEach((recipe, idx) => {
            const card = document.createElement('div');
            const color = recipe.color || CATEGORY_COLOR[recipe.category] || COLORS[idx % COLORS.length];
            card.className = `recipe-card ${color}`;
            card.dataset.id = recipe.id;

            card.innerHTML = `
                <div class="recipe-card-top">
                    <div class="recipe-card-emoji-wrap">${recipe.emoji || '🍳'}</div>
                    <span class="recipe-card-category">${recipe.category}</span>
                </div>
                <p class="recipe-card-name">${recipe.name}</p>
                <div class="recipe-card-meta">
                    ${recipe.time ? `<span class="recipe-card-time"><span class="material-symbols-rounded">schedule</span>${recipe.time} min</span>` : ''}
                    ${recipe.ingredients?.length ? `<span class="recipe-card-ing-count">${recipe.ingredients.length} ingredients</span>` : ''}
                </div>
            `;

            card.addEventListener('click', () => openRecipeView(recipe.id));
            recipeGrid.appendChild(card);
        });
    };

    // ─── Render Stats ────────────────────────────────────────────
    const renderStats = () => {
        const recipes = getRecipes();
        statTotal.textContent = recipes.length;
        if (recipes.length > 0) {
            const withTime = recipes.filter(r => r.time);
            if (withTime.length > 0) {
                const avg = Math.round(withTime.reduce((s, r) => s + (parseInt(r.time, 10) || 0), 0) / withTime.length);
                statAvgTime.textContent = `${avg} min`;
            }
        }
    };



    // ─── Open Recipe View ────────────────────────────────────────
    const openRecipeView = (id) => {
        const recipe = getRecipes().find(r => r.id == id);
        if (!recipe) return;
        openRecipeId = id;
        isEditing = false;

        modalEmoji.textContent  = recipe.emoji || '🍳';
        modalTitle.textContent  = recipe.name;

        // Tags
        viewTags.innerHTML = `<span class="recipe-category-badge badge-${recipe.category}" style="position:static;">${recipe.category}</span>`;

        // Meta
        viewMeta.innerHTML = `
            ${recipe.time ? `<div class="view-meta-item"><span class="material-symbols-rounded">schedule</span>${recipe.time} min</div>` : ''}
            ${recipe.ingredients?.length ? `<div class="view-meta-item"><span class="material-symbols-rounded">grocery</span>${recipe.ingredients.length} ingredients</div>` : ''}
        `;

        // Ingredients
        viewIngredients.innerHTML = '';
        (recipe.ingredients || []).forEach(ing => {
            const li = document.createElement('li');
            li.textContent = ing;
            viewIngredients.appendChild(li);
        });

        // Notes
        if (recipe.notes) {
            viewNotes.textContent = recipe.notes;
            viewNotesSection.style.display = '';
        } else {
            viewNotesSection.style.display = 'none';
        }

        recipeViewMode.style.display = '';
        recipeEditMode.style.display = 'none';
        editModeBtn.style.display = '';
        recipeModal.classList.add('active');
    };

    // ─── Open Recipe Edit (new or existing) ──────────────────────
    const openRecipeEdit = (id = null) => {
        isEditing = true;
        const recipe = id ? getRecipes().find(r => r.id == id) : null;
        openRecipeId = id;

        modalEmoji.textContent = recipe?.emoji || EMOJIS[0];
        modalTitle.textContent = id ? 'Edit Recipe' : 'New Recipe';
        editEmoji = recipe?.emoji || EMOJIS[0];
        editIngredients = [...(recipe?.ingredients || [])];

        editName.value     = recipe?.name || '';
        editCategory.value = recipe?.category || 'dinner';
        editTime.value     = recipe?.time || '';
        editNotes.value    = recipe?.notes || '';

        // Emoji picker
        editEmojiRow.innerHTML = '';
        EMOJIS.forEach(em => {
            const el = document.createElement('div');
            el.className = `meal-icon-opt ${em === editEmoji ? 'selected' : ''}`;
            el.textContent = em;
            el.addEventListener('click', () => {
                editEmoji = em;
                modalEmoji.textContent = em;
                editEmojiRow.querySelectorAll('.meal-icon-opt').forEach(x => x.classList.remove('selected'));
                el.classList.add('selected');
            });
            editEmojiRow.appendChild(el);
        });

        renderEditIngredients();

        recipeViewMode.style.display = 'none';
        recipeEditMode.style.display = '';
        editModeBtn.style.display = 'none';
        recipeModal.classList.add('active');
        setTimeout(() => editName.focus(), 50);
    };

    const renderEditIngredients = () => {
        editIngredientsList.innerHTML = '';
        editIngredients.forEach((ing, idx) => {
            const li = document.createElement('li');
            li.innerHTML = `<span>${ing}</span><button type="button"><span class="material-symbols-rounded">close</span></button>`;
            li.querySelector('button').addEventListener('click', () => {
                editIngredients.splice(idx, 1);
                renderEditIngredients();
            });
            editIngredientsList.appendChild(li);
        });
    };

    const addIngredient = () => {
        const val = ingredientInput.value.trim();
        if (!val) return;
        editIngredients.push(val);
        ingredientInput.value = '';
        ingredientInput.focus();
        renderEditIngredients();
    };

    // ─── Save Recipe ─────────────────────────────────────────────
    const saveRecipe = () => {
        const name = editName.value.trim();
        if (!name) { editName.focus(); editName.style.borderColor = '#ef4444'; setTimeout(() => editName.style.borderColor = '', 1500); return; }

        const recipes = getRecipes();
        const recipe = {
            id:          openRecipeId || genId(),
            name,
            emoji:       editEmoji,
            category:    editCategory.value,
            time:        parseInt(editTime.value) || null,
            ingredients: [...editIngredients],
            notes:       editNotes.value.trim(),
        };

        if (openRecipeId) {
            const idx = recipes.findIndex(r => r.id == openRecipeId);
            if (idx > -1) recipes[idx] = recipe;
        } else {
            recipes.unshift(recipe);
        }

        saveRecipes(recipes);
        closeModal();
        renderAll();
    };

    // ─── Delete Recipe ───────────────────────────────────────────
    const deleteRecipe = () => {
        if (!openRecipeId) return;
        const recipes = getRecipes().filter(r => r.id !== openRecipeId);
        saveRecipes(recipes);
        closeModal();
        renderAll();
    };

    const deleteScheduledMeal = () => {
        if (planSelectedDay === null || planMealIndex === null) return;
        const meals = getMeals();
        if (meals[planSelectedDay] && Array.isArray(meals[planSelectedDay])) {
            meals[planSelectedDay].splice(planMealIndex, 1);
            if (meals[planSelectedDay].length === 0) {
                delete meals[planSelectedDay];
            }
            saveMeals(meals);
        }
        closePlan();
        if (mealsAgenda) mealsAgenda.refresh();
    };

    // ─── Close Modals ────────────────────────────────────────────
    const closeModal = () => {
        recipeModal.classList.remove('active');
        openRecipeId = null;
        isEditing = false;
    };
    const closePlan = () => { planModal.classList.remove('active'); planRecipeId = null; planMealIndex = null; };

    // ─── Plan Modal ──────────────────────────────────────────────
    const openPlanModal = (recipeId, defaultDateKey = null, defaultMealIndex = null) => {
        const recipes = getRecipes();
        const meals = getMeals();
        const recipe = recipes.find(r => r.id === recipeId);
        
        planRecipeId = recipeId;
        planSelectedDay = defaultDateKey;
        planMealIndex = defaultMealIndex;
        planSelectedCook = null;
        planSelectedMealType = recipe && recipe.category ? recipe.category.charAt(0).toUpperCase() + recipe.category.slice(1) : 'Dinner';
        
        // Populate Recipe Custom List
        const renderRecipeOptions = (filter = '') => {
            planRecipeCustomList.innerHTML = '';
            const filteredRecipes = recipes.filter(r => r.name.toLowerCase().includes(filter.toLowerCase()));
            
            if (filteredRecipes.length === 0) {
                planRecipeCustomList.innerHTML = '<div style="padding:12px; text-align:center; color:#9ca3af; font-size:13px;">No recipes found</div>';
            } else {
                filteredRecipes.forEach(r => {
                    const item = document.createElement('div');
                    item.className = 'custom-recipe-item';
                    if (r.id == planRecipeId) item.classList.add('selected');
                    item.innerHTML = `<span class="emoji">${r.emoji || '🍳'}</span> <span class="name">${r.name}</span>`;
                    item.onclick = () => {
                        planRecipeId = r.id;
                        renderRecipeOptions(planRecipeSearch.value);
                    };
                    planRecipeCustomList.appendChild(item);
                });
            }
        };
        
        renderRecipeOptions();
        
        // Search handler
        planRecipeSearch.value = '';
        planRecipeSearch.oninput = (e) => renderRecipeOptions(e.target.value);
        
        // If no recipeId provided (clicked empty day), select first by default
        if (!planRecipeId && recipes.length > 0) {
            planRecipeId = recipes[0].id;
            renderRecipeOptions();
        }
        
        // If editing an existing meal on this day
        if (defaultDateKey && meals[defaultDateKey] && defaultMealIndex !== null) {
            let mealsForDay = Array.isArray(meals[defaultDateKey]) ? meals[defaultDateKey] : [meals[defaultDateKey]];
            const existingMeal = mealsForDay[defaultMealIndex];
            
            planRecipeId = existingMeal.recipeId;
            planSelectedCook = existingMeal.cook;
            planSelectedMealType = existingMeal.type || 'Dinner';
            renderRecipeOptions();
            planModalTitle.textContent = 'Edit Meal Plan';
            deletePlanBtn.style.display = 'block';
        } else {
            planModalTitle.textContent = recipeId ? `Plan: ${recipes.find(r=>r.id==recipeId)?.name || 'Meal'}` : 'Schedule a Meal';
            deletePlanBtn.style.display = 'none';
        }
        
        // Meal Type Chips
        planMealTypeChips.querySelectorAll('.cook-chip').forEach(c => {
            c.classList.remove('selected');
            if (c.dataset.type === planSelectedMealType) c.classList.add('selected');
        });
        
        planMealTypeChips.querySelectorAll('.cook-chip').forEach(c => {
            c.onclick = () => {
                planSelectedMealType = c.dataset.type;
                planMealTypeChips.querySelectorAll('.cook-chip').forEach(btn => btn.classList.remove('selected'));
                c.classList.add('selected');
            };
        });

        // Days grid - 14 days sliding window starting today
        planDaysGrid.innerHTML = '';
        planDaysGrid.style.display = 'flex';
        planDaysGrid.style.overflowX = 'auto';
        planDaysGrid.style.paddingBottom = '8px';
        planDaysGrid.style.gap = '8px';
        
        const today = new Date();
        today.setHours(0,0,0,0);
        
        const todayKey = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
        if (!planSelectedDay) planSelectedDay = todayKey;
        
        for (let i = 0; i < 14; i++) {
            const d = new Date(today);
            d.setDate(today.getDate() + i);
            const dateKey = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
            const hasMeal = !!meals[dateKey];
            
            const isSelected = dateKey === planSelectedDay;
            const isTodayClass = i === 0 ? ' today-btn' : '';
            
            const btn = document.createElement('button');
            btn.className = `plan-day-btn${hasMeal ? ' has-meal' : ''}${isTodayClass}${isSelected ? ' selected' : ''}`;
            btn.style.flexShrink = '0';
            btn.style.width = '48px';
            btn.innerHTML = `<span class="pdb-name">${['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]}</span><span class="pdb-num">${d.getDate()}</span>`;
            
            btn.addEventListener('click', () => {
                planSelectedDay = dateKey;
                planDaysGrid.querySelectorAll('.plan-day-btn').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
            planDaysGrid.appendChild(btn);
        }

        // Cook chips
        planCookChips.innerHTML = '';
        
        const members = getMembers();
        planSelectedCook = members[0].username; // Default to first member

        members.forEach((m, index) => {
            const chip = document.createElement('button');
            chip.className = 'cook-chip';
            if (index === 0) chip.classList.add('selected');
            
            let avatarHtml = '';
            if (m.avatar) {
                avatarHtml = `<img class="cook-avatar" src="${m.avatar}" alt="${m.name}">`;
            } else {
                avatarHtml = `<div class="cook-avatar" style="background:var(--primary-purple); color:#fff; display:flex; align-items:center; justify-content:center; font-size:12px; font-weight:bold;">${m.name.charAt(0).toUpperCase()}</div>`;
            }
            
            chip.innerHTML = `${avatarHtml} ${m.name}`;
            chip.addEventListener('click', () => {
                planSelectedCook = m.username;
                planCookChips.querySelectorAll('.cook-chip').forEach(c => c.classList.remove('selected'));
                chip.classList.add('selected');
            });
            planCookChips.appendChild(chip);
        });

        planModal.classList.add('active');
    };

    const savePlan = () => {
        if (planSelectedDay === null || !planRecipeId) return;
        const recipe = getRecipes().find(r => r.id == planRecipeId);
        if (!recipe) return;

        const meals = getMeals();
        
        let existingId = 'm_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
        if (planMealIndex !== null && meals[planSelectedDay]) {
            const mealsForDay = Array.isArray(meals[planSelectedDay]) ? meals[planSelectedDay] : [meals[planSelectedDay]];
            if (mealsForDay[planMealIndex] && mealsForDay[planMealIndex].id) {
                existingId = mealsForDay[planMealIndex].id;
            }
        }

        const newMeal = {
            id: existingId,
            name: recipe.name,
            emoji: recipe.emoji,
            color: 'purple',
            cook: planSelectedCook,
            type: planSelectedMealType,
            note: '',
            recipeId: planRecipeId,
        };

        if (planMealIndex !== null && meals[planSelectedDay]) {
            let mealsForDay = Array.isArray(meals[planSelectedDay]) ? meals[planSelectedDay] : [meals[planSelectedDay]];
            mealsForDay[planMealIndex] = newMeal;
            meals[planSelectedDay] = mealsForDay;
        } else {
            if (meals[planSelectedDay]) {
                let mealsForDay = Array.isArray(meals[planSelectedDay]) ? meals[planSelectedDay] : [meals[planSelectedDay]];
                mealsForDay.push(newMeal);
                meals[planSelectedDay] = mealsForDay;
            } else {
                meals[planSelectedDay] = [newMeal];
            }
        }
        
        saveMeals(meals);
        closePlan();
        if (mealsAgenda) mealsAgenda.refresh();
    };

    // ─── Random Suggest ──────────────────────────────────────────
    randomPickBtn.addEventListener('click', () => {
        const recipes = getRecipes();
        if (recipes.length === 0) return;
        const pick = recipes[Math.floor(Math.random() * recipes.length)];

        // Flash the card
        const card = recipeGrid.querySelector(`[data-id="${pick.id}"]`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.style.transition = 'box-shadow 0.2s';
            card.style.boxShadow = '0 0 0 3px var(--primary-purple)';
            setTimeout(() => { card.style.boxShadow = ''; }, 1200);
        }
        // Open after short delay
        setTimeout(() => openRecipeView(pick.id), 200);
    });

    // ─── Filter Tabs ─────────────────────────────────────────────
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');
            currentFilter = tab.dataset.filter;
            renderGrid();
        });
    });

    // Search
    recipeSearch.addEventListener('input', (e) => {
        currentSearch = e.target.value;
        renderGrid();
    });

    // ─── Event listeners ─────────────────────────────────────────
    addRecipeBtn.addEventListener('click', () => openRecipeEdit(null));
    fabBtn.addEventListener('click', () => openRecipeEdit(null));

    editModeBtn.addEventListener('click', () => openRecipeEdit(openRecipeId));
    saveRecipeBtn.addEventListener('click', saveRecipe);
    cancelEditBtn.addEventListener('click', () => {
        if (openRecipeId) openRecipeView(openRecipeId);
        else closeModal();
    });
    deleteRecipeBtn.addEventListener('click', deleteRecipe);
    planMealBtn.addEventListener('click', () => { 
        const idToPlan = openRecipeId;
        closeModal(); 
        openPlanModal(idToPlan); 
    });

    closeRecipeModal.addEventListener('click', closeModal);
    recipeModal.addEventListener('click', (e) => { if (e.target === recipeModal) closeModal(); });

    closePlanModal.addEventListener('click', closePlan);
    cancelPlanBtn.addEventListener('click', closePlan);
    planModal.addEventListener('click', (e) => { if (e.target === planModal) closePlan(); });
    savePlanBtn.addEventListener('click', savePlan);
    deletePlanBtn.addEventListener('click', deleteScheduledMeal);

    addIngredientBtn.addEventListener('click', addIngredient);
    ingredientInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); addIngredient(); } });
    editName.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); saveRecipe(); } });

    // ─── Initial Render ──────────────────────────────────────────
    const renderAll = () => { renderGrid(); renderStats(); };
    renderAll();
    
    // Initialize Agenda Widget
    if (window.AgendaWidget && mealsAgendaArea) {
        mealsAgenda = AgendaWidget.init('mealsAgendaArea', {
            showTasks: false,
            showMeals: true,
            onDayClick: (dateKey) => {
                closeModal();
                openPlanModal(null, dateKey);
            },
            onMealClick: (meal, dateKey, index) => {
                closeModal();
                openPlanModal(meal.recipeId, dateKey, index);
            }
        });
    }
});
