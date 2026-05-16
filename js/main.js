import {
    db, collection, query, orderBy, getDocs, doc, updateDoc,
    addDoc, Timestamp, increment, arrayUnion, deleteDoc, getDoc
} from './firebase-config.js';
import { showToast, showLoading, escapeHtml, getYouTubeId, getYouTubeThumbnail, formatNumber } from './utils.js';
import { initAuth, currentUser, userRole } from './auth.js';
import { uploadThumbnail } from './upload.js';
import { getTutorials, renderSidebar, renderMainContent, renderTutorialsGrid } from './components.js';

// Make functions global
window.showToast = showToast;
window.formatNumber = formatNumber;

// Auth initialized flag
let authInitialized = false;

// Cache for tutorials
let cachedTutorials = null;
let lastFetchTime = 0;
const CACHE_DURATION = 5 * 60 * 1000;

// ============================================
// HELPER FUNCTIONS
// ============================================

function getTimeAgo(timestamp) {
    if (!timestamp) return 'Recently';
    const date = timestamp.toDate();
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    if (diffHours < 24) return `${diffHours} hours ago`;
    if (diffDays < 7) return `${diffDays} days ago`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)} weeks ago`;
    return `${Math.floor(diffDays / 30)} months ago`;
}

function formatDescriptionWithLinks(text) {
    if (!text || text === 'No description available.') return text || 'No description available.';

    let formatted = text;

    const urlRegex = /(https?:\/\/[^\s<]+)/g;
    formatted = formatted.replace(urlRegex, function (url) {
        return `<a href="${url}" target="_blank" rel="noopener noreferrer" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300">${url}</a>`;
    });

    formatted = formatted.replace(/\n/g, '<br>');

    const emailRegex = /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g;
    formatted = formatted.replace(emailRegex, function (email) {
        return `<a href="mailto:${email}" class="text-purple-600 hover:text-purple-800 dark:text-purple-400 dark:hover:text-purple-300">${email}</a>`;
    });

    return formatted;
}

const toggleTheme = () => {
    document.body.classList.toggle('dark');
    localStorage.setItem('theme', document.body.classList.contains('dark') ? 'dark' : 'light');
};

async function fetchTutorials(forceRefresh = false) {
    const now = Date.now();
    
    if (!forceRefresh && cachedTutorials && (now - lastFetchTime) < CACHE_DURATION) {
        console.log('Using cached tutorials');
        return cachedTutorials;
    }
    
    console.log('Fetching fresh tutorials');
    showLoading(true);
    
    try {
        const tutorials = await getTutorials(db, collection, query, orderBy, getDocs);
        cachedTutorials = tutorials;
        lastFetchTime = now;
        return tutorials;
    } catch (error) {
        console.error('Error fetching tutorials:', error);
        return cachedTutorials || [];
    } finally {
        showLoading(false);
    }
}

// ============================================
// SIDEBAR FUNCTIONS
// ============================================

function initSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (!sidebar) return;

    const existingToggle = document.querySelector('.sidebar-toggle');
    if (existingToggle) existingToggle.remove();
    
    sidebar.classList.remove('collapsed');
}

function initMobileSidebar() {
    const mobileMenuBtn = document.getElementById('mobileMenuBtn');
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');

    if (!mobileMenuBtn || !sidebar || !overlay) return;

    const newBtn = mobileMenuBtn.cloneNode(true);
    mobileMenuBtn.parentNode.replaceChild(newBtn, mobileMenuBtn);

    const checkMobile = () => {
        if (window.innerWidth <= 1024) {
            newBtn.style.display = 'flex';
        } else {
            newBtn.style.display = 'none';
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
            document.body.style.overflow = '';
        }
    };

    checkMobile();

    newBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.add('open');
        overlay.classList.add('active');
        document.body.classList.add('sidebar-open');
        document.body.style.overflow = 'hidden';
    });

    overlay.addEventListener('click', () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('active');
        document.body.classList.remove('sidebar-open');
        document.body.style.overflow = '';
    });

    sidebar.addEventListener('click', (e) => {
        const sidebarItem = e.target.closest('.sidebar-item');
        if (sidebarItem && window.innerWidth <= 1024) {
            sidebar.classList.remove('open');
            overlay.classList.remove('active');
            document.body.classList.remove('sidebar-open');
            document.body.style.overflow = '';
        }
    });

    window.addEventListener('resize', checkMobile);
}

