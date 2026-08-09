document.addEventListener('DOMContentLoaded', () => {
    const items = Array.from(document.querySelectorAll('.arc-item'));
    const labelEl = document.getElementById('arcLabel');
    if (items.length === 0) return;

    // Define positions for relative indices: 
    // 0: Center, 1: Right1, 2: Right2, -1: Left1, -2: Left2
    const positions = {
        0: { x: 0, y: -30, scale: 1 },
        1: { x: 75, y: -5, scale: 0.8 },
        2: { x: 140, y: 15, scale: 0.6 },
        '-1': { x: -75, y: -5, scale: 0.8 },
        '-2': { x: -140, y: 15, scale: 0.6 }
    };

    // Find initially active item based on DOM class
    let activeIndex = items.findIndex(item => item.classList.contains('active'));
    if (activeIndex === -1) activeIndex = 2; // Default to center

    function renderArc(currentIndex) {
        items.forEach((item, i) => {
            // Calculate relative distance with wrap-around (5 items total)
            let diff = i - currentIndex;
            if (diff > 2) diff -= 5;
            if (diff < -2) diff += 5;

            const pos = positions[diff];
            
            // Apply transform (translate then scale)
            item.style.transform = `translate(${pos.x}px, ${pos.y}px) scale(${pos.scale})`;
            item.style.zIndex = diff === 0 ? 10 : (5 - Math.abs(diff));
            
            if (diff === 0) {
                item.classList.add('active');
                if (labelEl) {
                    labelEl.style.opacity = 0;
                    setTimeout(() => {
                        labelEl.textContent = item.dataset.label;
                        labelEl.style.opacity = 1;
                    }, 150); // half-way through transition
                }
            } else {
                item.classList.remove('active');
            }
        });
    }

    // Initial render
    renderArc(activeIndex);

    // Handle Clicks for Animation Hijacking
    items.forEach((item, i) => {
        item.addEventListener('click', (e) => {
            const href = item.getAttribute('href');
            
            // If it's already active, let default navigation happen if needed
            if (i === activeIndex) {
                return;
            }

            e.preventDefault(); // Stop immediate navigation

            activeIndex = i;
            renderArc(activeIndex);

            // Wait for the CSS transition to almost finish, then navigate
            setTimeout(() => {
                if (item.hasAttribute('onclick')) {
                    // Re-trigger the onclick logic if any (like logout)
                    // The easiest way is to use eval on the onclick string since it's inline
                    const onclickStr = item.getAttribute('onclick');
                    if (onclickStr) {
                        try {
                            const func = new Function(onclickStr);
                            func.call(item);
                        } catch(e) {}
                    }
                } else if (href && href !== '#') {
                    window.location.href = href;
                }
            }, 350);
        });
    });
});
