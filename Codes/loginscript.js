// Import Firebase modules
import { auth } from "./firebase-config.js";
import { signInWithEmailAndPassword, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

console.log("loginscript.js loaded");

// Initialize Firestore
const db = getFirestore();

// DOM Elements
const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const errorMessage = document.getElementById("errorMessage");
const toggleUserBtn = document.getElementById("toggleUser");
const toggleAdminBtn = document.getElementById("toggleAdmin");
const forgotPasswordLink = document.getElementById("forgotPassword");
const createAccountLink = document.getElementById("createAccount");

let loginMode = "user"; // Default mode is "User"

// Function to update UI based on selected mode
function updateToggleUI() {
    toggleUserBtn.classList.toggle("active", loginMode === "user");
    toggleAdminBtn.classList.toggle("active", loginMode === "admin");
    console.log(`Login mode: ${loginMode}`);
}

// Event Listeners for Toggle Buttons
toggleUserBtn.addEventListener("click", () => {
    loginMode = "user";
    updateToggleUI();
});

toggleAdminBtn.addEventListener("click", () => {
    loginMode = "admin";
    updateToggleUI();
});

// Handle Login
loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const email = emailInput.value.trim();
    const password = passwordInput.value.trim();

    if (!email || !password) {
        errorMessage.textContent = "Please enter both email and password.";
        return;
    }

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Login Successful:", user);

        // 🔍 Step 1: Get user role from Firestore
        const userDoc = await getDoc(doc(db, "users", user.uid));

        if (!userDoc.exists()) {
            errorMessage.textContent = "User not found in database!";
            return;
        }

        const userData = userDoc.data();
        const role = userData.role; // 🔥 Get role from Firestore
        const name = userData.name;
        
        console.log("User Role:", role);
        console.log("Selected Login Mode:", loginMode);

        // ❌ Step 2: Block login if role mismatch
        if (role !== loginMode) {
            errorMessage.textContent = `Access Denied! You are registered as a "${role}" but selected "${loginMode}".`;
            return;
        }

        // 🔀 Step 3: Redirect based on role
        if (role === "admin") {
            window.location.href = "admin-dashboard.html";
        } else {
            window.location.href = "user-dashboard.html";
        }
    } catch (error) {
        errorMessage.textContent = "Invalid email or password.";
        console.error("Login error:", error);
    }
});

// Handle Password Reset
forgotPasswordLink.addEventListener("click", async (e) => {
    e.preventDefault();
    
    const email = prompt("Enter your email to reset password:");
    if (email) {
        try {
            await sendPasswordResetEmail(auth, email);
            alert("Password reset email sent! Check your inbox.");
        } catch (error) {
            alert("Error sending reset email. Make sure your email is correct.");
            console.error("Password reset error:", error);
        }
    }
});

// Redirect to Register Page
createAccountLink.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "registry.html";
});

// Ensure the correct toggle button is highlighted on page load
updateToggleUI();
