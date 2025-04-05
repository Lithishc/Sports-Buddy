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
                    where("createdBy", "==", user.uid),
                    orderBy("date", "desc") // Default Firestore sorting
                );
            } else {
                q = query(collection(db, "events"), orderBy("date", "desc"));
            }
    
            const querySnapshot = await getDocs(q);
            events = querySnapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
    
            // Sort events by date and time
            events.sort((a, b) => {
                const dateA = new Date(a.date.split("/").reverse().join("-") + "T" + a.time);
                const dateB = new Date(b.date.split("/").reverse().join("-") + "T" + b.time);
                return dateA - dateB; // Ascending order
            });
    
            console.log("Sorted events:", events); // Debugging step
            renderEvents(); // Ensure events update in UI
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
            eventCard.style.position = "relative"; // Needed for absolute positioning
    
            const isCreator = user && event.createdBy === user.uid;
            const status = attendanceMap[event.id]?.status;
            const isAttending = status === "attending";
    
            // Add Delete Button for Event Creator
            if (isCreator) {
                console.log(`Adding delete button for event: ${event.title}`);
                const deleteButton = document.createElement("button");
                deleteButton.classList.add("event-delete-btn");
                deleteButton.textContent = "Delete";
    
                deleteButton.setAttribute("data-id", event.id);
                deleteButton.setAttribute("data-title", event.title);
    
                eventCard.appendChild(deleteButton);
                console.log(`Delete button added for event: ${event.title}`);
            }
    
            const actionButton = document.createElement("button");
            actionButton.classList.add("attend-btn");
    
            if (isCreator) {
                actionButton.textContent = "Edit";
                actionButton.addEventListener("click", () => showEditEventForm(event));
            } else {
                actionButton.textContent = isAttending ? "Drop Out" : "Join Event";
                actionButton.addEventListener("click", () =>
                    toggleAttendance(event.id, isAttending, attendanceMap[event.id]?.docId)
                );
            }
    
            eventCard.innerHTML += `
                <h2>${event.title}</h2>
                <span class="pill">${event.date} @ ${event.time}</span>
                <div class="category-skill">
                    <p class="category"><strong>Sport Category:</strong> ${event.sportCategory || "N/A"}</p>
                    <p class="skill-level"><strong>Skill Level:</strong> ${event.skillLevel || "N/A"}</p>
                </div>
                <p>${event.description}</p>
                <p class="location"><strong>Location:</strong> ${event.location}</p>
            `;
    
            eventCard.appendChild(actionButton);
            wrapper.appendChild(eventCard);
        });
    
        // Attach event listener to the wrapper for delete functionality
        wrapper.addEventListener("click", async (e) => {
            if (e.target.classList.contains("event-delete-btn")) {
                const eventId = e.target.getAttribute("data-id");
                const eventTitle = e.target.getAttribute("data-title");
                console.log(`Delete button clicked for event: ${eventTitle}, ID: ${eventId}`);
                if (confirm("Are you sure you want to delete this event?")) {
                    try {
                        await deleteDoc(doc(db, "events", eventId));
                        alert("Event deleted successfully!");
                        fetchEvents(); // Refresh the event list
                    } catch (error) {
                        console.error("Error deleting event:", error);
                        alert("Failed to delete event. Please check your permissions or try again.");
                    }
                }
            }
        });
    }
    
// ✅ **Update Event in Firestore**
async function updateEvent(event) {
    const title = document.getElementById("eventTitle").value.trim();
    const dateTime = document.getElementById("eventDateTime").value;
    const description = document.getElementById("eventDescription").value.trim();
    const location = document.getElementById("eventLocationInput").value.trim();
    const sportCategory = document.getElementById("sportCategoryInput").value;
    const skillLevel = document.getElementById("skillLevelInput").value;
    const area = document.getElementById("areaDropdown").value;
    const city = document.getElementById("cityDropdown").value;

    if (!title || !dateTime || !description || !location || !sportCategory || !skillLevel || !area || !city) {
        alert("All fields are required!");
        return;
    }

    try {
        const [date, time] = dateTime.split("T");
        await updateDoc(doc(db, "events", event.id), {
            title,
            date: date.split("-").reverse().join("/"),
            time,
            location,
            area,
            city,
            description,
            sportCategory,
            skillLevel
        });

        alert("Event updated successfully!");
        switch (currentSection) {
            case "events":
                fetchEvents(); // Load all events
                break;
            case "my-events":
                fetchEvents(true); // Load only the user's events
                break;
            case "attending":
                renderAttendingEvents(); // Load attending events
                break;
            default:
                fetchEvents(); // Default to all events
        }
    } catch (error) {
        console.error("Error updating event:", error);
        alert("Failed to update event.");
    }
}