function setupSidebar() {
    setTimeout(() => {
        initSidebar();
        initMobileSidebar();
    }, 100);
}

function shareVideo() {
    navigator.clipboard.writeText(window.location.href);
    showToast("Link copied to clipboard! 📋");
}

// ============================================
// AUTO-SCROLL TO VIDEO FUNCTION
// ============================================

function scrollToVideoAndPlay() {
    setTimeout(() => {
        const videoContainer = document.getElementById('videoPlayerContainer');
        if (videoContainer) {
            const yOffset = 80;
            const y = videoContainer.getBoundingClientRect().top + window.pageYOffset - yOffset;
            window.scrollTo({ top: y, behavior: 'smooth' });
            
            videoContainer.classList.add('video-highlight');
            setTimeout(() => {
                videoContainer.classList.remove('video-highlight');
            }, 1000);
        }
        
        // Auto-play video
        const videoFrame = document.getElementById('videoFrame');
        const videoPlayer = document.getElementById('videoPlayer');
        
        if (videoFrame) {
            // For YouTube iframe - add autoplay parameter
            const src = videoFrame.src;
            if (src && !src.includes('autoplay=1')) {
                const separator = src.includes('?') ? '&' : '?';
                videoFrame.src = src + separator + 'autoplay=1';
            }
        } else if (videoPlayer) {
            // For HTML5 video
            videoPlayer.play().catch(e => console.log('Auto-play prevented:', e));
        }
    }, 200);
}

// ============================================
// NAVIGATE TO WATCH WITH SCROLL & PLAY
// ============================================

window.navigateToWatchWithScroll = async (videoId) => {
    await window.navigateTo('watch', { id: videoId });
    scrollToVideoAndPlay();
};

// ============================================
// RENDER HOME FUNCTION
// ============================================

