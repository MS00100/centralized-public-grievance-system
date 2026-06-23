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

const app = firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const form = document.getElementById("statusForm");
const resultDiv = document.getElementById("result");
const resId = document.getElementById("resId");
const resIssue = document.getElementById("resIssue");
const resStatus = document.getElementById("resStatus");
const resDesc = document.getElementById("resDesc");

form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const inputId = document.getElementById("complaintId").value.trim();

    if (!inputId) return;

    // UI Feedback
    const btn = form.querySelector("button");
    const originalText = btn.innerText;
    btn.innerText = "Searching...";
    btn.disabled = true;
    resultDiv.style.display = "none";

    try {
        const querySnapshot = await db.collection("complaints").where("complaintId", "==", inputId).get();

        if (querySnapshot.empty) {
            alert("Complaint ID not found. Please check and try again.");
        } else {
            // Assume unique ID, take first doc
            const docData = querySnapshot.docs[0].data();

            resId.innerText = docData.complaintId;
            resIssue.innerText = docData.issueType;
            resDesc.innerText = docData.description;

            // Location
            const locText = `${docData.block}, Floor: ${docData.floor}, ${docData.roomNumber} ${docData.restroomType !== 'N/A' ? `(${docData.restroomType})` : ''}`;
            document.getElementById("resLoc").innerText = locText;
            document.getElementById("resLandmark").innerText = docData.landmark;

            // Default status if undefined
            const status = docData.status || "Pending";
            resStatus.innerText = status;

            // Apply color class
            resStatus.className = "status-badge"; // reset
            const sLower = status.toLowerCase();
            if (sLower === "pending") resStatus.classList.add("status-pending");
            else if (sLower === "resolved") resStatus.classList.add("status-resolved");
            else if (sLower === "verified") resStatus.classList.add("status-verified");
            else if (sLower === "re-opened") resStatus.classList.add("status-re-opened");
            else if (sLower === "rejected" || sLower === "denied") resStatus.classList.add("status-denied");
            else resStatus.classList.add("status-pending");

            // Verification Buttons in Status Page
            const verificationDiv = document.getElementById("verificationActions");
            if (status === 'Resolved') {
                verificationDiv.innerHTML = `
                    <div class="verification-actions" style="justify-content: center; margin-top: 20px;">
                        <button class="confirm-btn" onclick="handleVerification('${querySnapshot.docs[0].id}', 'Verified')">Problem Fixed</button>
                        <button class="not-fixed-btn" onclick="handleVerification('${querySnapshot.docs[0].id}', 'Re-opened')">Not Fixed</button>
                    </div>
                `;
                verificationDiv.style.display = "block";
            } else {
                verificationDiv.style.display = "none";
            }

            // Admin Feedback
            const feedbackSection = document.getElementById("feedbackSection") || document.createElement("div");
            feedbackSection.id = "feedbackSection";
            if (docData.adminFeedback) {
                feedbackSection.innerHTML = `
                    <div style="margin-top: 15px; padding: 12px; background: rgba(239, 68, 68, 0.1); border-left: 4px solid #e74c3c; border-radius: 8px;">
                        <p style="margin: 0; font-size: 0.9rem; color: #fff;"><strong>Admin Note:</strong> ${docData.adminFeedback}</p>
                    </div>
                `;
                feedbackSection.style.display = "block";
            } else {
                feedbackSection.style.display = "none";
            }
            if (!document.getElementById("feedbackSection")) {
                resultDiv.appendChild(feedbackSection);
            }

            resultDiv.style.display = "block";
        }

    } catch (error) {
        console.error("Error fetching documents: ", error);
        alert("Error fetching status.");
    } finally {
        btn.innerText = originalText;
        btn.disabled = false;
    }
});

async function handleVerification(docId, newStatus) {
    try {
        if (!confirm(`Are you sure you want to mark this as ${newStatus}?`)) return;

        await db.collection("complaints").doc(docId).update({
            status: newStatus,
            verifiedAt: Date.now()
        });
        alert(`Status updated to ${newStatus}`);
        location.reload();
    } catch (error) {
        console.error("Error verifying fix:", error);
        alert("Failed to update status.");
    }
}
