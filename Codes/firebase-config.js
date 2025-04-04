import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyCgn0SFCOpzG_0aFUA7Pz_KswWkGLduI6Q",
    authDomain: "sports-buddy-5ee29.firebaseapp.com",
    projectId: "sports-buddy-5ee29",
    storageBucket: "sports-buddy-5ee29.firebasestorage.app",
    messagingSenderId: "44726938291",
    appId: "1:44726938291:web:499089f55522e58ec4dec6",
    measurementId: "G-Z78LDND4XW"
  };

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
