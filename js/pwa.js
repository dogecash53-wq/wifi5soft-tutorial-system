// PWA Registration for GitHub Pages
export function registerPWA() {
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            // Get the correct base path for GitHub Pages
            const getBasePath = () => {
                const path = window.location.pathname;
                // If we're in a subdirectory (GitHub Pages project page)
                if (path.includes('/wifi5soft') || path.includes('/banz-cajes')) {
                    const parts = path.split('/');
                    return `/${parts[1]}`;
                }
                return '';
            };
            
            const basePath = getBasePath();
            const swPath = basePath ? `${basePath}/sw.js` : '/sw.js';
            
            console.log('Registering service worker at:', swPath);
            
            navigator.serviceWorker.register(swPath)
                .then((registration) => {
                    console.log('Service Worker registered successfully:', registration.scope);
                })
                .catch((error) => {
                    console.error('Service Worker registration failed:', error);
                });
        });
    }
}

export function setupOfflineSupport() {
    window.addEventListener('online', () => {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerHTML = `<div class="px-6 py-3 rounded-lg shadow-2xl bg-green-500 text-white">Back online! 🎉</div>`;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }
    });
    
    window.addEventListener('offline', () => {
        const toast = document.getElementById('toast');
        if (toast) {
            toast.innerHTML = `<div class="px-6 py-3 rounded-lg shadow-2xl bg-red-500 text-white">You are offline. Some features may be limited.</div>`;
            toast.classList.remove('hidden');
            setTimeout(() => toast.classList.add('hidden'), 3000);
        }
    });
}

export function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || 
           window.navigator.standalone === true;
}