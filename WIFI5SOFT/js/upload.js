import { showToast, showLoading } from './utils.js';

function compressImage(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = (event) => {
            const img = new Image();
            img.src = event.target.result;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;
                const maxWidth = 800;
                const maxHeight = 600;
                
                if (width > maxWidth) {
                    height = (height * maxWidth) / width;
                    width = maxWidth;
                }
                if (height > maxHeight) {
                    width = (width * maxHeight) / height;
                    height = maxHeight;
                }
                
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                
                canvas.toBlob((blob) => {
                    resolve(blob);
                }, 'image/jpeg', 0.7);
            };
        };
        reader.onerror = reject;
    });
}

// Using Cloudinary's free unsigned upload (more reliable)
async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', 'ml_default'); // Free unsigned preset
    
    try {
        const response = await fetch('https://api.cloudinary.com/v1_1/demo/image/upload', {
            method: 'POST',
            body: formData
        });
        
        const data = await response.json();
        if (data && data.secure_url) {
            return data.secure_url;
        }
        return null;
    } catch (error) {
        console.error('Cloudinary upload error:', error);
        return null;
    }
}

// Alternative: Use ImageKit.io free upload
async function uploadToImageKit(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('fileName', 'thumbnail_' + Date.now());
    
    try {
        const response = await fetch('https://upload.imagekit.io/api/v1/files/upload', {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + btoa('free_public_key:')
            },
            body: formData
        });
        
        const data = await response.json();
        if (data && data.url) {
            return data.url;
        }
        return null;
    } catch (error) {
        console.error('ImageKit upload error:', error);
        return null;
    }
}

// Simple Base64 storage (no external API needed)
function imageToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result);
        reader.onerror = reject;
    });
}

export async function uploadThumbnail(file) {
    if (!file) return null;
    
    showLoading(true);
    try {
        const compressedFile = await compressImage(file);
        
        // Try Cloudinary first (most reliable)
        let imageUrl = await uploadToCloudinary(compressedFile);
        
        // If Cloudinary fails, use Base64 (local storage in Firestore)
        if (!imageUrl) {
            const base64 = await imageToBase64(compressedFile);
            showToast("Using local thumbnail", "info");
            return base64;
        }
        
        showToast("✓ Thumbnail uploaded!");
        return imageUrl;
    } catch (error) {
        console.error("Upload error:", error);
        showToast("Using default thumbnail", "info");
        return null;
    } finally {
        showLoading(false);
    }
}