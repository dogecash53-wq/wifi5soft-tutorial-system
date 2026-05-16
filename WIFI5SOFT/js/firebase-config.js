import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// Use environment variables (for build tools)
// For direct deployment, keep config but add security measures
const firebaseConfig = {
    apiKey: "AIzaSyBvNv_zoMHhn-7WfGTzJv-ZB1XfEPGPhRw",
    authDomain: "wifi5soft-tutorial-system.firebaseapp.com",
    projectId: "wifi5soft-tutorial-system",
    storageBucket: "wifi5soft-tutorial-system.firebasestorage.app",
    messagingSenderId: "955837903608",
    appId: "1:955837903608:web:a736dc9313221d8d7cc10d"
};

// Validate config
const requiredConfig = ['apiKey', 'authDomain', 'projectId', 'storageBucket', 'messagingSenderId', 'appId'];
for (const key of requiredConfig) {
    if (!firebaseConfig[key]) {
        console.error(`Missing Firebase config: ${key}`);
    }
}

// Initialize Firebase with error handling
let app;
let auth;
let db;
let storage;

try {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    storage = getStorage(app);
    console.log("Firebase initialized successfully");
} catch (error) {
    console.error("Firebase initialization error:", error);
}

export { auth, db, storage };

// Export all Firebase functions
export { 
    collection, doc, setDoc, getDoc, getDocs, updateDoc, deleteDoc, 
    query, where, orderBy, limit, addDoc, Timestamp, increment, 
    arrayUnion, arrayRemove 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

export { 
    signInWithEmailAndPassword, createUserWithEmailAndPassword, 
    signInWithPopup, GoogleAuthProvider, onAuthStateChanged, 
    signOut, updateProfile, sendPasswordResetEmail 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

export { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";