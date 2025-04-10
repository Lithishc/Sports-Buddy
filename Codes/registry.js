import { auth, db } from "./firebase-config.js";
import { createUserWithEmailAndPassword } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { doc, setDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";

// Reference to the registration form
const registerForm = document.getElementById("registerForm");

// Populate the "Interested Games" dropdown from Firestore
const gamesDropdown = document.getElementById("games");

async function populateGamesDropdown() {
    const container = document.getElementById("gamesOptions");
    try {
        const sportsCategoriesRef = collection(db, "sports_categories");
        const querySnapshot = await getDocs(sportsCategoriesRef);

        querySnapshot.forEach((doc) => {
            const category = doc.data().name;
            const label = document.createElement("label");
            label.innerHTML = `
                <input type="checkbox" value="${category}"> ${category}
            `;
            container.appendChild(label);
        });
    } catch (error) {
        console.error("Error fetching sports categories:", error.message);
        alert("Failed to load sports categories. Please try again later.");
    }
}
populateGamesDropdown();

// Toggle dropdown visibility
document.getElementById("gamesInput").addEventListener("click", () => {
    document.getElementById("gamesOptions").style.display =
        document.getElementById("gamesOptions").style.display === "block" ? "none" : "block";
});

// Close dropdown if clicked outside
document.addEventListener("click", function (e) {
    const target = e.target;
    const container = document.getElementById("gamesDropdownContainer");
    if (!container.contains(target)) {
        document.getElementById("gamesOptions").style.display = "none";
    }
});

// On form submit, collect selected games
registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const selected = Array.from(document.querySelectorAll("#gamesOptions input:checked"))
        .map(cb => cb.value);
    if (selected.length === 0) {
        alert("Please select at least one interested game.");
        return;
    }

    document.getElementById("gamesHiddenInput").value = selected.join(",");

    const name = document.getElementById("name").value;
    const email = document.getElementById("email").value;
    const password = document.getElementById("password").value;
    const age = document.getElementById("age").value;
    const gender = document.getElementById("gender").value;
    const skill = document.getElementById("skill").value;
    const location = document.getElementById("location").value;
    const games = selected;

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        await setDoc(doc(db, "users", user.uid), {
            name,
            email,
            age,
            gender,
            skill,
            games,
            location,
            role: "user",
            createdAt: new Date().toISOString()
        });

        alert("Account created successfully! Redirecting to login...");
        registerForm.reset();
        window.location.href = "login.html";
    } catch (error) {
        console.error("Error creating account:", error.message);
        alert(`Error: ${error.message}`);
    }
});

