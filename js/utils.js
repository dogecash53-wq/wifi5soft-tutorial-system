export function showToast(message, type = "success") {
    const toast = document.getElementById("toast");
    const bgColor = type === "error" ? "bg-red-500" : type === "info" ? "bg-blue-500" : "bg-green-500";
    toast.innerHTML = `<div class="px-6 py-3 rounded-lg shadow-2xl ${bgColor} text-white toast-show">${message}</div>`;
    toast.classList.remove("hidden");
    setTimeout(() => toast.classList.add("hidden"), 3000);
}

export function showLoading(show) {
    let loader = document.getElementById("loadingOverlay");
    if (!loader && show) {
        const div = document.createElement("div");
        div.id = "loadingOverlay";
        div.className = "fixed inset-0 bg-black/70 flex items-center justify-center z-50";
        div.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(div);
    }
    loader = document.getElementById("loadingOverlay");
    if (loader) {
        if (show) loader.classList.remove("hidden");
        else loader.classList.add("hidden");
    }
}

export function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

export function getYouTubeId(url) {
    if (!url) return null;
    // Remove any query parameters after the video ID
    let cleanUrl = url.split('?')[0];
    // Also remove any # fragments
    cleanUrl = cleanUrl.split('#')[0];
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=)([^&]+)/,
        /(?:youtu\.be\/)([^?]+)/,
        /(?:youtube\.com\/embed\/)([^?]+)/
    ];
    
    for (let pattern of patterns) {
        const match = cleanUrl.match(pattern);
        if (match) {
            // Clean the video ID from any remaining parameters
            let videoId = match[1];
            videoId = videoId.split('?')[0];
            videoId = videoId.split('&')[0];
            return videoId;
        }
    }
    return null;
}

export function getYouTubeThumbnail(videoUrl) {
    const videoId = getYouTubeId(videoUrl);
    if (videoId) {
        // Use maxresdefault for best quality, fallback to hqdefault
        return `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;
    }
    return "https://placehold.co/400x225/4f46e5/white?text=WiFi5+Tutorial";
}

export function formatNumber(num) {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}