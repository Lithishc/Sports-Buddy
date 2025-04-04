import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, doc, getDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { auth } from "./firebase-config.js";

// Initialize Firestore
const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
    const eventsContainer = document.querySelector(".middle-section");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminNameElement = document.getElementById("adminName");
    const middleSection = document.querySelector(".middle-section");
    const sidebarItems = document.querySelectorAll(".sidebar-item");
    let events = [];



    // ✅ **Fetch Admin Name**
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                adminNameElement.textContent = userDoc.exists() ? userDoc.data().name || "Admin" : "Admin";
            } catch (error) {
                console.error("Error fetching admin:", error);
                adminNameElement.textContent = "Admin";
            }
        } else {
            window.location.href = "login.html"; // Redirect if not logged in
        }
    });

    // ✅ **Fetch Events from Firestore**
    async function fetchEvents() {
        try {
            const q = query(collection(db, "events"), orderBy("timestamp", "desc"));
            const querySnapshot = await getDocs(q);

            events = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));

            renderEvents();
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }

    // ✅ **Render Events & Add "Add Event" Button**
    function renderEvents() {
        eventsContainer.innerHTML = `
            <div class="header-container">
                <h2>Event Details</h2>
                <button id="AddeventBtn">Add Event</button>
            </div>
            <div id="eventsWrapper"></div>
        `;

        document.getElementById("AddeventBtn").addEventListener("click", showAddEventForm);
        updateEventList();
    }

    // ✅ **Update Event List**
    function updateEventList() {
        const eventsWrapper = document.getElementById("eventsWrapper");
        eventsWrapper.innerHTML = "";

        events.forEach(event => {
            const eventCard = document.createElement("div");
            eventCard.classList.add("event-card");
            eventCard.innerHTML = `
                <h2>${event.title}</h2>
                <span class="pill">${event.date} @ ${event.time}</span>
                <p>${event.description}</p>
                <p class="location"><strong>Location:</strong> ${event.location}</p>
                <button class="attend-btn">Attend</button>
            `;
            eventsWrapper.appendChild(eventCard);
        });
    }

    // ✅ **Show "Add Event" Form**
    function showAddEventForm() {
        if (document.querySelector(".new-event")) return; // Prevent duplicate forms

        const formHTML = `
            <div class="event-card new-event" style="opacity: 0; transform: scale(0.9);">
                <input type="text" id="eventTitle" class="event-title-input" placeholder="Enter event title">
                <span class="pill">
                    <input type="datetime-local" id="eventDateTime" class="event-date">
                </span>
                <textarea id="eventDescription" class="event-description" placeholder="Enter event details..."></textarea>
                <p class="location">
                    <strong>Location:</strong> <input type="text" id="eventLocationInput" class="event-location" placeholder="Enter location">
                </p>
                <button class="publish-btn">Publish</button>
            </div>
        `;

        document.getElementById("eventsWrapper").insertAdjacentHTML("afterbegin", formHTML);

        // Animate form appearance
        setTimeout(() => {
            document.querySelector(".new-event").style.opacity = "1";
            document.querySelector(".new-event").style.transform = "scale(1)";
        }, 100);

        // Add event listener for "Publish"
        document.querySelector(".publish-btn").addEventListener("click", publishEvent);
    }
    

    // ✅ **Publish Event to Firestore**
    async function publishEvent() {
        const title = document.getElementById("eventTitle").value.trim();
        const dateTime = document.getElementById("eventDateTime").value;
        const description = document.getElementById("eventDescription").value.trim();
        const location = document.getElementById("eventLocationInput").value.trim();

        if (!title || !dateTime || !description || !location) {
            alert("All fields are required!");
            return;
        }

        try {
            const user = auth.currentUser;
            if (!user) {
                alert("You must be logged in to add an event.");
                return;
            }

            const userDoc = await getDoc(doc(db, "users", user.uid));
            const userName = userDoc.exists() ? userDoc.data().name : "Unknown";

            const [date, time] = dateTime.split("T");

            await addDoc(collection(db, "events"), {
                title,
                date: date.split("-").reverse().join("/"),
                time,
                location,
                description,
                createdBy: user.uid,
                creatorName: userName,
                timestamp: serverTimestamp()
            });

            alert("Event added successfully!");
            fetchEvents();
        } catch (error) {
            console.error("Error adding event:", error);
            alert("Failed to add event.");
        }
    }

    function switchSection(section) {
        middleSection.innerHTML = ""; // clear the section
    
        switch (section) {
            case "events":
                renderEvents(); // already implemented
                break;
            case "attending":
                middleSection.innerHTML = "<h2>Attending Events</h2><p>Attending Events</p>";
                break;
            case "my-events":
                middleSection.innerHTML = "<h2>My Events</h2><p>My Events</p>";
                break;
            case "sports":
                renderSimpleList("Sports Categories", ["Football", "Basketball", "Tennis"]);
                break;
            case "cities":
                renderSimpleList("Cities", ["New York", "London", "Delhi"]);
                break;
            case "areas":
                renderSimpleList("Areas", ["Downtown", "Uptown", "Midtown"]);
                break;
        }
    }

    function renderSimpleList(title, items) {
        middleSection.innerHTML = `<h2>${title}</h2>`;
        const ul = document.createElement("ul");
        ul.className = "simple-list";
        items.forEach(item => {
            const li = document.createElement("li");
            li.textContent = item;
            ul.appendChild(li);
        });
        middleSection.appendChild(ul);
    }

    // Handle sidebar navigation clicks
