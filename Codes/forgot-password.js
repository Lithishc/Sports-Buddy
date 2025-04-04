import { auth } from "./firebase-config.js";
import { sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";

const resetEmailInput = document.getElementById("resetEmail");
const resetPasswordButton = document.getElementById("resetPasswordButton");
const resetMessage = document.getElementById("resetMessage");

resetPasswordButton.addEventListener("click", async () => {
    const email = resetEmailInput.value.trim();

    if (!email) {
        resetMessage.textContent = "Please enter your email.";
        resetMessage.style.color = "red";
        return;
    }

    try {
        await sendPasswordResetEmail(auth, email);
        resetMessage.textContent = "Password reset email sent! Check your inbox.";
        resetMessage.style.color = "green";
    } catch (error) {
        resetMessage.textContent = "Error sending reset email. Try again.";
        resetMessage.style.color = "red";
        console.error("Password reset error:", error);
    }
});
