// Main JS extracted from base.html

function getRelativeTimeShort(isoStr) {
    const diff = Date.now() - new Date(isoStr).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

window.refreshNotifications = async function() {
    const badge = document.getElementById('notifBadge');
    const list = document.getElementById('notifList');
    if (!badge || !list) return;

    const data = await window.HomeAPI.getNotifications();
    const { notifications = [], unread_count = 0 } = data;

    // Update badge
    if (unread_count > 0) {
        badge.textContent = unread_count > 9 ? '9+' : unread_count;
        badge.style.display = 'flex';
    } else {
        badge.style.display = 'none';
    }

    // Render list
    if (notifications.length === 0) {
        list.innerHTML = `
            <div style="text-align:center; padding: 40px 20px; color: var(--text-muted);">
                <span class="material-symbols-rounded" style="font-size:40px; display:block; margin-bottom:10px; opacity:0.4;">notifications_off</span>
                <p style="margin:0; font-size:14px;">No notifications yet</p>
            </div>`;
        return;
    }

    list.innerHTML = '';
    notifications.forEach(n => {
        const isUnread = !n.is_read;
        const avatarUrl = n.actor_avatar
            ? n.actor_avatar
            : `https://ui-avatars.com/api/?name=${encodeURIComponent(n.actor_name)}&background=random&size=40`;

        const item = document.createElement('div');
        item.id = `notif-item-${n.id}`;
        item.style.cssText = `display:flex; gap:12px; align-items:flex-start; padding:14px 20px; cursor:pointer; border-bottom:1px solid var(--border-color); transition:background 0.15s; background:${isUnread ? 'rgba(140,82,255,0.05)' : 'transparent'};`;
        item.innerHTML = `
            <div style="position:relative; flex-shrink:0;">
                <img src="${avatarUrl}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;" alt="${n.actor_name}">
                <span class="material-symbols-rounded" style="position:absolute;bottom:-2px;right:-2px;font-size:16px;background:var(--primary-purple);color:#fff;border-radius:50%;padding:2px;font-variation-settings:'FILL' 1;">task_alt</span>
            </div>
            <div style="flex:1; min-width:0;">
                <p style="margin:0 0 3px 0; font-size:14px; font-weight:${isUnread ? '600' : '400'}; color:var(--text-main); line-height:1.4;">${n.body}</p>
                <span style="font-size:12px; color:var(--text-muted);">${getRelativeTimeShort(n.timestamp)}</span>
            </div>
            ${isUnread ? '<span style="width:8px;height:8px;background:var(--primary-purple);border-radius:50%;flex-shrink:0;margin-top:6px;"></span>' : ''}
        `;

        item.addEventListener('mouseenter', () => { item.style.background = 'var(--surface-main)'; });
        item.addEventListener('mouseleave', () => { item.style.background = isUnread ? 'rgba(140,82,255,0.05)' : 'transparent'; });

        if (isUnread) {
            item.addEventListener('click', async () => {
                await window.HomeAPI.markNotificationRead(n.id);
                window.refreshNotifications();
            });
        }

        list.appendChild(item);
    });
};

document.addEventListener('DOMContentLoaded', () => {
    // Navbar Header Init
    const bell = document.getElementById('notifBellBtn');
    const dropdown = document.getElementById('notifDropdown');
    const readAllBtn = document.getElementById('notifReadAllBtn');

    if (bell && dropdown) {
        bell.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = dropdown.style.display !== 'none';
            if (isOpen) {
                dropdown.style.display = 'none';
            } else {
                // Responsive positioning
                if (window.innerWidth <= 500) {
                    // Mobile: fixed full-width panel below header
                    dropdown.style.position = 'fixed';
                    dropdown.style.top = '70px';
                    dropdown.style.left = '12px';
                    dropdown.style.right = '12px';
                    dropdown.style.width = 'auto';
                } else {
                    // Desktop: absolute dropdown anchored to right of bell
                    dropdown.style.position = 'absolute';
                    dropdown.style.top = 'calc(100% + 12px)';
                    dropdown.style.left = 'auto';
                    dropdown.style.right = '0';
                    dropdown.style.width = '340px';
                }
                dropdown.style.display = 'block';
                window.refreshNotifications();
            }
        });

        document.addEventListener('click', (e) => {
            if (!document.getElementById('notifBellWrapper').contains(e.target)) {
                dropdown.style.display = 'none';
            }
        });
    }

    if (readAllBtn) {
        readAllBtn.addEventListener('click', async () => {
            await window.HomeAPI.markAllNotificationsRead();
            window.refreshNotifications();
        });
    }

    // Initial fetch after auth is ready (slight delay for token load)
    setTimeout(() => {
        if (window.HomeAPI && window.HomeAPI.getToken()) {
            window.refreshNotifications();
        }
    }, 1500);

    // Profile Dropdown
    const profileBtn = document.getElementById('userProfileBtn');
    const profileDropdown = document.getElementById('profileDropdown');

    if (profileBtn && profileDropdown) {
        profileBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            profileBtn.classList.toggle('active');
        });

        document.addEventListener('click', (e) => {
            if (!profileBtn.contains(e.target)) {
                profileBtn.classList.remove('active');
            }
        });
    }

    // Settings Tabs Logic
    const tabs = document.querySelectorAll('.settings-tab');
    const panes = document.querySelectorAll('.settings-pane');
    
    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            panes.forEach(p => p.style.display = 'none');
            
            tab.classList.add('active');
            const targetId = tab.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';
        });
    });

    // Workspace Switcher Logic
    const switcherBtn = document.getElementById('workspaceSwitcherBtn');
    const submenu = document.getElementById('workspaceSubmenu');
    
    if (switcherBtn && submenu) {
        switcherBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            if (submenu.style.display === 'none') {
                submenu.style.display = 'block';
                switcherBtn.style.background = '#f3f4f6';
            } else {
                submenu.style.display = 'none';
                switcherBtn.style.background = 'transparent';
            }
        });
    }
});

async function switchHome(homeId) {
    try {
        const res = await window.HomeAPI.fetch('/auth/switch_home', {
            method: 'POST',
            body: JSON.stringify({ home_id: homeId })
        });
        if (res.ok) {
            window.location.reload();
        } else {
            alert("Error switching home.");
        }
    } catch (e) {
        console.error(e);
    }
}
