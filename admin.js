// Firebase Compat
const firebaseConfig = {
    apiKey: "AIzaSyDKSTsCsCnbUZUzq6T18RJ1j0K63jwFRkU",
    authDomain: "campus-fix-425f7.firebaseapp.com",
    projectId: "campus-fix-425f7",
    storageBucket: "campus-fix-425f7.firebasestorage.app",
    messagingSenderId: "136230732752",
    appId: "1:136230732752:web:9644f9b7a8df3980f46fd5",
    measurementId: "G-ZD50M396Y6"
};

// Connection Check
if (typeof firebase === 'undefined') {
    alert("CRITICAL ERROR: Firebase connection blocked! Please check your internet or disable ad-blockers.");
    console.error("Firebase SDK not loaded.");
} else {
    firebase.initializeApp(firebaseConfig);
}

const db = typeof firebase !== 'undefined' ? firebase.firestore() : { collection: () => ({ orderBy: () => ({ onSnapshot: () => { } }) }) };
const complaintsList = document.getElementById("complaintsList");
const filterStatus = document.getElementById("filterStatus");
const filterPriority = document.getElementById("filterPriority");
const exportBtn = document.getElementById("exportBtn");
const searchInput = document.getElementById("searchInput");

// --- SLA Config (For Demo: Minutes) ---
const SLA_LIMITS = {
    'high': 1 * 60 * 1000,   // 1 Minute
    'medium': 2 * 60 * 1000, // 2 Minutes
    'low': 3 * 60 * 1000    // 3 Minutes
};

async function EscalateComplaint(c) {
    if (c.escalated) return;
    console.warn(`🕒 SLA EXCEEDED for ${c.complaintId}. Priority: ${c.priority}`);

    try {
        // Mark as escalated in DB
        await db.collection("complaints").doc(c.id).update({ escalated: true });
        showToast(`⚠️ Priority Alert: ${c.complaintId} needs attention!`, "error");
    } catch (err) {
        console.error("Escalation update failed:", err);
    }
}

function checkSLAs(complaints) {
    const now = Date.now();
    complaints.forEach(c => {
        if ((c.status || "Pending").toLowerCase() === "pending" || (c.status || "").toLowerCase() === "re-opened") {
            const limit = SLA_LIMITS[c.priority.toLowerCase()] || SLA_LIMITS['low'];
            const createdTime = new Date(c.createdAt).getTime();

            if (now - createdTime > limit && !c.escalated) {
                EscalateComplaint(c);
            }
        }
    });
}

const statTotal = document.getElementById("statTotal");
const statPending = document.getElementById("statPending");
const statResolved = document.getElementById("statResolved");
const statRejected = document.getElementById("statRejected"); // Keep ID but label is Denied

const adminRole = localStorage.getItem("campusFixx_admin_role") || "Admin";
let currentCategory = "all";

// --- Role Setup ---
if (adminRole !== "Admin" && adminRole !== "Staff") {
    // Hide standard category tabs for department-specific logins
    const categoryTabs = document.getElementById("categoryTabs");
    if (categoryTabs) categoryTabs.style.display = "none";

    // Hide search bar for in-charges as it should only be in admin dashboard
    const searchBar = document.querySelector(".search-bar");
    if (searchBar) searchBar.style.display = "none";

    // Update header display if elements exist
    const roleDisplay = document.getElementById("adminRoleDisplay");
    if (roleDisplay) {
        roleDisplay.innerText = `Logged in as: ${adminRole} In-charge`;
        roleDisplay.style.display = "block";
    }

    const mainTitle = document.getElementById("dashboardTitle");
    if (mainTitle) mainTitle.innerText = "In-charge Portal";

    const subtitle = document.getElementById("dashboardSubtitle");
    if (subtitle) subtitle.innerText = `Managing ${adminRole} issues`;
} else if (adminRole === "Staff") {
    const roleDisplay = document.getElementById("adminRoleDisplay");
    if (roleDisplay) {
        roleDisplay.innerText = `Logged in as: Teacher / Staff`;
        roleDisplay.style.display = "block";
    }

    const mainTitle = document.getElementById("dashboardTitle");
    if (mainTitle) mainTitle.innerText = "Staff Portal";

    // Hide search bar for staff as well
    const searchBar = document.querySelector(".search-bar");
    if (searchBar) searchBar.style.display = "none";
}

