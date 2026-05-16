import { escapeHtml, getYouTubeThumbnail, formatNumber } from './utils.js';
import { userRole } from './auth.js';

export async function getTutorials(db, collection, query, orderBy, getDocs) {
    const q = query(collection(db, "tutorials"), orderBy("uploadDate", "desc"));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
}

export function renderSidebar(categories, selectedCategory, categoryCounts) {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const isLoggedIn = window.currentUser !== null;

    const categoryIcons = {
        'All': 'fa-home',
        'WiFi Setup': 'fa-wifi',
        'Router Config': 'fa-server',
        'Piso WiFi': 'fa-coins',
        'Networking': 'fa-network-wired',
        'Troubleshooting': 'fa-wrench',
        'Software': 'fa-code'
    };

    sidebar.innerHTML = `
        <div class="sidebar-section">
            <div class="sidebar-header">MENU</div>
            <div class="sidebar-nav">
                <button data-category="All" class="sidebar-item ${selectedCategory === 'All' ? 'active' : ''}">
                    <i class="fas fa-home"></i>
                    <span>Home</span>
                </button>
            </div>
        </div>
        
        <div class="sidebar-divider"></div>
        
        <div class="sidebar-section">
            <div class="sidebar-header">CATEGORIES</div>
            <div class="sidebar-nav">
                ${categories.filter(cat => cat !== 'All').map(cat => {
        const count = categoryCounts[cat] || 0;
        const isActive = selectedCategory === cat;
        const icon = categoryIcons[cat] || 'fa-folder';
        return `
                        <button data-category="${cat}" class="sidebar-item ${isActive ? 'active' : ''}">
                            <i class="fas ${icon}"></i>
                            <span>${cat}</span>
                            ${count > 0 ? `<span class="count">${count}</span>` : ''}
                        </button>
                    `;
    }).join('')}
            </div>
        </div>
        
        <div class="sidebar-divider"></div>
        
        <div class="sidebar-section">
            <div class="sidebar-nav">
                ${isLoggedIn ? `
                    <button data-nav="dashboard" class="sidebar-item">
                        <i class="fas fa-tachometer-alt"></i>
                        <span>Dashboard</span>
                    </button>
                    ${window.userRole === "admin" ? `
                        <button data-nav="admin" class="sidebar-item">
                            <i class="fas fa-crown"></i>
                            <span>Admin Panel</span>
                        </button>
                    ` : ''}
                    <hr class="my-2">
                    <button data-nav="logout" class="sidebar-item text-red-500">
                        <i class="fas fa-sign-out-alt"></i>
                        <span>Sign Out</span>
                    </button>
                ` : `
                    <button data-auth="login" class="sidebar-item">
                        <i class="fas fa-sign-in-alt"></i>
                        <span>Sign In</span>
                    </button>
                    <button data-auth="register" class="sidebar-item">
                        <i class="fas fa-user-plus"></i>
                        <span>Create Account</span>
                    </button>
                `}
            </div>
        </div>
    `;

    // Attach event listeners AFTER sidebar is rendered
    attachSidebarEventListeners();
}

// Separate function to attach event listeners
function attachSidebarEventListeners() {
    // Handle category buttons
    document.querySelectorAll('.sidebar-item[data-category]').forEach(btn => {
        // Remove existing listener by cloning
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const category = newBtn.getAttribute('data-category');

            // Always navigate to home with category
            if (window.navigateToCategory) {
                window.navigateToCategory(category);
            } else {
                // Fallback
                window.location.hash = 'home';
                setTimeout(() => {
                    if (window.onCategorySelect) {
                        window.onCategorySelect(category);
                    }
                }, 100);
            }
        });
    });

    // Handle navigation buttons
    document.querySelectorAll('.sidebar-item[data-nav]').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const nav = newBtn.getAttribute('data-nav');
            if (nav === 'dashboard') {
                window.navigateTo('dashboard');
            } else if (nav === 'admin') {
                window.navigateTo('admin');
            } else if (nav === 'logout') {
                window.logout();
            }
        });
    });

    // Handle auth buttons
    document.querySelectorAll('.sidebar-item[data-auth]').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);

        newBtn.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            const auth = newBtn.getAttribute('data-auth');
            if (auth === 'login') {
                window.showAuthModal('login');
            } else if (auth === 'register') {
                window.showAuthModal('register');
            }
        });
    });
}

export function renderMainContent() {
    const mainContent = document.getElementById("mainContent");
    if (!mainContent) return;

    mainContent.innerHTML = `
        <div class="search-header">
            <div class="flex justify-between items-center flex-wrap gap-4">
                <h2 class="text-2xl font-bold"><span id="resultsTitle">All Tutorials</span></h2>
                <div class="relative">
                    <i class="fas fa-search absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"></i>
                    <input type="text" id="searchInputPage" placeholder="Search tutorials..." 
                           class="pl-10 pr-4 py-2 rounded-full bg-gray-100 dark:bg-gray-800 border-0 focus:ring-2 focus:ring-purple-500 w-full md:w-80">
                </div>
            </div>
        </div>
        <div id="tutorialsGrid" class="video-grid"></div>
    `;
}

export function renderTutorialsGrid(containerId, tutorials) {
    const container = document.getElementById(containerId);
    if (!container) return;

    if (tutorials.length === 0) {
        container.innerHTML = `
            <div class="col-span-full text-center py-12">
                <i class="fas fa-video text-6xl text-gray-400 mb-4"></i>
                <p class="text-gray-500">No tutorials yet.</p>
                ${userRole === "admin" ? '<button onclick="window.navigateTo(\'admin\')" class="mt-4 btn-primary">Add Your First Tutorial</button>' : ''}
            </div>
        `;
        return;
    }

    container.innerHTML = tutorials.map(t => {
        let thumbUrl = t.data.thumbnailURL || getYouTubeThumbnail(t.data.videoURL);
        return `

<div class="video-card" onclick="window.navigateToWatchWithScroll('${t.id}')">
                <img src="${thumbUrl}" alt="${escapeHtml(t.data.title)}" onerror="this.src='https://placehold.co/400x225/4f46e5/white?text=WiFi5'">
                <div class="p-4">
                    <h3 class="font-semibold text-lg line-clamp-2">${escapeHtml(t.data.title)}</h3>
                    <p class="text-sm mt-1"><i class="fas fa-eye"></i> ${formatNumber(t.data.views || 0)} views</p>
                    <div class="mt-2">
                        <span class="category-badge">${escapeHtml(t.data.category) || 'General'}</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}