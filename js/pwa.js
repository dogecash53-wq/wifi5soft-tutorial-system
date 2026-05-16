// PWA Registration and Installation
export function registerPWA() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/sw.js')
                .then((registration) => {
                    console.log('Service Worker registered successfully:', registration.scope);
                    
                    // Check for updates
                    registration.addEventListener('updatefound', () => {
                        const newWorker = registration.installing;
                        console.log('New service worker found');
                        
                        newWorker.addEventListener('statechange', () => {
                            if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
                                showUpdateNotification();
                            }
                        });
                    });
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
    
    // Handle beforeinstallprompt event
    let deferredPrompt;
    
    window.addEventListener('beforeinstallprompt', (e) => {
        console.log('beforeinstallprompt event fired');
        e.preventDefault();
        deferredPrompt = e;
        
        // Show install button
        showInstallButton();
    });
    
    // Handle app installed
    window.addEventListener('appinstalled', () => {
        console.log('App was installed');
        hideInstallButton();
        showToast('App installed successfully! 🎉');
    });
}

function showInstallButton() {
    const installContainer = document.getElementById('installPWA');
    if (installContainer) {
        installContainer.classList.remove('hidden');
        installContainer.innerHTML = `
            <button id="installBtn" class="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2">
                <i class="fas fa-download"></i>
                Install App
            </button>
        `;
        
        document.getElementById('installBtn')?.addEventListener('click', async () => {
            if (deferredPrompt) {
                deferredPrompt.prompt();
                const { outcome } = await deferredPrompt.userChoice;
                console.log(`User response to install: ${outcome}`);
                deferredPrompt = null;
                hideInstallButton();
            }
        });
    }
}

function hideInstallButton() {
    const installContainer = document.getElementById('installPWA');
    if (installContainer) {
        installContainer.classList.add('hidden');
    }
}

function showUpdateNotification() {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerHTML = `
            <div class="px-6 py-3 rounded-lg shadow-2xl bg-blue-500 text-white toast-show">
                New update available! Refresh to update.
                <button onclick="location.reload()" class="ml-3 underline">Refresh</button>
            </div>
        `;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 5000);
    }
}

function showToast(message) {
    const toast = document.getElementById('toast');
    if (toast) {
        toast.innerHTML = `<div class="px-6 py-3 rounded-lg shadow-2xl bg-green-500 text-white toast-show">${message}</div>`;
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 3000);
    }
}

// Check if app is running in standalone mode (installed)
export function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}

// Add offline support detection
export function setupOfflineSupport() {
    window.addEventListener('online', () => {
        showToast('Back online! 🎉');
        document.body.classList.remove('offline-mode');
    });
    
    window.addEventListener('offline', () => {
        showToast('You are offline. Some features may be limited.', 'info');
        document.body.classList.add('offline-mode');
    });
    
    // Check initial status
    if (!navigator.onLine) {
        showToast('You are offline. Some features may be limited.', 'info');
        document.body.classList.add('offline-mode');
    }
}

// Cache videos for offline viewing
export async function cacheVideoForOffline(videoId, videoUrl) {
    if ('serviceWorker' in navigator) {
        try {
            const cache = await caches.open('offline-videos');
            const response = await fetch(videoUrl);
            await cache.put(`/video/${videoId}`, response);
            showToast('Video saved for offline viewing! 📱');
            return true;
        } catch (error) {
            console.error('Failed to cache video:', error);
            return false;
        }
    }
    return false;
}

// Get offline cached videos
export async function getOfflineVideos() {
    if ('serviceWorker' in navigator) {
        const cache = await caches.open('offline-videos');
        const keys = await cache.keys();
        return keys.map(key => key.url);
    }
    return [];
}