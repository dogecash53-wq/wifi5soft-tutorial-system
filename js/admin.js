import { db, storage, collection, addDoc, Timestamp, getDocs, deleteDoc, 
         updateDoc, doc, getDoc, ref, uploadBytes, getDownloadURL } from './firebase-config.js';
import { showToast, showLoading, escapeHtml } from './utils.js';
import { isAdmin, currentUser } from './auth.js';

// Upload thumbnail to Firebase Storage
export async function uploadThumbnail(file, videoId) {
    if (!file) return null;
    
    try {
        const timestamp = Date.now();
        const randomString = Math.random().toString(36).substring(2, 10);
        const fileExtension = file.name.split('.').pop();
        const fileName = `thumb_${videoId}_${timestamp}_${randomString}.${fileExtension}`;
        
        const storageRef = ref(storage, `thumbnails/${fileName}`);
        const snapshot = await uploadBytes(storageRef, file);
        const downloadURL = await getDownloadURL(snapshot.ref);
        
        console.log("Upload successful:", downloadURL);
        return downloadURL;
    } catch (error) {
        console.error("Upload error:", error);
        throw new Error(`Upload failed: ${error.message}`);
    }
}

export async function addTutorial(tutorialData, thumbnailFile) {
    if (!isAdmin()) {
        showToast("Admin access required", "error");
        return false;
    }
    
    try {
        showLoading(true);
        
        let thumbnailURL = "https://placehold.co/400x225/7c3aed/white?text=WiFi5+Tutorial";
        
        if (thumbnailFile) {
            const tempId = Date.now().toString();
            thumbnailURL = await uploadThumbnail(thumbnailFile, tempId);
        }
        
        const data = {
            title: tutorialData.title,
            description: tutorialData.description || "",
            category: tutorialData.category || "General",
            videoURL: tutorialData.videoURL,
            thumbnailURL: thumbnailURL,
            featured: tutorialData.featured || false,
            views: 0,
            likes: 0,
            uploadDate: Timestamp.now(),
            uploader: currentUser?.uid
        };
        
        const docRef = await addDoc(collection(db, "tutorials"), data);
        console.log("Tutorial saved with ID:", docRef.id);
        
        showToast("Tutorial added successfully! 🎉");
        return true;
    } catch (error) {
        console.error("Error adding tutorial:", error);
        showToast("Error: " + error.message, "error");
        return false;
    } finally {
        showLoading(false);
    }
}

export async function updateTutorial(id, updateData, thumbnailFile) {
    if (!isAdmin()) return false;
    
    try {
        showLoading(true);
        
        if (thumbnailFile) {
            const newThumbnailURL = await uploadThumbnail(thumbnailFile, id);
            updateData.thumbnailURL = newThumbnailURL;
        }
        
        const docRef = doc(db, "tutorials", id);
        await updateDoc(docRef, updateData);
        
        showToast("Tutorial updated successfully!");
        return true;
    } catch (error) {
        console.error("Error updating tutorial:", error);
        showToast("Error: " + error.message, "error");
        return false;
    } finally {
        showLoading(false);
    }
}

export async function deleteTutorial(id) {
    if (!isAdmin()) return false;
    
    if (confirm("Delete this tutorial permanently?")) {
        try {
            await deleteDoc(doc(db, "tutorials", id));
            showToast("Tutorial deleted");
            return true;
        } catch (error) {
            showToast("Error deleting tutorial", "error");
            return false;
        }
    }
    return false;
}

export async function getTutorials() {
    try {
        const tutorialsRef = collection(db, "tutorials");
        const querySnapshot = await getDocs(tutorialsRef);
        return querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() }));
    } catch (error) {
        console.error("Error loading tutorials:", error);
        return [];
    }
}

export async function getTutorialById(id) {
    try {
        const docRef = doc(db, "tutorials", id);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            return { id: docSnap.id, data: docSnap.data() };
        }
        return null;
    } catch (error) {
        console.error("Error loading tutorial:", error);
        return null;
    }
}

export async function getAdminStats() {
    if (!isAdmin()) return null;
    
    try {
        const tutorialsSnap = await getDocs(collection(db, "tutorials"));
        const usersSnap = await getDocs(collection(db, "users"));
        
        return {
            totalTutorials: tutorialsSnap.size,
            totalUsers: usersSnap.size,
            totalViews: tutorialsSnap.docs.reduce((sum, d) => sum + (d.data().views || 0), 0),
            tutorials: tutorialsSnap.docs
        };
    } catch (error) {
        console.error("Error getting stats:", error);
        return null;
    }
}