document.querySelectorAll(".sidebar-item").forEach(item => {
    item.addEventListener("click", () => {
        document.querySelectorAll(".sidebar-item").forEach(i => i.classList.remove("active"));
        item.classList.add("active");

        const section = item.getAttribute("data-section");
        switchSection(section);
    });
});

sidebarItems.forEach(item => {
    item.addEventListener("click", () => {
        const section = item.getAttribute("data-section");

        switch (section) {
            case "events":
                fetchEvents();
                break;
            case "sports":
                renderAdminList("Sports Categories", "sports_categories");
                break;
            case "cities":
                renderAdminList("Cities", "cities");
                break;
            case "areas":
                renderAdminList("Areas", "areas");
                break;
            default:
                eventsContainer.innerHTML = `<h2>Coming Soon</h2>`;
        }
    });
});

async function renderAdminList(title, collectionName) {
    eventsContainer.innerHTML = `
        <div class="header-container">
            <h2>${title}</h2>
            <button id="addBtn">Add ${title.slice(0, -1)}</button>
        </div>
        <ul id="adminList" class="admin-list"></ul>
    `;

    document.getElementById("addBtn").addEventListener("click", () => showAddItemForm(collectionName));

    const querySnapshot = await getDocs(collection(db, collectionName));
    let items = [];

    // Fetch and store items
    querySnapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, name: docSnap.data().name });
    });

    // Sort items alphabetically
    items.sort((a, b) => a.name.localeCompare(b.name));

    // Group by first letter
    let groupedItems = {};
    items.forEach(item => {
        let firstLetter = item.name.charAt(0).toUpperCase();
        if (!groupedItems[firstLetter]) {
            groupedItems[firstLetter] = [];
        }
        groupedItems[firstLetter].push(item);
    });

    // Render list
    const listContainer = document.getElementById("adminList");
    listContainer.innerHTML = "";

    Object.keys(groupedItems).sort().forEach(letter => {
        // Add letter heading
        const letterHeading = document.createElement("li");
        letterHeading.classList.add("letter-heading");
        letterHeading.textContent = letter;
        listContainer.appendChild(letterHeading);

        // Add items under the letter
        groupedItems[letter].forEach(item => {
            const li = document.createElement("li");
            li.classList.add("admin-item");
            li.innerHTML = `
                <span>${item.name}</span>
                <button class="delete-btn" data-id="${item.id}" data-collection="${collectionName}">Delete</button>
            `;
            listContainer.appendChild(li);
        });
    });

    // Handle delete button clicks
    listContainer.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-btn")) {
            const id = e.target.getAttribute("data-id");
            const collection = e.target.getAttribute("data-collection");
            if (confirm("Delete this item?")) {
                await deleteDoc(doc(db, collection, id));
                renderAdminList(title, collection); // Refresh after delete
            }
        }
    });
}


function showAddItemForm(collectionName) {
    const inputName = prompt(`Enter new ${collectionName.slice(0, -1)} name:`);

    if (inputName) {
        addDoc(collection(db, collectionName), {
            name: inputName.trim(),
            timestamp: serverTimestamp()
        }).then(() => {
            renderAdminList(
                collectionName === "sports_categories" ? "Sports Categories"
                : collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
                collectionName
            );
        }).catch(err => {
            console.error("Add item error:", err);
        });
    }
}


    // ✅ **Logout Function**
    logoutBtn.addEventListener("click", () => {
        if (confirm("Are you sure you want to logout?")) {
            signOut(auth).then(() => {
                window.location.href = "login.html";
            }).catch(error => {
                console.error("Logout Error:", error);
            });
        }
    });

    // ✅ **Fetch Events on Load**
    fetchEvents();
});