// Setup Tab Listeners
document.querySelectorAll(".tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
        // Update UI
        document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");

        // Update Logic
        currentCategory = btn.dataset.category.toLowerCase();
        renderComplaints();
    });
});

// Setup Select Listeners
if (filterStatus) filterStatus.addEventListener("change", renderComplaints);
if (filterPriority) filterPriority.addEventListener("change", renderComplaints);
if (searchInput) searchInput.addEventListener("input", renderComplaints);

// --- Toast Notification System ---
function showToast(message, type = 'info') {
    // Create container if not exists
    let container = document.getElementById('toast-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'toast-container';
        document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span> <span>${message}</span>`;
    container.appendChild(toast);

    // Remove after 3s
    setTimeout(() => {
        toast.style.animation = 'fadeOut 0.5s forwards';
        setTimeout(() => toast.remove(), 500);
    }, 3000);
}

let allComplaints = [];

function listenToComplaints() {
    const loadingMsg = '<p id="loadingMsg" style="text-align: center;">Loading complaints... <br><small>If this takes too long, check your internet or Firebase console.</small></p>';
    complaintsList.innerHTML = loadingMsg;

    // Timeout Diagnostic
    const loadTimeout = setTimeout(() => {
        const msgEl = document.getElementById("loadingMsg");
        if (msgEl && allComplaints.length === 0) {
            msgEl.innerHTML = '<p style="text-align: center; color: #f59e0b;">Still loading... <br> No data found yet. Ensure you have submitted issues and your "complaints" collection in Firestore is not empty.</p>';
        }
    }, 8000);

    // Real-time listener
    db.collection("complaints").orderBy("createdAt", "desc").onSnapshot((querySnapshot) => {
        clearTimeout(loadTimeout);
        allComplaints = [];

        // --- Role-Based Stats Integration ---
        const role = localStorage.getItem("campusFixx_admin_role") || "Admin";
        let pendingCount = 0;
        let reopenedCount = 0;
        let resolvedCount = 0;
        let rejectedCount = 0;
        let totalCount = 0;

        querySnapshot.forEach((doc) => {
            const data = doc.data();
            const aiCat = getAICategory(data).toLowerCase();
            const matchesRole = role === "Admin" || role === "Staff" ||
                aiCat.includes(role.toLowerCase()) ||
                (data.issueType || "").toLowerCase().includes(role.toLowerCase());

            if (matchesRole) {
                allComplaints.push({ id: doc.id, ...data });
                totalCount++;
                const status = (data.status || 'Pending').toLowerCase();
                if (status === 'pending') pendingCount++;
                else if (status === 're-opened') reopenedCount++;
                else if (status === 'resolved') resolvedCount++;
                else if (status === 'rejected' || status === 'denied') rejectedCount++;
            }
        });

        // Update Stats UI
        if (statTotal) statTotal.innerText = totalCount;
        if (statPending) {
            const totalPending = pendingCount + reopenedCount;
            if (reopenedCount > 0) {
                statPending.innerHTML = `${totalPending} <small style="font-size: 0.8rem; color: var(--warning); display: block; margin-top: 4px;">(${reopenedCount} Re-opened)</small>`;
            } else {
                statPending.innerText = totalPending;
            }
        }
        if (statResolved) statResolved.innerText = resolvedCount;
        if (statRejected) statRejected.innerText = rejectedCount;

        checkSLAs(allComplaints);
        renderComplaints();
    }, (error) => {
        console.error("Error listening to complaints:", error);
        complaintsList.innerHTML = '<p style="text-align: center; color: red;">Error loading data.</p>';
        showToast("Error loading complaints", "error");
    });
}

// Update Status function
window.updateStatus = async (docId, newStatus) => {
    try {
        let feedback = null;
        if (newStatus === 'Denied') {
            feedback = prompt("Please provide a reason for denial (optional):");
            if (feedback === null) return; // User cancelled
        }

        const timestamp = Date.now();
        const updateData = {
            status: newStatus,
            updatedAt: timestamp,
            resolvedAt: newStatus === 'Resolved' ? timestamp : null
        };

        if (feedback !== null) {
            updateData.adminFeedback = feedback;
        }

        await db.collection("complaints").doc(docId).update(updateData);

        showToast(`Complaint ${newStatus}`, "success");
    } catch (error) {
        console.error("Error updating status:", error);
        showToast("Failed to update status", "error");
    }
};

// Helper for AI-based category detection
function getAICategory(c) {
    const cat = (c.issueType || "Other").trim();
    const description = (c.description || "").toLowerCase();
    const combinedText = (cat + " " + description).toLowerCase();

    if (combinedText.includes("electric") || combinedText.includes("light") || combinedText.includes("fan") || combinedText.includes("power") || combinedText.includes("bulb") || combinedText.includes("wire")) {
        return "⚡ Electrical Works";
    } else if (combinedText.includes("plumb") || combinedText.includes("water") || combinedText.includes("leak") || combinedText.includes("pipe") || combinedText.includes("tap") || combinedText.includes("restroom") || combinedText.includes("toilet")) {
        return "🚰 Plumbing Works";
    } else if (combinedText.includes("clean") || combinedText.includes("dust") || combinedText.includes("sweep") || combinedText.includes("garbage") || combinedText.includes("trash") || combinedText.includes("dirty") || combinedText.includes("waste")) {
        return "🧹 Cleanliness & Sanitation";
    } else if (combinedText.includes("wifi") || combinedText.includes("internet") || combinedText.includes("network") || combinedText.includes("system") || combinedText.includes("lan") || combinedText.includes("signal")) {
        return "🌐 Internet & Network";
    } else if (combinedText.includes("furniture") || combinedText.includes("chair") || combinedText.includes("desk") || combinedText.includes("bench") || combinedText.includes("door") || combinedText.includes("lock") || combinedText.includes("handle") || combinedText.includes("cupboard")) {
        return "🪑 Furniture & Carpentry";
    }

    // Fallback to the original category name if no keywords found
    return `📦 ${cat.split('(')[0].trim()} Works`;
}

function renderComplaints() {
    if (!complaintsList) return;

    // CRITICAL FIX: Clear the list before rendering to avoid duplicate button/card issues
    complaintsList.innerHTML = "";

    const statusVal = filterStatus ? filterStatus.value.toLowerCase() : "all";
    const priorityVal = filterPriority ? filterPriority.value.toLowerCase() : "all";
    const searchQuery = searchInput ? searchInput.value.toLowerCase().trim() : "";

    // 1. Filter the complaints
    let filtered = allComplaints.filter(c => {
        const aiCat = getAICategory(c).toLowerCase();
        const s = (c.status || "pending").toLowerCase();
        const p = (c.priority || "low").toLowerCase();
        const id = (c.complaintId || "").toLowerCase();
        const name = (c.name || "").toLowerCase();
        const desc = (c.description || "").toLowerCase();

        // --- Department Role Filter ---
        if (adminRole !== "Admin" && adminRole !== "Staff") {
            // Only show complaints matching the admin's role
            const roleMatch = aiCat.includes(adminRole.toLowerCase()) ||
                (c.issueType || "").toLowerCase().includes(adminRole.toLowerCase());
            if (!roleMatch) return false;
        }

        // If a specific tab is selected, it should match the AI detected category OR the original category
        const isMainCategory = aiCat.includes("electrical") ||
            aiCat.includes("plumbing") ||
            aiCat.includes("cleanliness") ||
            aiCat.includes("internet") ||
            aiCat.includes("furniture");

        let categoryMatch = currentCategory === "all";
        if (!categoryMatch) {
            if (currentCategory === "other issues") {
                categoryMatch = !isMainCategory;
            } else {
                categoryMatch = aiCat.includes(currentCategory.toLowerCase()) ||
                    (c.issueType || "").toLowerCase().includes(currentCategory.toLowerCase());
            }
        }

        let statusMatch = statusVal === "all" || s === statusVal;
        // Map rejected records to the 'denied' filter value
        if (statusVal === "denied" && s === "rejected") statusMatch = true;
        const priorityMatch = priorityVal === "all" || p === priorityVal;
        const searchMatch = !searchQuery || id.includes(searchQuery) || name.includes(searchQuery) || desc.includes(searchQuery);

        return categoryMatch && statusMatch && priorityMatch && searchMatch;
    });

    if (filtered.length === 0) {
        complaintsList.innerHTML = '<p style="text-align: center; margin-top: 40px; color: var(--text-muted);">No complaints found matching your criteria.</p>';
        return;
    }

    // 2. Render Cards (Flattened List - Latest First)
    // Since allComplaints is already ordered by 'createdAt' desc in listenToComplaints,
    // and filter preserves order, we just render them directly.
    filtered.forEach(c => {
        const card = createComplaintCard(c);
        complaintsList.appendChild(card);
    });
}

// Helper to create the complaint card UI
function createComplaintCard(c) {
    const card = document.createElement("div");
    const priority = (c.priority || 'low').toLowerCase();
    const priorityClass = `priority-${priority}`;
    card.className = `complaint-card ${priorityClass}`;

    const status = (c.status || "Pending").toLowerCase();

    // --- Audit Trail / History Logic ---
    let auditTrail = '';
    if (status === 'resolved' || status === 'rejected' || status === 'denied') {
        const created = new Date(c.createdAt).toLocaleString();
        const resolved = c.resolvedAt ? new Date(c.resolvedAt).toLocaleString() : 'Recently';
        auditTrail = `
            <div style="margin-top: 15px; padding-top: 10px; border-top: 1px dashed var(--glass-border); font-size: 0.75rem; color: var(--text-muted);">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                    <span>Created:</span>
                    <span style="color: var(--text-main);">${created}</span>
                </div>
                <div style="display: flex; justify-content: space-between;">
                    <span>${status === 'resolved' ? 'Resolved' : 'Denied'}:</span>
                    <span style="color: var(--primary); font-weight: 600;">${resolved}</span>
                </div>
            </div>
        `;
    }

    card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
            <div style="display: flex; flex-direction: column; gap: 4px;">
                <span class="complaint-id">${c.complaintId || 'No ID'}</span>
                ${c.escalated ? '<span style="background: var(--error); color: white; padding: 2px 8px; border-radius: 4px; font-size: 0.65rem; font-weight: 800;">⚠️ ESCALATED</span>' : ''}
            </div>
            <span class="status-badge status-${status.replace(/\s+/g, '-')}">${(status === 'rejected' ? 'DENIED' : status.toUpperCase())}</span>
        </div>
        <div style="margin-bottom: 12px;">
            <span class="priority-tag ${priority}">${priority.toUpperCase()}</span>
            <span style="font-size: 0.75rem; color: var(--text-muted); margin-left: 8px;">${new Date(c.createdAt).toLocaleDateString()}</span>
        </div>
        <h3 style="font-size: 1.1rem; margin-bottom: 8px; color: var(--primary);">${c.issueType}</h3>
        <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 15px; line-height: 1.5;">${c.description}</p>
        
        <div style="background: rgba(255,255,255,0.03); border-radius: 8px; padding: 12px; font-size: 0.85rem; margin-bottom: 15px;">
            <div style="margin-bottom: 6px;"><strong>📍 Location:</strong> ${c.block}, ${c.floor}, Room ${c.roomNumber}</div>
            <div><strong>👤 ${(c.name === "Teacher / Staff" || (c.registerNo && c.registerNo.includes('@'))) ? 'Staff' : 'Student'}:</strong> ${c.name} (${c.registerNo})</div>
        </div>

        <div class="actions">
            ${(adminRole === "Admin" && (status === 'pending' || status === 're-opened')) ? `
                <button onclick="window.updateStatus('${c.id}', 'Resolved')" style="background: var(--success);">Resolve</button>
                <button onclick="window.updateStatus('${c.id}', 'Denied')" style="background: var(--error);">Deny</button>
            ` : ''}
            ${status === 'resolved' ? `
                <p style="font-size: 0.8rem; color: #F59E0B; font-weight: 600;">🕒 Awaiting ${(c.name === "Teacher / Staff" || (c.registerNo && c.registerNo.includes('@'))) ? 'Staff Confirmation' : 'Student Verification'}</p>
            ` : ''}
        </div>
        ${auditTrail}
    `;
    return card;
}

if (exportBtn) {
    exportBtn.addEventListener("click", () => {
        const rows = [
            ["Complaint ID", "Student Name", "Reg No", "Department", "Issue", "Block", "Floor", "Room", "Status", "Date"]
        ];

        allComplaints.forEach(c => {
            rows.push([
                c.complaintId,
                c.name,
                c.registerNo,
                c.department || "N/A",
                c.issueType,
                c.block,
                c.floor,
                c.roomNumber,
                c.status || "Pending",
                new Date(c.createdAt).toLocaleDateString()
            ]);
        });

        const csvContent = "data:text/csv;charset=utf-8,"
            + rows.map(e => e.join(",")).join("\n");

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `CampusFixx_Report_${new Date().toLocaleDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        showToast("Report Exported Successfully", "success");
    });
}

// Initial load
listenToComplaints();
