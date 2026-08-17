// DoneSpace 2026 PWA Lifecycle & Install Manager
(function() {
  'use strict';

  // 1. Register Service Worker
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js', { scope: '/' })
        .then((registration) => {
          console.log('[DoneSpace PWA] Service Worker registered with scope:', registration.scope);

          // Check for Service Worker updates
          registration.addEventListener('updatefound', () => {
            const installingWorker = registration.installing;
            if (installingWorker) {
              installingWorker.addEventListener('statechange', () => {
                if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                  console.log('[DoneSpace PWA] New update available.');
                }
              });
            }
          });
        })
        .catch((error) => {
          console.warn('[DoneSpace PWA] Service Worker registration failed:', error);
        });
    });
  }

  // 2. Custom Install Banner Handler
  let deferredPrompt = null;

  window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the default mini-infobar from appearing on mobile
    e.preventDefault();
    deferredPrompt = e;

    // Check if user previously dismissed install banner
    if (localStorage.getItem('donespace_pwa_dismissed') === 'true') {
      return;
    }

    // Show custom in-app install prompt if container exists or create one
    showInstallBanner();
  });

  function showInstallBanner() {
    if (document.getElementById('pwa-install-banner')) return;

    const banner = document.createElement('div');
    banner.id = 'pwa-install-banner';
    banner.innerHTML = `
      <div class="pwa-banner-content">
        <div class="pwa-banner-icon">
          <img src="/static/icons/icon-192.png" alt="DoneSpace Icon" width="40" height="40">
        </div>
        <div class="pwa-banner-text">
          <strong>Install DoneSpace App</strong>
          <span>Add to Home Screen for fast access & offline sync</span>
        </div>
        <div class="pwa-banner-actions">
          <button id="pwa-install-btn" class="pwa-btn-primary">Install</button>
          <button id="pwa-dismiss-btn" class="pwa-btn-close" aria-label="Close">&times;</button>
        </div>
      </div>
    `;

    // Inject styles
    const style = document.createElement('style');
    style.textContent = `
      #pwa-install-banner {
        position: fixed;
        bottom: 20px;
        left: 50%;
        transform: translateX(-50%) translateY(120%);
        width: calc(100% - 32px);
        max-width: 440px;
        background: rgba(23, 18, 43, 0.92);
        border: 1px solid rgba(140, 82, 255, 0.35);
        backdrop-filter: blur(16px);
        -webkit-backdrop-filter: blur(16px);
        border-radius: 20px;
        padding: 12px 16px;
        box-shadow: 0 12px 36px rgba(0, 0, 0, 0.5), 0 0 20px rgba(140, 82, 255, 0.2);
        z-index: 99999;
        color: #ffffff;
        font-family: 'Outfit', -apple-system, BlinkMacSystemFont, sans-serif;
        transition: transform 0.4s cubic-bezier(0.16, 1, 0.3, 1);
      }
      #pwa-install-banner.pwa-visible {
        transform: translateX(-50%) translateY(0);
      }
      .pwa-banner-content {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .pwa-banner-icon img {
        border-radius: 10px;
        display: block;
        box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      }
      .pwa-banner-text {
        flex: 1;
        min-width: 0;
      }
      .pwa-banner-text strong {
        display: block;
        font-size: 14px;
        font-weight: 600;
        letter-spacing: -0.2px;
      }
      .pwa-banner-text span {
        display: block;
        font-size: 12px;
        color: #b5a8cd;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .pwa-banner-actions {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .pwa-btn-primary {
        background: linear-gradient(135deg, #8c52ff, #6b28d9);
        color: #ffffff;
        border: none;
        padding: 8px 16px;
        font-size: 13px;
        font-weight: 600;
        border-radius: 12px;
        cursor: pointer;
        font-family: inherit;
        box-shadow: 0 4px 12px rgba(140, 82, 255, 0.35);
        transition: transform 0.15s ease;
      }
      .pwa-btn-primary:active {
        transform: scale(0.96);
      }
      .pwa-btn-close {
        background: transparent;
        border: none;
        color: #9387aa;
        font-size: 20px;
        cursor: pointer;
        padding: 4px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 50%;
        line-height: 1;
      }
      .pwa-btn-close:hover {
        color: #ffffff;
      }
      @media (max-width: 480px) {
        #pwa-install-banner {
          bottom: 80px; /* Above mobile bottom navigation bar */
        }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Trigger animation
    setTimeout(() => {
      banner.classList.add('pwa-visible');
    }, 1000);

    // Handle Install Click
    document.getElementById('pwa-install-btn').addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const choiceResult = await deferredPrompt.userChoice;
        if (choiceResult.outcome === 'accepted') {
          console.log('[DoneSpace PWA] User accepted the install prompt');
        }
        deferredPrompt = null;
        banner.classList.remove('pwa-visible');
        setTimeout(() => banner.remove(), 400);
      }
    });

    // Handle Dismiss Click
    document.getElementById('pwa-dismiss-btn').addEventListener('click', () => {
      localStorage.setItem('donespace_pwa_dismissed', 'true');
      banner.classList.remove('pwa-visible');
      setTimeout(() => banner.remove(), 400);
    });
  }

  // Detect if already launched in standalone PWA mode
  window.addEventListener('DOMContentLoaded', () => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
    if (isStandalone) {
      document.body.classList.add('is-pwa-standalone');
      console.log('[DoneSpace PWA] Running in standalone app mode');
    }
  });

})();
