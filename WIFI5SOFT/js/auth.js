import {
    auth, db, signInWithEmailAndPassword, createUserWithEmailAndPassword,
    signInWithPopup, GoogleAuthProvider, onAuthStateChanged, signOut,
    updateProfile, doc, setDoc, getDoc, Timestamp, sendPasswordResetEmail
} from './firebase-config.js';
import { showToast, showLoading } from './utils.js';

export let currentUser = null;
export let userRole = "guest";
let authMode = "login";

export function initAuth() {
    onAuthStateChanged(auth, async (user) => {
        currentUser = user;
        if (user) {
            const userDoc = await getDoc(doc(db, "users", user.uid));
            userRole = userDoc.exists() ? userDoc.data().role : "user";
            updateUIForLoggedIn(user, userRole);
        } else {
            userRole = "guest";
            updateUIForLoggedOut();
        }
        if (window.refreshApp) window.refreshApp();
    });
}

function updateUIForLoggedIn(user, role) {
    const authLinks = document.getElementById("authLinks");
    const userMenu = document.getElementById("userMenu");
    const adminMenuItem = document.getElementById("adminMenuItem");
    const userAvatar = document.getElementById("userAvatar");
    const userName = document.getElementById("userName");
    const userEmail = document.getElementById("userEmail");

    if (authLinks) authLinks.classList.add("hidden");
    if (userMenu) userMenu.classList.remove("hidden");
    if (userAvatar) userAvatar.src = user.photoURL || `https://ui-avatars.com/api/?background=4f46e5&color=fff&name=${user.displayName || user.email}`;
    if (userName) userName.innerText = user.displayName || user.email.split("@")[0];
    if (userEmail) userEmail.innerText = user.email;

    if (role === "admin" && adminMenuItem) {
        adminMenuItem.classList.remove("hidden");
    } else if (adminMenuItem) {
        adminMenuItem.classList.add("hidden");
    }
}

function updateUIForLoggedOut() {
    const authLinks = document.getElementById("authLinks");
    const userMenu = document.getElementById("userMenu");
    if (authLinks) authLinks.classList.remove("hidden");
    if (userMenu) userMenu.classList.add("hidden");
}

export async function loginWithEmail(email, password) {
    if (!email || !password) {
        showToast("Please enter email and password", "error");
        return false;
    }
    
    try {
        showLoading(true);
        await signInWithEmailAndPassword(auth, email, password);
        showToast("Login successful! Welcome back! 🎉");
        window.closeAuthModal();
        return true;
    } catch (error) {
        console.error("Login error:", error);
        
        let errorMessage = "Login failed. ";
        switch (error.code) {
            case 'auth/invalid-email':
                errorMessage = "Invalid email format. Please check your email address.";
                break;
            case 'auth/user-disabled':
                errorMessage = "This account has been disabled. Please contact support.";
                break;
            case 'auth/user-not-found':
                errorMessage = "No account found with this email. Please sign up first.";
                break;
            case 'auth/wrong-password':
                errorMessage = "Incorrect password. Please try again.";
                break;
            case 'auth/too-many-requests':
                errorMessage = "Too many failed attempts. Please try again later.";
                break;
            default:
                errorMessage = error.message || "Login failed. Please check your credentials.";
        }
        
        showToast(errorMessage, "error");
        return false;
    } finally {
        showLoading(false);
    }
}

export async function registerUser(name, email, password) {
    if (!name || !email || !password) {
        showToast("Please fill all fields", "error");
        return false;
    }
    
    if (password.length < 6) {
        showToast("Password must be at least 6 characters", "error");
        return false;
    }
    
    try {
        showLoading(true);
        
        const userCred = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCred.user, { displayName: name });
        await setDoc(doc(db, "users", userCred.user.uid), {
            name: name,
            email: email,
            role: "user",
            createdAt: Timestamp.now(),
            savedVideos: []
        });
        
        showToast("Account created successfully! Please login.", "success");
        window.showAuthModal("login");
        
        // Clear form fields
        document.getElementById("registerName").value = "";
        document.getElementById("authEmail").value = "";
        document.getElementById("authPassword").value = "";
        document.getElementById("confirmPassword").value = "";
        
        return true;
    } catch (error) {
        console.error("Registration error:", error);
        
        let errorMessage = "Registration failed. ";
        switch (error.code) {
            case 'auth/email-already-in-use':
                errorMessage = "This email is already registered. Please login instead.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Invalid email format. Please enter a valid email.";
                break;
            case 'auth/weak-password':
                errorMessage = "Password is too weak. Please use at least 6 characters.";
                break;
            default:
                errorMessage = error.message || "Registration failed. Please try again.";
        }
        
        showToast(errorMessage, "error");
        return false;
    } finally {
        showLoading(false);
    }
}

