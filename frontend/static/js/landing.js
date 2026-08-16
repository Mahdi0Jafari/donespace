// FAQ Accordion & Auth State Handling
document.addEventListener('DOMContentLoaded', () => {
    // 1. FAQ Accordion
    document.querySelectorAll('.faq-question').forEach(button => {
        button.addEventListener('click', () => {
            const item = button.closest('.faq-item');
            const isActive = item.classList.contains('active');
            
            document.querySelectorAll('.faq-item').forEach(other => {
                other.classList.remove('active');
            });
            
            if (!isActive) item.classList.add('active');
        });
    });

    // 2. Progressive check for logged in user in localStorage
    const token = localStorage.getItem('authToken');
    if (token) {
        document.querySelectorAll('.nav-auth-btn').forEach(btn => {
            btn.href = '/app';
            btn.textContent = 'Dashboard →';
        });
        document.querySelectorAll('.hero-auth-btn').forEach(btn => {
            btn.href = '/app';
            btn.textContent = 'Open Dashboard →';
        });
    }
});
