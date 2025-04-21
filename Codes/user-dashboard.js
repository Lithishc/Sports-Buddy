import { getAuth, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js";
import { getFirestore, collection, addDoc, updateDoc, deleteDoc, getDocs, setDoc, doc, getDoc, query, where, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js";
import { auth } from "./firebase-config.js";

// Initialize Firestore
const db = getFirestore();

document.addEventListener("DOMContentLoaded", () => {
    const eventsContainer = document.querySelector(".middle-section");
    const logoutBtn = document.getElementById("logoutBtn");
    const userNameElement = document.getElementById("userName");
    const middleSection = document.querySelector(".middle-section");
    let events = [];
    let currentSection = "events"; // default section

// **Fetch User Name**
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            try {
                const userDoc = await getDoc(doc(db, "users", user.uid));
                userNameElement.textContent = userDoc.exists() ? userDoc.data().name || "User" : "User";
                
                //  Fetch all events after authentication
                fetchEvents(); 
            } catch (error) {
                console.error("Error fetching user:", error);
                userNameElement.textContent = "User";
            }
        } else {
            window.location.href = "login.html"; // Redirect if not logged in
        }
    });

    //Fetch Events (All or Only User's)
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
        
            // Inject "status" property for filtering later
            const attendingEvents = attendingIds.map(id => ({ ...idToEvent[id], status: "attending" })).filter(Boolean);
            const canceledEvents = canceledIds.map(id => ({ ...idToEvent[id], status: "not attending" })).filter(Boolean);
        
            // Save globally if needed for search filtering
            events = [...attendingEvents, ...canceledEvents];
        
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
        
            updateEventList(attendingEvents, "attendingWrapper");
            updateEventList(canceledEvents, "canceledWrapper");
        }
        
        
        
        
        
    
    
        // **Render Events & Add "Add Event" Button**
        function renderEvents() {
            if (currentSection == "events" ){// Ensure this function only runs for the "events" section
        
            middleSection.innerHTML = `
                <div class="header-container">
                    <h2>Events</h2>
                    <button id="AddeventBtn">Add Event</button>
                </div>
                <div id="eventsWrapper"></div>
            `;
        
            document.getElementById("AddeventBtn").addEventListener("click", showAddEventForm);
            updateEventList(events, "eventsWrapper"); // Update the event list for the "events" section
            }
            else if(currentSection == "my-events"){
                middleSection.innerHTML = `
                    <div class="header-container">
                        <h2>My Events</h2>
                        <button id="AddeventBtn">Add Event</button>
                    </div>
                    <div id="eventsWrapper"></div>
                `;
                document.getElementById("AddeventBtn").addEventListener("click", showAddEventForm);
                updateEventList(events, "eventsWrapper"); // Update the event list with only the user's events
            }
            else{
                return;
            }
    
        }
    
        //**Update Event List**
        async function updateEventList(eventList = events, containerId = "eventsWrapper") {
                    const wrapper = document.getElementById(containerId);
                    wrapper.innerHTML = "";
                
                    const user = auth.currentUser;
                    const attendanceMap = user ? await getUserAttendanceMap(user.uid) : {};
                
                    eventList.forEach(event => {
                        const eventCard = document.createElement("div");
                        eventCard.classList.add("event-card");
                        eventCard.style.position = "relative";
                
                        const isCreator = user && event.createdBy === user.uid;
                        const status = attendanceMap[event.id]?.status;
                        const isAttending = status === "attending";
                
                        // Create action button
                        const actionButton = document.createElement("button");
                        actionButton.classList.add("attend-btn");
                
                        //  Only show Edit/Delete if in "my-events" section and user is the creator
                        if (currentSection === "my-events" && isCreator) {
                            const deleteButton = document.createElement("button");
                            deleteButton.classList.add("event-delete-btn");
                            deleteButton.textContent = "Delete";
                            deleteButton.setAttribute("data-id", event.id);
                            deleteButton.setAttribute("data-title", event.title);
                            eventCard.appendChild(deleteButton);
                
                            actionButton.textContent = "Edit";
                            actionButton.addEventListener("click", () => showEditEventForm(event));
                        } else {
                            actionButton.textContent = isAttending ? "Drop Out" : "Join Event";
                            actionButton.addEventListener("click", () =>
                                toggleAttendance(event.id, isAttending, attendanceMap[event.id]?.docId)
                            );
                        }
                
                        eventCard.innerHTML += `
                         <h2>
                             ${event.title}
                                ${isCreator ? `<span class="event-badge">My Event</span>` : ""}
                        </h2>
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
                
                    // Delete button handler
                    wrapper.addEventListener("click", async (e) => {
                        if (e.target.classList.contains("event-delete-btn")) {
                            const eventId = e.target.getAttribute("data-id");
                            const eventTitle = e.target.getAttribute("eventtitle");
                            if (confirm("Are you sure you want to delete this event: ?")) {
                                try {
                                    await deleteDoc(doc(db, "events", eventId));
                                    alert("Event deleted successfully!");
                                    if (currentSection === "my-events") {
                                        fetchEvents(true);
                                    } else {
                                        fetchEvents();
                                    } // Refresh the list
                                } catch (error) {
                                    console.error("Error deleting event:", error);
                                    alert("Failed to delete event.");
                                }
                            }
                        }
                    });
                }
        
    // **Update Event in Firestore**
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
       //**Show "Edit Event" Form**
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
               document.querySelector(".publish-btn").addEventListener("click", () => {
                if (currentSection === "my-events") {
                    updateEvent(event);
                    fetchEvents(true);
                } else {
                    updateEvent(event);
                    fetchEvents();
                }
            });
               document.querySelector(".cancel-btn").addEventListener("click", () => {
                if (currentSection === "my-events") {
                    fetchEvents(true);
                } else {
                    fetchEvents();
                }
            });
           });
       }
           
   
           
       
           //**Show "Add Event" Form**
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
               document.querySelector(".publish-btn").addEventListener("click", () => {
                if (currentSection === "my-events") {
                    publishEvent();
                    fetchEvents(true);
                } else {
                    publishEvent();
                    fetchEvents();
                }
            });
               document.querySelector(".cancel-btn").addEventListener("click", () => {
                if (currentSection === "my-events") {
                    fetchEvents(true);
                } else {
                    fetchEvents();
                }
            });
            
           }
       
           // **Publish Event to Firestore**
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
                   if (currentSection === "my-events") {
                    fetchEvents(true);
                } else {
                    fetchEvents();
                }
               } catch (error) {
                   console.error("Error adding event:", error);
                   alert("Failed to add event.");
               }
           }
       
           function switchSection(section) {
               currentSection = section; //  Track current section
           
               switch (section) {
                   case "events":
                       fetchEvents(); // Fetch all events
                       break;
                   case "attending":
                       renderAttendingEvents(); // Fetch attending and not attending events
                       break;
                   case "my-events":
                       renderEvents(); // Render the My Events section
                       fetchEvents(true); // Fetch only the user's events
                       break;
                    case "participants":
                        loadparticipants(); // Load participants for the user's created events
                        break;
                   default:
                       middleSection.innerHTML = `<h2>Coming Soon</h2>`;
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

        // Only refresh the current section
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

async function loadparticipants() {
    const user = auth.currentUser;
    if (!user) return;
  
    const q = query(collection(db, "events"), where("createdBy", "==", user.uid));
    const eventsSnapshot = await getDocs(q);
  
    const middleSection = document.querySelector(".middle-section");
    middleSection.innerHTML = `
      <div class="header-container">
        <h2>Participants for My Created Events</h2>
      </div>
    `;
  
    for (const eventDoc of eventsSnapshot.docs) {
      const eventData = eventDoc.data();
      const eventId = eventDoc.id;
  
      // Event card container
      const eventCard = document.createElement("div");
      eventCard.className = "event-participant";
  
      const title = document.createElement("h2");
      title.textContent = `Event: ${eventData.title}`;
  
      const toggleButton = document.createElement("button");
      toggleButton.className = "toggle-button";
      toggleButton.textContent = "Show Participants";
  
      const participantListContainer = document.createElement("div");
      participantListContainer.style.display = "none";
  
      toggleButton.addEventListener("click", async () => {
        if (participantListContainer.style.display === "none") {
          participantListContainer.innerHTML = "Loading participants...";
  
          const attendeesQuery = query(
            collection(db, "attendees"),
            where("eventId", "==", eventId),
            where("status", "==", "attending")
          );
          const attendeesSnapshot = await getDocs(attendeesQuery);
  
          participantListContainer.innerHTML = "";
  
          if (attendeesSnapshot.empty) {
            participantListContainer.innerHTML = "<p>No participants found.</p>";
          } else {
            for (const attendeeDoc of attendeesSnapshot.docs) {
              const attendee = attendeeDoc.data();
              const userSnap = await getDoc(doc(db, "users", attendee.userId));
  
              if (userSnap.exists()) {
                const userData = userSnap.data();
                const participantCard = document.createElement("div");
                participantCard.className = "participant-card";
  
                participantCard.innerHTML = `
                  <strong>Name:</strong> ${userData.name || "N/A"}<br>
                  <strong>Skill:</strong> ${userData.skill || "N/A"}<br>
                  <strong>Age:</strong> ${userData.age || "N/A"}<br>
                  <strong>Gender:</strong> ${userData.gender || "N/A"}<br>
                  <strong>Email:</strong> ${userData.email || "N/A"}
                `;
  
                participantListContainer.appendChild(participantCard);
              }
            }
          }
  
          participantListContainer.style.display = "block";
          toggleButton.textContent = "Hide Participants";
        } else {
          participantListContainer.style.display = "none";
          toggleButton.textContent = "Show Participants";
        }
      });
  
      eventCard.appendChild(title);
      eventCard.appendChild(toggleButton);
      eventCard.appendChild(participantListContainer);
      middleSection.appendChild(eventCard);
    }
  }
// **Logout Function**
logoutBtn.addEventListener("click", () => {
    if (confirm("Are you sure you want to logout?")) {
        signOut(auth).then(() => {
            window.location.href = "login.html";
        }).catch(error => {
            console.error("Logout Error:", error);
        });
    }
});


//Right section code


//right section search and filter code
document.getElementById("filterInput").addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase();

    let filteredData = [];

    // Clear old "no results" messages
    document.querySelectorAll(".no-results-msg").forEach(el => el.remove());

    switch (currentSection) {
        case "events":
            filteredData = events.filter(event => {
                return (
                    (event.title || "").toLowerCase().includes(query) ||
                    (event.date || "").toLowerCase().includes(query) ||
                    (event.time || "").toLowerCase().includes(query) ||
                    (event.location || "").toLowerCase().includes(query) ||
                    (event.area || "").toLowerCase().includes(query) ||
                    (event.city || "").toLowerCase().includes(query) ||
                    (event.skillLevel || "").toLowerCase().includes(query) ||
                    (event.sportCategory || "").toLowerCase().includes(query)
                );
            });
            updateEventList(filteredData, "eventsWrapper");

            if (filteredData.length === 0) {
                const msg = document.createElement("p");
                msg.className = "no-results-msg";
                msg.textContent = "No events match your search.";
                msg.style.textAlign = "center";
                document.getElementById("eventsWrapper").appendChild(msg);
            }
            break;

        case "my-events":
            filteredData = events.filter(event => {
                return (
                    (event.title || "").toLowerCase().includes(query) ||
                    (event.date || "").toLowerCase().includes(query) ||
                    (event.time || "").toLowerCase().includes(query) ||
                    (event.location || "").toLowerCase().includes(query) ||
                    (event.area || "").toLowerCase().includes(query) ||
                    (event.city || "").toLowerCase().includes(query) ||
                    (event.skillLevel || "").toLowerCase().includes(query) ||
                    (event.sportCategory || "").toLowerCase().includes(query)
                );
            });
            updateEventList(filteredData, "eventsWrapper");

            if (filteredData.length === 0) {
                const msg = document.createElement("p");
                msg.className = "no-results-msg";
                msg.textContent = "No events match your search.";
                msg.style.textAlign = "center";
                document.getElementById("eventsWrapper").appendChild(msg);
            }
            break;

        case "attending":
            const attendingFiltered = events
                .filter(event => event.status === "attending")
                .filter(event => {
                    return (
                        (event.title || "").toLowerCase().includes(query) ||
                        (event.date || "").toLowerCase().includes(query) ||
                        (event.time || "").toLowerCase().includes(query) ||
                        (event.location || "").toLowerCase().includes(query) ||
                        (event.area || "").toLowerCase().includes(query) ||
                        (event.city || "").toLowerCase().includes(query) ||
                        (event.skillLevel || "").toLowerCase().includes(query) ||
                        (event.sportCategory || "").toLowerCase().includes(query)
                    );
                });

            const notAttendingFiltered = events
                .filter(event => event.status === "not attending")
                .filter(event => {
                    return (
                        (event.title || "").toLowerCase().includes(query) ||
                        (event.date || "").toLowerCase().includes(query) ||
                        (event.time || "").toLowerCase().includes(query) ||
                        (event.location || "").toLowerCase().includes(query) ||
                        (event.area || "").toLowerCase().includes(query) ||
                        (event.city || "").toLowerCase().includes(query) ||
                        (event.skillLevel || "").toLowerCase().includes(query) ||
                        (event.sportCategory || "").toLowerCase().includes(query)
                    );
                });

            updateEventList(attendingFiltered, "attendingWrapper");
            updateEventList(notAttendingFiltered, "canceledWrapper");

            if (attendingFiltered.length === 0) {
                const msg = document.createElement("p");
                msg.className = "no-results-msg";
                msg.textContent = "No attending events match your search.";
                msg.style.textAlign = "center";
                document.getElementById("attendingWrapper").appendChild(msg);
            }

            if (notAttendingFiltered.length === 0) {
                const msg = document.createElement("p");
                msg.className = "no-results-msg";
                msg.textContent = "No canceled events match your search.";
                msg.style.textAlign = "center";
                document.getElementById("canceledWrapper").appendChild(msg);
            }
            break;
                


        default:
            console.log("Search is not supported for this section.");
    }
});

// Populate filters on page load
async function populateFilters() {
    const skillLevels = ["Beginner", "Intermediate", "Advanced"];
    const sportsCategories = [];
    const cities = [];
    const areas = [];

    // Fetch dropdown data from Firestore
    const categorySnapshot = await getDocs(collection(db, "sports_categories"));
    const citySnapshot = await getDocs(collection(db, "cities"));
    const areaSnapshot = await getDocs(collection(db, "areas"));

    categorySnapshot.forEach(docSnap => sportsCategories.push(docSnap.data().name));
    citySnapshot.forEach(docSnap => cities.push(docSnap.data().name));
    areaSnapshot.forEach(docSnap => areas.push(docSnap.data().name));

    // Populate dropdowns
    populateDropdown("skillFilter", skillLevels);
    populateDropdown("sportsCategoryFilter", sportsCategories);
    populateDropdown("cityFilter", cities);
    populateDropdown("areaFilter", areas);
}

// Helper function to populate dropdowns
function populateDropdown(dropdownId, options) {
    const dropdown = document.getElementById(dropdownId);
    options.forEach(option => {
        const opt = document.createElement("option");
        opt.value = option;
        opt.textContent = option;
        dropdown.appendChild(opt);
    });
}

// Handle active filters
function updateActiveFilters() {
    const activeFiltersContainer = document.getElementById("activeFilters");
    activeFiltersContainer.innerHTML = ""; // Clear existing filters

    const filters = {
        skill: document.getElementById("skillFilter").value,
        sportsCategory: document.getElementById("sportsCategoryFilter").value,
        city: document.getElementById("cityFilter").value,
        area: document.getElementById("areaFilter").value
    };

    Object.keys(filters).forEach(key => {
        if (filters[key]) {
            const pill = document.createElement("div");
            pill.classList.add("filter-pill");
            pill.textContent = filters[key];
            pill.addEventListener("click", () => {
                document.getElementById(`${key}Filter`).value = ""; // Reset filter
                updateActiveFilters(); // Update active filters
            });
            activeFiltersContainer.appendChild(pill);
        }
    });
}

// Apply filters
document.getElementById("applyFiltersBtn").addEventListener("click", () => {
    const skill = document.getElementById("skillFilter").value;
    const sportsCategory = document.getElementById("sportsCategoryFilter").value;
    const city = document.getElementById("cityFilter").value;
    const area = document.getElementById("areaFilter").value;

    if (currentSection === "attending") {
        // Filter Attending Events
        const attendingEvents = events.filter(event => event.status === "attending");
        const filteredAttending = attendingEvents.filter(event => {
            return (
                (!skill || event.skillLevel === skill) &&
                (!sportsCategory || event.sportCategory === sportsCategory) &&
                (!city || event.city === city) &&
                (!area || event.area === area)
            );
        });

        // Filter Not Attending Events
        const notAttendingEvents = events.filter(event => event.status === "not attending");
        const filteredNotAttending = notAttendingEvents.filter(event => {
            return (
                (!skill || event.skillLevel === skill) &&
                (!sportsCategory || event.sportCategory === sportsCategory) &&
                (!city || event.city === city) &&
                (!area || event.area === area)
            );
        });

        // Update both sections
        updateEventList(filteredAttending, "attendingWrapper");
        updateEventList(filteredNotAttending, "canceledWrapper");
    } else {
        // Filter Events for other sections
        const filteredEvents = events.filter(event => {
            return (
                (!skill || event.skillLevel === skill) &&
                (!sportsCategory || event.sportCategory === sportsCategory) &&
                (!city || event.city === city) &&
                (!area || event.area === area)
            );
        });

        updateEventList(filteredEvents, "eventsWrapper");
    }
});

// Populate filters on page load
populateFilters();

// Reset filters
document.getElementById("resetFiltersBtn").addEventListener("click", () => {
    // Reset all dropdowns to their default value
    document.getElementById("skillFilter").value = "";
    document.getElementById("sportsCategoryFilter").value = "";
    document.getElementById("cityFilter").value = "";
    document.getElementById("areaFilter").value = "";

    // Clear active filters
    updateActiveFilters();

    // Reset the event list to show all events
    updateEventList(events, "eventsWrapper");
});

//**Fetch Events on Load**//
fetchEvents();
        

});