export async function googleSignIn() {
    try {
        showLoading(true);
        const provider = new GoogleAuthProvider();
        const result = await signInWithPopup(auth, provider);
        const userDoc = await getDoc(doc(db, "users", result.user.uid));
        if (!userDoc.exists()) {
            await setDoc(doc(db, "users", result.user.uid), {
                name: result.user.displayName,
                email: result.user.email,
                role: "user",
                createdAt: Timestamp.now(),
                savedVideos: []
            });
        }
        showToast("Google sign in successful!");
        window.closeAuthModal();
        return true;
    } catch (error) {
        console.error("Google sign in error:", error);
        showToast(error.message, "error");
        return false;
    } finally {
        showLoading(false);
    }
}

export async function resetPassword(email) {
    if (!email) {
        showToast("Please enter your email address", "error");
        return false;
    }
    
    try {
        showLoading(true);
        await sendPasswordResetEmail(auth, email);
        showToast("Password reset email sent! Check your inbox.", "success");
        return true;
    } catch (error) {
        console.error("Password reset error:", error);
        
        let errorMessage = "Failed to send reset email. ";
        switch (error.code) {
            case 'auth/user-not-found':
                errorMessage = "No account found with this email address.";
                break;
            case 'auth/invalid-email':
                errorMessage = "Invalid email format.";
                break;
            default:
                errorMessage = error.message || "Please try again later.";
        }
        
        showToast(errorMessage, "error");
        return false;
    } finally {
        showLoading(false);
    }
}

export async function logout() {
    await signOut(auth);
    showToast("Logged out successfully");
    window.currentUser = null;
    window.userRole = "guest";
    window.navigateTo("home");
    setTimeout(() => {
        window.showAuthModal('login');
    }, 500);
}

// ============================================
// GLOBAL FUNCTIONS FOR WINDOW OBJECT
// ============================================

window.showAuthModal = (mode) => {
    const modal = document.getElementById("authModal");
    if (!modal) return;
    
    document.getElementById("modalTitle").innerText = mode === "login" ? "Login" : "Sign Up";
    document.getElementById("nameField").classList.toggle("hidden", mode === "login");
    document.getElementById("confirmField").classList.toggle("hidden", mode === "login");
    authMode = mode;
    modal.classList.remove("hidden");
    modal.classList.add("flex");
};

window.closeAuthModal = () => {
    const modal = document.getElementById("authModal");
    if (modal) modal.classList.add("hidden");
};

window.toggleAuthMode = () => {
    window.showAuthModal(authMode === "login" ? "register" : "login");
};

window.googleSignIn = googleSignIn;
window.logout = logout;
window.resetPassword = resetPassword;

window.showForgotPassword = async () => {
    const email = document.getElementById("authEmail").value;
    if (!email) {
        showToast("Please enter your email address first", "error");
        return;
    }
    await resetPassword(email);
};

// ============================================
// AUTH FORM HANDLER
// ============================================

document.getElementById("authForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    
    const email = document.getElementById("authEmail").value.trim();
    const password = document.getElementById("authPassword").value;
    
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
        showToast("Please enter a valid email address", "error");
        return;
    }
    
    if (authMode === "login") {
        await loginWithEmail(email, password);
    } else {
        const name = document.getElementById("registerName").value.trim();
        const confirm = document.getElementById("confirmPassword").value;
        
        if (!name) {
            showToast("Please enter your full name", "error");
            return;
        }
        
        if (password !== confirm) {
            showToast("Passwords don't match!", "error");
            return;
        }
        
        await registerUser(name, email, password);
    }
});