// ✅ **Show "Edit Event" Form**
function showEditEventForm(event) {
    // Check if an edit form already exists to prevent duplicates
    if (document.querySelector(".new-event")) return;

    // Fetch areas, cities, sports categories, and skill levels
    const areas = [];
    const cities = [];
    const sportsCategories = [];
    const skillLevels = ["Beginner", "Intermediate", "Advanced"]; // Static skill levels

    // Fetch dropdown data from Firestore
    Promise.all([
        getDocs(collection(db, "areas")),
        getDocs(collection(db, "cities")),
        getDocs(collection(db, "sports_categories"))
    ]).then(([areaSnapshot, citySnapshot, categorySnapshot]) => {
        areaSnapshot.forEach(docSnap => areas.push(docSnap.data().name));
        citySnapshot.forEach(docSnap => cities.push(docSnap.data().name));
        categorySnapshot.forEach(docSnap => sportsCategories.push(docSnap.data().name));

        // Render the edit form
        const formHTML = `
            <div class="event-card new-event" style="opacity: 0; transform: scale(0.9);">
                <input type="text" id="eventTitle" class="event-title-input" value="${event.title}" placeholder="Enter event title">
                <span class="pill">
                    <input type="datetime-local" id="eventDateTime" class="event-date" value="${event.date.split("/").reverse().join("-")}T${event.time}">
                </span>
                <p class="category">
                    <strong>Sport Category:</strong>
                    <select id="sportCategoryInput" class="event-category">
                        <option value="" disabled>Select a category</option>
                        ${sportsCategories.map(category => `<option value="${category}" ${category === event.sportCategory ? "selected" : ""}>${category}</option>`).join("")}
                    </select>
                    <strong>Skill Level:</strong>
                    <select id="skillLevelInput" class="event-skill-level">
                        <option value="" disabled>Select skill level</option>
                        ${skillLevels.map(level => `<option value="${level}" ${level === event.skillLevel ? "selected" : ""}>${level}</option>`).join("")}
                    </select>
                </p>
                <textarea id="eventDescription" class="event-description" placeholder="Enter event details...">${event.description}</textarea>
                <p class="location">
                    <strong>Location:</strong>
                    <input type="text" id="eventLocationInput" class="event-location" value="${event.location}" placeholder="Enter location">
                    <select id="areaDropdown" class="event-area">
                        <option value="" disabled>Select Area</option>
                        ${areas.map(area => `<option value="${area}" ${area === event.area ? "selected" : ""}>${area}</option>`).join("")}
                    </select>
                    <select id="cityDropdown" class="event-city">
                        <option value="" disabled>Select City</option>
                        ${cities.map(city => `<option value="${city}" ${city === event.city ? "selected" : ""}>${city}</option>`).join("")}
                    </select>
                </p>
                <button class="publish-btn">Update</button>
                <button class="cancel-btn">Cancel</button>
            </div>
        `;

        document.getElementById("eventsWrapper").insertAdjacentHTML("afterbegin", formHTML);

        // Animate form appearance
        setTimeout(() => {
            document.querySelector(".new-event").style.opacity = "1";
            document.querySelector(".new-event").style.transform = "scale(1)";
        }, 100);

        // Add event listeners for dropdowns
        document.getElementById("areaDropdown").addEventListener("change", () => {
            const locationInput = document.getElementById("eventLocationInput");
            const selectedArea = document.getElementById("areaDropdown").value;
            locationInput.value = `${locationInput.value.split(",")[0].trim()}, ${selectedArea}`;
        });

        document.getElementById("cityDropdown").addEventListener("change", () => {
            const locationInput = document.getElementById("eventLocationInput");
            const selectedCity = document.getElementById("cityDropdown").value;
            const parts = locationInput.value.split(",");
            locationInput.value = `${parts[0].trim()}, ${parts[1]?.trim() || ""}, ${selectedCity}`.replace(/,\s*,/g, ",");
        });

        // Add event listeners for buttons
        document.querySelector(".publish-btn").addEventListener("click", () => updateEvent(event));
        document.querySelector(".cancel-btn").addEventListener("click", fetchEvents);
    });
}
    
    
    

    // ✅ **Show "Add Event" Form**
    async function showAddEventForm() {
        if (document.querySelector(".new-event")) return; // Prevent duplicate forms
    
        // Fetch areas, cities, sports categories, and skill levels
        const areas = [];
        const cities = [];
        const sportsCategories = [];
        const skillLevels = ["Beginner", "Intermediate", "Advanced"]; // Static skill levels
    
        const areaSnapshot = await getDocs(collection(db, "areas"));
        const citySnapshot = await getDocs(collection(db, "cities"));
        const categorySnapshot = await getDocs(collection(db, "sports_categories"));
    
        areaSnapshot.forEach(docSnap => areas.push(docSnap.data().name));
        citySnapshot.forEach(docSnap => cities.push(docSnap.data().name));
        categorySnapshot.forEach(docSnap => sportsCategories.push(docSnap.data().name));
    
        const formHTML = `
            <div class="event-card new-event" style="opacity: 0; transform: scale(0.9);">
                <input type="text" id="eventTitle" class="event-title-input" placeholder="Enter event title">
                <span class="pill">
                    <input type="datetime-local" id="eventDateTime" class="event-date">
                </span>
                <p class="category">
                    <strong>Sport Category:</strong>
                    <select id="sportCategoryInput" class="event-category">
                        <option value="" disabled selected>Select a category</option>
                        ${sportsCategories.map(category => `<option value="${category}">${category}</option>`).join("")}
                    </select>
                    <strong>Skill Level:</strong>
                    <select id="skillLevelInput" class="event-skill-level">
                        <option value="" disabled selected>Select skill level</option>
                        ${skillLevels.map(level => `<option value="${level}">${level}</option>`).join("")}
                    </select>
                </p>
                <textarea id="eventDescription" class="event-description" placeholder="Enter event details..."></textarea>
                <p class="location">
                    <strong>Location:</strong>
                    <input type="text" id="eventLocationInput" class="event-location" placeholder="Enter location">
                    <select id="areaDropdown" class="event-area">
                        <option value="" disabled selected>Select Area</option>
                        ${areas.map(area => `<option value="${area}">${area}</option>`).join("")}
                    </select>
                    <select id="cityDropdown" class="event-city">
                        <option value="" disabled selected>Select City</option>
                        ${cities.map(city => `<option value="${city}">${city}</option>`).join("")}
                    </select>
                </p>
                <button class="publish-btn">Publish</button>
                <button class="cancel-btn">Cancel</button>
            </div>
        `;
    
        document.getElementById("eventsWrapper").insertAdjacentHTML("afterbegin", formHTML);
    
        // Animate form appearance
        setTimeout(() => {
            document.querySelector(".new-event").style.opacity = "1";
            document.querySelector(".new-event").style.transform = "scale(1)";
        }, 100);
    
        // Add event listeners for dropdowns
        document.getElementById("areaDropdown").addEventListener("change", () => {
            const locationInput = document.getElementById("eventLocationInput");
            const selectedArea = document.getElementById("areaDropdown").value;
            locationInput.value = `${locationInput.value.split(",")[0].trim()}, ${selectedArea}`;
        });
    
        document.getElementById("cityDropdown").addEventListener("change", () => {
            const locationInput = document.getElementById("eventLocationInput");
            const selectedCity = document.getElementById("cityDropdown").value;
            const parts = locationInput.value.split(",");
            locationInput.value = `${parts[0].trim()}, ${parts[1]?.trim() || ""}, ${selectedCity}`.replace(/,\s*,/g, ",");
        });
    
        // Add event listeners for buttons
        document.querySelector(".publish-btn").addEventListener("click", publishEvent);
        document.querySelector(".cancel-btn").addEventListener("click", fetchEvents);
    }

    // ✅ **Publish Event to Firestore**
    async function publishEvent() {
        const title = document.getElementById("eventTitle").value.trim();
        const dateTime = document.getElementById("eventDateTime").value;
        const description = document.getElementById("eventDescription").value.trim();
        const location = document.getElementById("eventLocationInput").value.trim();
        const sportCategory = document.getElementById("sportCategoryInput").value;
        const skillLevel = document.getElementById("skillLevelInput").value; // Get selected skill level
        const area = document.getElementById("areaDropdown").value;
        const city = document.getElementById("cityDropdown").value;
    
        if (!title || !dateTime || !description || !location || !sportCategory || !skillLevel || !area || !city) {
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
                area,
                city,
                description,
                sportCategory,
                skillLevel, // Save skill level
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