async function renderHome(categoryFilter = null) {
    if (!authInitialized) {
        setTimeout(() => renderHome(categoryFilter), 100);
        return;
    }

    if (!currentUser) {
        const appRoot = document.getElementById("appRoot");
        appRoot.innerHTML = `
            <div class="flex items-center justify-center min-h-[60vh]">
                <div class="glass-card text-center p-12 max-w-md mx-auto">
                    <i class="fas fa-lock text-6xl text-purple-500 mb-4"></i>
                    <h2 class="text-2xl font-bold mb-2">Login Required</h2>
                    <p class="text-gray-500 mb-6">Please login to access tutorials and videos</p>
                    <div class="flex gap-3 justify-center">
                        <button onclick="window.showAuthModal('login')" class="btn-primary">Login</button>
                        <button onclick="window.showAuthModal('register')" class="btn-outline">Create Account</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    const appRoot = document.getElementById("appRoot");

    appRoot.innerHTML = `
        <div class="main-layout">
            <aside class="sidebar" id="sidebar"></aside>
            <main class="main-content" id="mainContent"></main>
        </div>
    `;

    const allTutorials = await fetchTutorials();
    window.allTutorials = allTutorials;
    
    const activeCategory = categoryFilter || window.pendingCategory || "All";
    window.currentFilter = { category: activeCategory, searchQuery: "" };

    const categories = ["All", "WiFi Setup", "Router Config", "Piso WiFi", "Networking", "Troubleshooting", "Software"];
    const categoryCounts = {};

    categories.forEach(cat => {
        if (cat === "All") {
            categoryCounts[cat] = allTutorials.length;
        } else {
            categoryCounts[cat] = allTutorials.filter(t => t.data.category === cat).length;
        }
    });

    renderSidebar(categories, window.currentFilter.category, categoryCounts);
    renderMainContent();
    setupSidebar();

    const searchInput = document.getElementById("searchInputPage");
    if (searchInput) {
        const newSearchInput = searchInput.cloneNode(true);
        searchInput.parentNode.replaceChild(newSearchInput, searchInput);

        newSearchInput.addEventListener('input', (e) => {
            window.currentFilter.searchQuery = e.target.value.toLowerCase();
            applyFilters();
        });
    }

    function applyFilters() {
        let filtered = [...window.allTutorials];

        if (window.currentFilter.category !== 'All') {
            filtered = filtered.filter(t => t.data.category === window.currentFilter.category);
        }

        if (window.currentFilter.searchQuery) {
            filtered = filtered.filter(t =>
                t.data.title.toLowerCase().includes(window.currentFilter.searchQuery) ||
                (t.data.description && t.data.description.toLowerCase().includes(window.currentFilter.searchQuery))
            );
        }

        const resultsTitle = document.getElementById("resultsTitle");
        if (resultsTitle) {
            let titleText = "All Tutorials";
            if (window.currentFilter.category !== 'All' && window.currentFilter.searchQuery) {
                titleText = `${window.currentFilter.category} - "${window.currentFilter.searchQuery}" (${filtered.length})`;
            } else if (window.currentFilter.category !== 'All') {
                titleText = `${window.currentFilter.category} Tutorials (${filtered.length})`;
            } else if (window.currentFilter.searchQuery) {
                titleText = `Search: "${window.currentFilter.searchQuery}" (${filtered.length})`;
            } else {
                titleText = `All Tutorials (${filtered.length})`;
            }
            resultsTitle.innerText = titleText;
        }

        renderTutorialsGrid("tutorialsGrid", filtered);
    }

    window.onCategorySelect = (category) => {
        window.currentFilter.category = category;
        document.querySelectorAll('.sidebar-item[data-category]').forEach(item => {
            if (item.getAttribute('data-category') === category) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }
        });
        applyFilters();
    };

    renderTutorialsGrid("tutorialsGrid", allTutorials);
    
    if (activeCategory !== "All") {
        setTimeout(() => {
            if (window.onCategorySelect) {
                window.onCategorySelect(activeCategory);
            }
        }, 100);
    }
}

// ============================================
// RENDER WATCH FUNCTION WITH AUTO-PLAY
// ============================================

async function renderWatch(params) {
    const videoId = params.id;

    if (!authInitialized) {
        setTimeout(() => renderWatch(params), 100);
        return;
    }

    if (!currentUser) {
        const appRoot = document.getElementById("appRoot");
        appRoot.innerHTML = `
            <div class="flex items-center justify-center min-h-[60vh]">
                <div class="glass-card text-center p-12 max-w-md mx-auto">
                    <i class="fas fa-lock text-6xl text-purple-500 mb-4"></i>
                    <i class="fas fa-video text-4xl text-gray-400 mb-4"></i>
                    <h2 class="text-2xl font-bold mb-2">Login Required</h2>
                    <p class="text-gray-500 mb-6">Please login to watch this video</p>
                    <div class="flex gap-3 justify-center">
                        <button onclick="window.showAuthModal('login')" class="btn-primary">Login</button>
                        <button onclick="window.showAuthModal('register')" class="btn-outline">Create Account</button>
                    </div>
                </div>
            </div>
        `;
        return;
    }

    if (!videoId) {
        navigateTo("home");
        return;
    }

    const allTutorials = await fetchTutorials();
    const currentVideo = allTutorials.find(t => t.id === videoId);

    if (!currentVideo) {
        showToast("Video not found", "error");
        navigateTo("home");
        return;
    }

    const categories = ["All", "WiFi Setup", "Router Config", "Piso WiFi", "Networking", "Troubleshooting", "Software"];
    const categoryCounts = {};
    categories.forEach(cat => {
        if (cat === "All") {
            categoryCounts[cat] = allTutorials.length;
        } else {
            categoryCounts[cat] = allTutorials.filter(t => t.data.category === cat).length;
        }
    });

    let recommended = allTutorials.filter(t => t.id !== videoId);
    recommended.sort((a, b) => {
        if (a.data.category === currentVideo.data.category && b.data.category !== currentVideo.data.category) return -1;
        if (a.data.category !== currentVideo.data.category && b.data.category === currentVideo.data.category) return 1;
        return (b.data.views || 0) - (a.data.views || 0);
    });
    recommended = recommended.slice(0, 10);

    const youtubeId = getYouTubeId(currentVideo.data.videoURL);
    // Add autoplay=1 for YouTube videos
    const embedUrl = youtubeId ? `https://www.youtube.com/embed/${youtubeId}?autoplay=1&rel=0` : currentVideo.data.videoURL;

    const descriptionText = currentVideo.data.description || "No description available.";
    const formattedDescription = formatDescriptionWithLinks(escapeHtml(descriptionText));

    const appRoot = document.getElementById("appRoot");
    
    appRoot.innerHTML = `
        <div class="main-layout">
            <aside class="sidebar" id="sidebar"></aside>
            <main class="main-content">
                <div class="watch-container">
                    <div class="watch-main">
                        <div class="video-player-container" id="videoPlayerContainer">
                            <div class="video-wrapper">
                                ${youtubeId ?
                                    `<iframe id="videoFrame" src="${embedUrl}" allow="autoplay; fullscreen" allowfullscreen loading="lazy"></iframe>` :
                                    `<video id="videoPlayer" controls autoplay preload="auto"><source src="${embedUrl}" type="video/mp4"></video>`
                                }
                            </div>
                        </div>
                        
                        <div class="video-info-section">
                            <h1 class="video-title">${escapeHtml(currentVideo.data.title)}</h1>
                            <div class="video-stats">
                                <div class="stats-left">
                                    <span><i class="fas fa-eye"></i> ${formatNumber(currentVideo.data.views || 0)} views</span>
                                    <span><i class="fas fa-calendar-alt"></i> ${getTimeAgo(currentVideo.data.uploadDate)}</span>
                                    <span class="category-badge"><i class="fas fa-tag"></i> ${escapeHtml(currentVideo.data.category)}</span>
                                </div>
                                <div class="stats-right">
                                    <button onclick="window.saveVideo('${videoId}')" class="action-btn">
                                        <i class="fas fa-bookmark"></i> Save
                                    </button>
                                    <button onclick="shareVideo()" class="action-btn">
                                        <i class="fas fa-share-alt"></i> Share
                                    </button>
                                </div>
                            </div>
                            <div class="video-description">
                                <h3>Description</h3>
                                <p>${formattedDescription}</p>
                            </div>
                        </div>
                    </div>
                    
                    <div class="watch-sidebar">
                        <h3 class="recommended-title">Recommended Videos</h3>
                        <div class="recommended-list">
                            ${recommended.map(video => `
                                <div class="recommended-item" onclick="window.navigateToWatchWithScroll('${video.id}')">
                                    <div class="recommended-thumbnail">
                                        <img src="${video.data.thumbnailURL || getYouTubeThumbnail(video.data.videoURL)}" 
                                             loading="lazy"
                                             onerror="this.src='https://placehold.co/120x68/4f46e5/white?text=No+Image'">
                                    </div>
                                    <div class="recommended-info">
                                        <div class="recommended-title-text">${escapeHtml(video.data.title)}</div>
                                        <div class="recommended-meta">
                                            <span>${formatNumber(video.data.views || 0)} views</span>
                                            <span>•</span>
                                            <span>${getTimeAgo(video.data.uploadDate)}</span>
                                        </div>
                                        <div class="recommended-category">${escapeHtml(video.data.category)}</div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                </div>
            </main>
        </div>
    `;
    
    renderSidebar(categories, "All", categoryCounts);
    setupSidebar();

    // Auto-scroll to video after render
    scrollToVideoAndPlay();

    await updateDoc(doc(db, "tutorials", videoId), { views: increment(1) }).catch(console.error);
}

// ============================================
// RENDER ADMIN FUNCTION
// ============================================

async function renderAdmin() {
    if (userRole !== "admin") {
        showToast("Admin access only", "error");
        navigateTo("home");
        return;
    }

    const tutorials = await fetchTutorials(true);
    const appRoot = document.getElementById("appRoot");

    appRoot.innerHTML = `
        <div class="max-w-6xl mx-auto">
            <div class="flex justify-between items-center mb-6">
                <h1 class="text-3xl font-bold text-gray-800 dark:text-white">Admin Dashboard</h1>
                <div class="text-sm text-gray-500">
                    <i class="fas fa-video"></i> ${tutorials.length} Total Tutorials
                </div>
            </div>
            
            <div class="glass-card mb-8">
                <h2 class="text-xl font-bold mb-5 flex items-center gap-2">
                    <i class="fas fa-plus-circle text-green-500"></i>
                    Add New Tutorial
                </h2>
                <form id="uploadForm" class="space-y-4">
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label class="block text-sm font-medium mb-1">Title <span class="text-red-500">*</span></label>
                            <input type="text" id="title" required class="w-full" placeholder="Enter video title">
                        </div>
                        <div>
                            <label class="block text-sm font-medium mb-1">Category <span class="text-red-500">*</span></label>
                            <select id="category" class="w-full">
                                <option value="WiFi Setup">📡 WiFi Setup</option>
                                <option value="Router Config">🔄 Router Config</option>
                                <option value="Piso WiFi">💰 Piso WiFi</option>
                                <option value="Networking">🌐 Networking</option>
                                <option value="Troubleshooting">🔧 Troubleshooting</option>
                                <option value="Software">💻 Software</option>
                            </select>
                        </div>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">Description</label>
                        <textarea id="desc" rows="3" class="w-full" placeholder="Write a detailed description..."></textarea>
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">YouTube URL <span class="text-red-500">*</span></label>
                        <input type="url" id="videoUrl" placeholder="https://www.youtube.com/watch?v=..." required class="w-full">
                    </div>
                    
                    <div>
                        <label class="block text-sm font-medium mb-1">Thumbnail Image</label>
                        <div class="flex items-center gap-4 flex-wrap">
                            <input type="file" id="thumbnailFile" accept="image/*" class="flex-1">
                            <div id="thumbnailPreview" class="hidden">
                                <img id="previewImg" class="thumbnail-preview-img">
                            </div>
                        </div>
                        <p class="text-xs text-gray-500 mt-1">Leave empty to auto-generate from YouTube. Max 2MB.</p>
                    </div>
                    
                    <label class="flex items-center gap-2 cursor-pointer">
                        <input type="checkbox" id="featured" class="w-4 h-4">
                        <span class="text-sm">⭐ Featured Tutorial</span>
                    </label>
                    
                    <button type="submit" class="btn-primary flex items-center gap-2">
                        <i class="fas fa-cloud-upload-alt"></i> Publish Tutorial
                    </button>
                </form>
            </div>
            
            <div class="glass-card">
                <div class="flex justify-between items-center mb-5">
                    <h2 class="text-xl font-bold flex items-center gap-2">
                        <i class="fas fa-list"></i> Manage Tutorials
                    </h2>
                    <span class="text-sm bg-gray-200 dark:bg-gray-700 px-3 py-1 rounded-full">
                        ${tutorials.length} tutorials
                    </span>
                </div>
                
                <div id="tutorialsList" class="space-y-3 max-h-[600px] overflow-y-auto">
                    ${tutorials.length === 0 ? `
                        <div class="text-center py-12 text-gray-500">
                            <i class="fas fa-video-slash text-5xl mb-3"></i>
                            <p>No tutorials yet. Add your first one above!</p>
                        </div>
                    ` : tutorials.map(t => `
                        <div class="tutorial-item bg-gray-50 dark:bg-gray-800 rounded-xl p-4 transition hover:shadow-md" data-id="${t.id}">
                            <div class="flex flex-col md:flex-row gap-4">
                                <div class="flex-shrink-0">
                                    <img src="${t.data.thumbnailURL || 'https://placehold.co/120x68/4f46e5/white?text=No+Image'}" 
                                         class="w-32 h-20 object-cover rounded-lg" 
                                         loading="lazy"
                                         onerror="this.src='https://placehold.co/120x68/4f46e5/white?text=No+Image'">
                                </div>
                                <div class="flex-1">
                                    <h3 class="font-semibold text-gray-800 dark:text-white mb-1">${escapeHtml(t.data.title)}</h3>
                                    <div class="flex flex-wrap items-center gap-3 text-xs text-gray-500 mb-2">
                                        <span><i class="fas fa-eye"></i> ${formatNumber(t.data.views || 0)} views</span>
                                        <span><i class="fas fa-tag"></i> ${escapeHtml(t.data.category) || 'Uncategorized'}</span>
                                        <span><i class="fas fa-calendar"></i> ${getTimeAgo(t.data.uploadDate)}</span>
                                        ${t.data.featured ? '<span class="text-yellow-500"><i class="fas fa-star"></i> Featured</span>' : ''}
                                    </div>
                                    <p class="text-sm text-gray-600 dark:text-gray-400 line-clamp-2">${escapeHtml(t.data.description) || 'No description'}</p>
                                </div>
                                <div class="flex gap-2 flex-shrink-0">
                                    <button onclick="window.editTutorial('${t.id}')" class="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition text-sm flex items-center gap-1">
                                        <i class="fas fa-edit"></i> Edit
                                    </button>
                                    <button onclick="window.deleteTutorial('${t.id}')" class="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition text-sm flex items-center gap-1">
                                        <i class="fas fa-trash"></i> Delete
                                    </button>
                                </div>
                            </div>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    const fileInput = document.getElementById("thumbnailFile");
    if (fileInput) {
        fileInput.addEventListener("change", function (e) {
            const file = e.target.files[0];
            if (file) {
                if (file.size > 2 * 1024 * 1024) {
                    showToast("Image too large! Max 2MB.", "error");
                    this.value = '';
                    return;
                }
                const reader = new FileReader();
                reader.onload = function (event) {
                    document.getElementById("previewImg").src = event.target.result;
                    document.getElementById("thumbnailPreview").classList.remove("hidden");
                };
                reader.readAsDataURL(file);
            }
        });
    }

    document.getElementById("uploadForm").addEventListener("submit", async (e) => {
        e.preventDefault();
        const title = document.getElementById("title").value.trim();
        const videoUrl = document.getElementById("videoUrl").value.trim();
        const thumbnailFile = document.getElementById("thumbnailFile").files[0];

        if (!title || !videoUrl) {
            showToast("Please fill title and video URL", "error");
            return;
        }

        showLoading(true);

        try {
            let thumbnailURL = getYouTubeThumbnail(videoUrl);
            if (thumbnailFile) {
                const uploadedUrl = await uploadThumbnail(thumbnailFile);
                if (uploadedUrl) thumbnailURL = uploadedUrl;
            }

            await addDoc(collection(db, "tutorials"), {
                title: title,
                description: document.getElementById("desc").value || "",
                category: document.getElementById("category").value,
                videoURL: videoUrl,
                thumbnailURL: thumbnailURL,
                featured: document.getElementById("featured").checked,
                views: 0,
                likes: 0,
                uploadDate: Timestamp.now(),
                uploader: currentUser?.uid
            });

            cachedTutorials = null;
            showToast("Tutorial added successfully! 🎉");
            document.getElementById("uploadForm").reset();
            document.getElementById("thumbnailPreview").classList.add("hidden");
            renderAdmin();
            renderHome();
        } catch (error) {
            console.error("Error:", error);
            showToast("Error: " + error.message, "error");
        } finally {
            showLoading(false);
        }
    });
}

// ============================================
// RENDER DASHBOARD FUNCTION
// ============================================

async function renderDashboard() {
    if (!currentUser) {
        showToast("Please login", "error");
        navigateTo("home");
        return;
    }

    const userDoc = await getDoc(doc(db, "users", currentUser.uid));
    const savedVideos = userDoc.data()?.savedVideos || [];

    const appRoot = document.getElementById("appRoot");
    appRoot.innerHTML = `
        <div class="max-w-4xl mx-auto">
            <h1 class="text-3xl font-bold mb-6">My Dashboard</h1>
            <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div class="glass-card text-center">
                    <i class="fas fa-bookmark text-4xl text-purple-500 mb-2"></i>
                    <p class="text-2xl font-bold">${savedVideos.length}</p>
                    <p class="text-gray-500">Saved Videos</p>
                </div>
                <div class="glass-card text-center">
                    <i class="fas fa-user text-4xl text-blue-500 mb-2"></i>
                    <p class="text-lg font-semibold">${escapeHtml(currentUser.displayName || currentUser.email)}</p>
                    <p class="text-gray-500">Welcome back!</p>
                </div>
            </div>
        </div>
    `;
}

// ============================================
// GLOBAL FUNCTIONS
// ============================================

window.saveVideo = async (videoId) => {
    if (!currentUser) {
        showToast("Please login to save videos", "error");
        return;
    }
    try {
        const userRef = doc(db, "users", currentUser.uid);
        await updateDoc(userRef, { savedVideos: arrayUnion(videoId) });
        showToast("✓ Saved to favorites!");
    } catch (error) {
        showToast("Error saving video", "error");
    }
};

window.deleteTutorial = async (id) => {
    if (confirm("Delete this tutorial?")) {
        await deleteDoc(doc(db, "tutorials", id));
        cachedTutorials = null;
        showToast("Deleted");
        renderAdmin();
        renderHome();
    }
};

window.navigateToCategory = async (category) => {
    window.pendingCategory = category;
    await renderHome(category);
    setTimeout(() => {
        window.pendingCategory = null;
    }, 500);
};

window.navigateTo = async (page, params = {}) => {
    if (page === "home") {
        await renderHome(params.category);
    }
    else if (page === "admin") await renderAdmin();
    else if (page === "dashboard") await renderDashboard();
    else if (page === "watch") await renderWatch(params);
    else await renderHome();
};

// ============================================
// EDIT TUTORIAL FUNCTION
// ============================================

window.editTutorial = async (id) => {
    const docRef = doc(db, "tutorials", id);
    const docSnap = await getDoc(docRef);

    if (!docSnap.exists()) {
        showToast("Tutorial not found", "error");
        return;
    }

    const data = docSnap.data();

    const modal = document.createElement('div');
    modal.id = 'editModal';
    modal.className = 'fixed inset-0 bg-black/50 backdrop-blur-sm z-50 hidden items-center justify-center';
    modal.innerHTML = `
        <div class="bg-white dark:bg-gray-800 rounded-2xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div class="flex justify-between items-center mb-4">
                <h3 class="text-2xl font-bold">Edit Tutorial</h3>
                <button onclick="this.closest('#editModal').remove()" class="text-gray-500 hover:text-gray-700">
                    <i class="fas fa-times text-xl"></i>
                </button>
            </div>
            <form id="editFormContent" onsubmit="return false;">
                <input type="hidden" id="editId" value="${id}">
                <div class="space-y-4">
                    <div>
                        <label class="block text-sm font-medium mb-1">Title *</label>
                        <input type="text" id="editTitle" value="${escapeHtml(data.title)}" required class="w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Description</label>
                        <textarea id="editDesc" rows="3" class="w-full">${escapeHtml(data.description || '')}</textarea>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">Category</label>
                        <select id="editCategory" class="w-full">
                            <option value="WiFi Setup" ${data.category === 'WiFi Setup' ? 'selected' : ''}>WiFi Setup</option>
                            <option value="Router Config" ${data.category === 'Router Config' ? 'selected' : ''}>Router Config</option>
                            <option value="Piso WiFi" ${data.category === 'Piso WiFi' ? 'selected' : ''}>Piso WiFi</option>
                            <option value="Networking" ${data.category === 'Networking' ? 'selected' : ''}>Networking</option>
                            <option value="Troubleshooting" ${data.category === 'Troubleshooting' ? 'selected' : ''}>Troubleshooting</option>
                            <option value="Software" ${data.category === 'Software' ? 'selected' : ''}>Software</option>
                        </select>
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">YouTube URL *</label>
                        <input type="url" id="editVideoUrl" value="${escapeHtml(data.videoURL)}" required class="w-full">
                    </div>
                    <div>
                        <label class="block text-sm font-medium mb-1">New Thumbnail (Optional)</label>
                        <input type="file" id="editThumbnail" accept="image/*" class="w-full">
                        <p class="text-xs text-gray-500 mt-1">Leave empty to keep current thumbnail</p>
                    </div>
                    <div class="flex items-center gap-4">
                        <label class="flex items-center gap-2 cursor-pointer">
                            <input type="checkbox" id="editFeatured" ${data.featured ? 'checked' : ''}>
                            <span>Featured Tutorial</span>
                        </label>
                        <div class="current-thumbnail">
                            <p class="text-xs text-gray-500">Current Thumbnail:</p>
                            <img src="${data.thumbnailURL}" class="w-20 h-12 object-cover rounded mt-1">
                        </div>
                    </div>
                    <div class="flex gap-3 pt-4">
                        <button type="submit" class="flex-1 btn-primary py-2 rounded-lg">Save Changes</button>
                        <button type="button" onclick="this.closest('#editModal').remove()" class="flex-1 bg-gray-500 text-white py-2 rounded-lg hover:bg-gray-600">Cancel</button>
                    </div>
                </div>
            </form>
        </div>
    `;

    document.body.appendChild(modal);
    modal.classList.remove('hidden');
    modal.classList.add('flex');

    const editForm = document.getElementById('editFormContent');
    editForm.addEventListener('submit', async (e) => {
        e.preventDefault();

        const editId = document.getElementById('editId').value;
        const title = document.getElementById('editTitle').value.trim();
        const videoUrl = document.getElementById('editVideoUrl').value.trim();
        const thumbnailFile = document.getElementById('editThumbnail').files[0];

        if (!title || !videoUrl) {
            showToast("Please fill title and video URL", "error");
            return;
        }

        showLoading(true);

        try {
            const updateData = {
                title: title,
                description: document.getElementById('editDesc').value || "",
                category: document.getElementById('editCategory').value,
                videoURL: videoUrl,
                featured: document.getElementById('editFeatured').checked
            };

            if (thumbnailFile) {
                if (thumbnailFile.size > 2 * 1024 * 1024) {
                    showToast("Image too large! Max 2MB.", "error");
                    showLoading(false);
                    return;
                }
                const uploadedUrl = await uploadThumbnail(thumbnailFile);
                if (uploadedUrl) updateData.thumbnailURL = uploadedUrl;
            }

            await updateDoc(doc(db, "tutorials", editId), updateData);
            cachedTutorials = null;
            showToast("Tutorial updated successfully!");
            modal.remove();
            renderAdmin();
            renderHome();
        } catch (error) {
            showToast("Error: " + error.message, "error");
        } finally {
            showLoading(false);
        }
    });
};

// ============================================
// INITIALIZATION
// ============================================

initAuth();

setTimeout(() => {
    authInitialized = true;
}, 500);

if (localStorage.getItem('theme') === 'dark') {
    document.body.classList.add('dark');
}

const addThemeToggle = () => {
    const navRight = document.querySelector('nav .flex.items-center.gap-3');
    if (navRight && !document.getElementById('themeToggleBtn')) {
        const themeBtn = document.createElement('button');
        themeBtn.id = 'themeToggleBtn';
        themeBtn.innerHTML = '<i class="fas fa-moon"></i>';
        themeBtn.className = 'p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition';
        themeBtn.onclick = toggleTheme;
        navRight.insertBefore(themeBtn, navRight.firstChild);
    }
};

function setupDropdown() {
    const userMenuBtn = document.getElementById('userMenuBtn');
    const userDropdown = document.getElementById('userDropdown');
    if (userMenuBtn && userDropdown) {
        let hideTimeout;
        
        function showDropdown() {
            if (hideTimeout) clearTimeout(hideTimeout);
            userDropdown.classList.remove('hidden');
        }
        
        function hideDropdown() {
            hideTimeout = setTimeout(() => {
                userDropdown.classList.add('hidden');
            }, 200);
        }
        
        const newUserMenuBtn = userMenuBtn.cloneNode(true);
        userMenuBtn.parentNode.replaceChild(newUserMenuBtn, userMenuBtn);
        
        newUserMenuBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            userDropdown.classList.toggle('hidden');
        });
        
        newUserMenuBtn.addEventListener('mouseenter', showDropdown);
        newUserMenuBtn.addEventListener('mouseleave', hideDropdown);
        userDropdown.addEventListener('mouseenter', showDropdown);
        userDropdown.addEventListener('mouseleave', hideDropdown);
        
        document.addEventListener('click', (e) => {
            if (!newUserMenuBtn.contains(e.target) && !userDropdown.contains(e.target)) {
                userDropdown.classList.add('hidden');
            }
        });
    }
}

const appRoot = document.getElementById("appRoot");
if (appRoot) {
    appRoot.innerHTML = `
        <div class="flex items-center justify-center min-h-[60vh]">
            <div class="text-center">
                <div class="spinner mx-auto mb-4"></div>
                <p class="text-gray-500">Loading...</p>
            </div>
        </div>
    `;
}

addThemeToggle();

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
        setupDropdown();
        startApp();
    });
} else {
    setupDropdown();
    startApp();
}

async function startApp() {
    await new Promise(resolve => {
        const checkAuth = setInterval(() => {
            if (authInitialized) {
                clearInterval(checkAuth);
                resolve();
            }
        }, 100);
        setTimeout(() => {
            clearInterval(checkAuth);
            resolve();
        }, 3000);
    });
    
    fetchTutorials().catch(console.error);
    
    const hash = window.location.hash.replace('#', '');
    if (hash && hash !== 'home') {
        const [page, ...params] = hash.split('?');
        if (page === 'watch') {
            const urlParams = new URLSearchParams(params.join('?'));
            window.navigateTo('watch', { id: urlParams.get('id') });
        } else {
            window.navigateTo(page);
        }
    } else {
        window.navigateTo("home");
    }
}

window.refreshApp = () => window.navigateTo("home");
window.shareVideo = shareVideo;
window.toggleTheme = toggleTheme;