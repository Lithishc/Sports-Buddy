import { initializeApp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js";
import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, getDocs, setDoc, doc, getDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { auth } from "./firebase-config.js";

// Initialize Firestore
const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
    const eventsContainer = document.querySelector(".middle-section");
    const logoutBtn = document.getElementById("logoutBtn");
    const adminNameElement = document.getElementById("adminName");
    const middleSection = document.querySelector(".middle-section");
    let events = [];
    let currentSection = "events"; // default section


    // ✅ **Fetch Admin Name**
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                adminNameElement.textContent = userDoc.exists() ? userDoc.data().name || "Admin" : "Admin";
                
                // ✅ Fetch all events after authentication
                fetchEvents(); 
            } catch (error) {
                console.error("Error fetching admin:", error);
                adminNameElement.textContent = "Admin";
            }
        } else {
            window.location.href = "login.html"; // Redirect if not logged in
        }
    });
    // ✅ Fetch Events (All or Only User's)
    async function fetchEvents(onlyMine = false) {
        try {
            const user = auth.currentUser;
            if (!user) return;
    
            let q;
            if (onlyMine) {
                q = query(
                    collection(db, "events"),
                    where("createdBy", "==", user.uid),  // ✅ Ensure filtering by logged-in user's UID
                    orderBy("timestamp", "desc")
                );
            } else {
                q = query(collection(db, "events"), orderBy("timestamp", "desc"));
            }
    
            const querySnapshot = await getDocs(q);
            events = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
    
            renderEvents(); // ✅ Ensure events update in UI
        } catch (error) {
            console.error("Error fetching events:", error);
        }
    }
    
    async function renderAttendingEvents() {
        const user = auth.currentUser;
        if (!user) return;
    
        const attendingQuery = query(
            collection(db, "attendees"),
            where("userId", "==", user.uid),
            where("status", "==", "attending")
        );
        const canceledQuery = query(
            collection(db, "attendees"),
            where("userId", "==", user.uid),
            where("status", "==", "not attending")
        );
    
        const [attendingSnap, canceledSnap] = await Promise.all([
            getDocs(attendingQuery),
            getDocs(canceledQuery)
        ]);
    
        const attendingIds = attendingSnap.docs.map(doc => doc.data().eventId);
        const canceledIds = canceledSnap.docs.map(doc => doc.data().eventId);
    
        const allEventIds = [...attendingIds, ...canceledIds];
        const eventDocs = await Promise.all(
            allEventIds.map(id => getDoc(doc(db, "events", id)))
        );
    
        const idToEvent = {};
        eventDocs.forEach(doc => {
            if (doc.exists()) {
                idToEvent[doc.id] = { id: doc.id, ...doc.data() };
            }
        });
    
        const attendingEvents = attendingIds.map(id => idToEvent[id]).filter(Boolean);
        const canceledEvents = canceledIds.map(id => idToEvent[id]).filter(Boolean);
    
        middleSection.innerHTML = `
            <div class="header-container">
                <h2>Attending Events</h2>
            </div>
            <div id="attendingWrapper"></div>
    
            <div class="header-container" style="margin-top: 40px;">
                <h2>Cancelled Events(Not Attending)</h2>
            </div>
            <div id="canceledWrapper"></div>
        `;
    
        // Reuse updateEventList but pass different containers
        updateEventList(attendingEvents, "attendingWrapper");
        updateEventList(canceledEvents, "canceledWrapper");
    }
    
    
    
    


    // ✅ **Render Events & Add "Add Event" Button**
    function renderEvents() {
        middleSection.innerHTML = `
            <div class="header-container">
                <h2>Events</h2>
                <button id="AddeventBtn">Add Event</button>
            </div>
            <div id="eventsWrapper"></div>
        `;
    
        document.getElementById("AddeventBtn").addEventListener("click", showAddEventForm);
        updateEventList();
    }
    

    // ✅ **Update Event List**
    async function updateEventList(eventList = events, containerId = "eventsWrapper") {
        const wrapper = document.getElementById(containerId);
        wrapper.innerHTML = "";
    
        const user = auth.currentUser;
        const attendanceMap = user ? await getUserAttendanceMap(user.uid) : {};
    
        eventList.forEach(event => {
            const eventCard = document.createElement("div");
            eventCard.classList.add("event-card");
    
            const status = attendanceMap[event.id]?.status;
            const isAttending = status === "attending";
    
            const attendButton = document.createElement("button");
            attendButton.classList.add("attend-btn");
            attendButton.textContent = isAttending ? "Cancel Attendance" : "Attend";
    
            attendButton.addEventListener("click", () =>
                toggleAttendance(event.id, isAttending, attendanceMap[event.id]?.docId)
            );
    
            eventCard.innerHTML = `
                <h2>${event.title}</h2>
                <span class="pill">${event.date} @ ${event.time}</span>
                <p>${event.description}</p>
                <p class="location"><strong>Location:</strong> ${event.location}</p>
            `;
    
            eventCard.appendChild(attendButton);
            wrapper.appendChild(eventCard);
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
        currentSection = section; // ✅ Track current section
    
        switch (section) {
            case "events":
                fetchEvents();
                break;
            case "attending":
                renderAttendingEvents();
                break;
            case "my-events":
                fetchEvents(true);
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
                document.getElementById("eventsWrapper").innerHTML = `<h2>Coming Soon</h2>`;
        }
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


async function renderAdminList(title, collectionName) {
    eventsContainer.innerHTML = `
        <div class="header-container">
            <h2>${title}</h2>
            <button id="addBtn">Add ${formatSingular(collectionName)}</button>
        </div>
        <ul id="adminList" class="admin-list"></ul>
    `;

    document.getElementById("addBtn").addEventListener("click", () => showInputField(collectionName));

    const querySnapshot = await getDocs(collection(db, collectionName));
    let items = [];

    querySnapshot.forEach(docSnap => {
        items.push({ id: docSnap.id, name: docSnap.data().name });
    });

    // ✅ Restore alphabetical sorting
    items.sort((a, b) => a.name.localeCompare(b.name));

    const listContainer = document.getElementById("adminList");
    listContainer.innerHTML = "";

    let currentLetter = "";
items.forEach(item => {
    const firstLetter = item.name.charAt(0).toUpperCase();

    if (firstLetter !== currentLetter) {
        currentLetter = firstLetter;
        const letterHeader = document.createElement("li");
        letterHeader.classList.add("letter-heading");
        letterHeader.textContent = currentLetter;
        listContainer.appendChild(letterHeader);
    }

    const li = document.createElement("li");
    li.classList.add("admin-item");
    li.innerHTML = `
        <span>${item.name}</span>
        <button class="delete-btn" data-id="${item.id}" data-collection="${collectionName}">Delete</button>
    `;
    listContainer.appendChild(li);
});


    // ✅ Handle delete functionality
    listContainer.addEventListener("click", async (e) => {
        if (e.target.classList.contains("delete-btn")) {
            const id = e.target.getAttribute("data-id");
            const collection = e.target.getAttribute("data-collection");
            if (confirm("Delete this item?")) {
                await deleteDoc(doc(db, collection, id));
                renderAdminList(title, collection);
            }
        }
    });
}

// ✅ Keep the existing input UI unchanged
function showInputField(collectionName) {
    if (document.querySelector(".new-item-input")) return; // Prevent duplicate input fields

    const listContainer = document.getElementById("adminList");

    const inputItem = document.createElement("li");
    inputItem.classList.add("admin-item", "new-item-input");
    inputItem.innerHTML = `
        <input type="text" id="newItemInput" placeholder="Enter ${formatSingular(collectionName)} name">
        <button id="confirmAddBtn">Add</button>
        <button id="cancelAddBtn">Cancel</button>
    `;

    listContainer.insertAdjacentElement("afterbegin", inputItem);

    document.getElementById("confirmAddBtn").addEventListener("click", () => addItem(collectionName));
    document.getElementById("cancelAddBtn").addEventListener("click", () => inputItem.remove());
}

// ✅ Fix singularization
function formatSingular(collectionName) {
    if (collectionName === "sports_categories") return "Category";
    if (collectionName === "cities") return "City";
    if (collectionName === "areas") return "Area";
    return collectionName.slice(0, -1);
}

// ✅ Add new item while keeping sorting intact
function addItem(collectionName) {
    const inputField = document.getElementById("newItemInput");
    const inputName = inputField.value.trim();

    if (inputName) {
        addDoc(collection(db, collectionName), {
            name: inputName,
            timestamp: serverTimestamp()
        }).then(() => {
            renderAdminList(
                collectionName === "sports_categories" ? "Sports Categories" : collectionName.charAt(0).toUpperCase() + collectionName.slice(1),
                collectionName
            );
        }).catch(err => {
            console.error("Add item error:", err);
        });
    }
}


async function getUserAttendanceMap(userId) {
    const q = query(collection(db, "attendees"), where("userId", "==", userId));
    const snapshot = await getDocs(q);
    const map = {};
    snapshot.forEach(docSnap => {
        const data = docSnap.data();
        map[data.eventId] = {
            status: data.status,
            docId: docSnap.id
        };
    });
    return map;
}


async function toggleAttendance(eventId, isAttending, docId) {
    const user = auth.currentUser;
    if (!user) return;

    try {
        const attendanceRef = docId
            ? doc(db, "attendees", docId)
            : doc(collection(db, "attendees"));

        if (isAttending) {
            await updateDoc(attendanceRef, { status: "not attending" });
        } else {
            await setDoc(attendanceRef, {
                userId: user.uid,
                eventId,
                status: "attending"
            });
        }

        // ✅ Only refresh the current section
        switch (currentSection) {
            case "events":
                fetchEvents();
                break;
            case "attending":
                renderAttendingEvents();
                break;
            case "my-events":
                fetchEvents(true);
                break;
        }
    } catch (error) {
        console.error("Error updating attendance:", error);
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
