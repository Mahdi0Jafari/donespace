document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startTourBtn');
    if (!startBtn) return;

    const driver = window.driver.js.driver;

    const tourObj = driver({
        showProgress: true,
        animate: true,
        allowClose: true,
        overlayOpacity: 0.65,
        doneBtnText: 'Start Organizing',
        closeBtnText: 'Skip',
        nextBtnText: 'Next',
        prevBtnText: 'Back',
        popoverClass: 'donespace-tour-theme', // Custom class for styling
        onHighlightStarted: (element) => {
            // Fix scrolling issue when element is inside a scrollable container
            if (element && element.node) {
                // Find nearest scrollable parent or just scroll into view
                element.node.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        },
        steps: [
            {
                element: '.welcome-text',
                popover: {
                    title: 'Welcome to DoneSpace! 👋',
                    description: "Let's see how this app brings order to your home.",
                    side: "bottom",
                    align: 'start'
                }
            },
            {
                element: '.facility-card.add-new',
                popover: {
                    title: 'Step 1: The Foundation',
                    description: 'Here is where you define the sections and rooms of your house. Click here to add a new space.',
                    side: "top",
                    align: 'start'
                }
            },
            {
                element: '.facilities-grid .facility-card:not(.add-new) .task-list',
                popover: {
                    title: 'Step 2: Tasks & Allocation',
                    description: 'Inside each space, you can see all the chores assigned to it, along with who is responsible for doing them.',
                    side: "top",
                    align: 'start'
                },
                onHighlightStarted: (element) => {
                    const card = document.querySelector('.facilities-grid .facility-card:not(.add-new)');
                    if (card) {
                        card.classList.add('active');
                        card.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                },
                onDeselected: (element) => {
                    const card = document.querySelector('.facilities-grid .facility-card:not(.add-new)');
                    if (card) {
                        card.classList.remove('active');
                    }
                }
            },
            {
                element: '.agenda-widget',
                popover: {
                    title: 'Step 3: The Plan',
                    description: 'Once tasks are allocated, they will automatically populate your upcoming calendar here.',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '#priorityCardsContainer',
                popover: {
                    title: 'Step 4: Execution',
                    description: 'Every day, the system curates your immediate tasks here, sorted by priority. This is where you get things done!',
                    side: "right",
                    align: 'start'
                }
            },
            {
                element: '.progress-widget',
                popover: {
                    title: 'Step 5: The Reward',
                    description: 'As you check off those daily priorities, watch your household progress bar grow to 100%!',
                    side: "left",
                    align: 'end'
                }
            }
        ],
        onDestroyStarted: () => {
            // Tour finished or skipped
            localStorage.setItem('tourCompleted', 'true');
            if (startBtn) {
                startBtn.style.transform = 'scale(0)';
                setTimeout(() => startBtn.style.display = 'none', 300);
            }
            tourObj.destroy();
        }
    });

    startBtn.addEventListener('click', () => {
        // Reset scroll position before starting
        const mainContent = document.querySelector('.main-content');
        if (mainContent) mainContent.scrollTop = 0;
        tourObj.drive();
    });

    // Hide button if already completed
    if (localStorage.getItem('tourCompleted') === 'true') {
        startBtn.style.display = 'none';
    }
});
