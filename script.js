// Firebase Compat Mode (No imports needed)
const firebaseConfig = {
  apiKey: "AIzaSyDKSTsCsCnbUZUzq6T18RJ1j0K63jwFRkU",
  authDomain: "campus-fix-425f7.firebaseapp.com",
  projectId: "campus-fix-425f7",
  storageBucket: "campus-fix-425f7.firebasestorage.app",
  messagingSenderId: "136230732752",
  appId: "1:136230732752:web:9644f9b7a8df3980f46fd5",
  measurementId: "G-ZD50M396Y6"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
function generateComplaintId() {
  const now = new Date();
  return `CMP-${now.getFullYear()}${(now.getMonth() + 1)
    .toString().padStart(2, '0')}${now.getDate()
      .toString().padStart(2, '0')}-${Math.floor(Math.random() * 100000)}`;
}

// Initialize EmailJS
(function () {
  if (typeof emailjs !== 'undefined') {
    emailjs.init("gG7jrNBTZ2CL3ZJyM");
  } else {
    console.error("EmailJS SDK not loaded!");
  }
})();

function getTimestamp() {
  return new Date().toISOString();
}




const form = document.getElementById("complaintForm");
// Debug Check
console.log("CampusFixx Script Loaded");
// alert("Debug: Script Loaded"); // Uncomment if needed




// Email Routing Config
const inchargeEmails = {
  "Electrical": "harini81900@gmail.com",
  "Plumbing": "harisaran870@gmail.com",
  "Cleanliness": "harini81900@gmail.com",
  "Internet": "it.support@college.edu",
  "Furniture": "maintenance@college.edu",
  "Other": "admin@college.edu"
};

async function sendEmailNotification(data) {
  console.log("Email Notification Triggered for:", data.complaintId);

  if (typeof emailjs === 'undefined') {
    console.error("CRITICAL: EmailJS SDK is not loaded!");
    return;
  }

  // --- AI-POWERED ROUTING ---
  const textToAnalyze = `${data.issueType} ${data.description}`.toLowerCase();
  let category = "Other";

  // 1. Keyword Check
  if (textToAnalyze.includes("electric") || textToAnalyze.includes("light") || textToAnalyze.includes("fan") || textToAnalyze.includes("power") || textToAnalyze.includes("bulb") || textToAnalyze.includes("wire")) {
    category = "Electrical";
  } else if (textToAnalyze.includes("plumb") || textToAnalyze.includes("water") || textToAnalyze.includes("leak") || textToAnalyze.includes("pipe") || textToAnalyze.includes("tap") || textToAnalyze.includes("toilet")) {
    category = "Plumbing";
  } else if (textToAnalyze.includes("clean") || textToAnalyze.includes("dust") || textToAnalyze.includes("sweep") || textToAnalyze.includes("garbage") || textToAnalyze.includes("trash") || textToAnalyze.includes("dirty")) {
    category = "Cleanliness";
  } else if (textToAnalyze.includes("wifi") || textToAnalyze.includes("internet") || textToAnalyze.includes("network") || textToAnalyze.includes("lan") || textToAnalyze.includes("signal")) {
    category = "Internet";
  } else if (textToAnalyze.includes("furniture") || textToAnalyze.includes("chair") || textToAnalyze.includes("desk") || textToAnalyze.includes("bench") || textToAnalyze.includes("door") || textToAnalyze.includes("lock")) {
    category = "Furniture";
  }

  // 2. Direct Category fallback (if keywords failed but dropdown had a specific type)
  if (category === "Other") {
    if (data.issueType.includes("Electrical")) category = "Electrical";
    else if (data.issueType.includes("Plumbing")) category = "Plumbing";
    else if (data.issueType.includes("Cleanliness")) category = "Cleanliness";
    else if (data.issueType.includes("Internet")) category = "Internet";
    else if (data.issueType.includes("Furniture")) category = "Furniture";
  }

  const destEmail = inchargeEmails[category] || inchargeEmails["Other"];
  console.log(`AI Routed this alert to: [${category}] In-charge (${destEmail})`);

  const templateParams = {
    inchargeName: category + " In-charge",
    to_email: destEmail,
    complaintId: data.complaintId,
    issueType: data.issueType,
    location: `${data.block}, ${data.floor}, ${data.roomNumber}`,
    studentName: data.name,
    studentReg: data.registerNo
  };

  try {
    const response = await emailjs.send('service_jtl13zg', 'template_mj86ozl', templateParams);
    console.log('%c EMAIL SENT SUCCESSFULLY!', 'background: #22c55e; color: #fff; font-weight: bold;', response.status, response.text);
  } catch (error) {
    console.error('%c EMAIL SENDING FAILED!', 'background: #ef4444; color: #fff; font-weight: bold;', error);
  }
}

form.addEventListener("submit", async (e) => {
  e.preventDefault(); // stop page reload

  // Get values, checking for "Other" overrides
  const deptVal = document.getElementById("department").value;
  const finalDept = (deptVal === "Other") ? document.getElementById("otherDepartment").value : deptVal;

  const issueVal = document.getElementById("issueType").value;
  const finalIssue = (issueVal === "Other") ? document.getElementById("otherIssue").value : issueVal;

  const complaintData = {
    complaintId: generateComplaintId(),
    name: document.getElementById("name").value,
    registerNo: document.getElementById("regno").value,
    department: finalDept,
    block: document.getElementById("block").value,
    floor: document.getElementById("floor").value,
    roomNumber: document.getElementById("roomNumber").value,
    landmark: document.getElementById("landmark").value,
    issueType: finalIssue,
    description: document.getElementById("description").value,
    priority: document.getElementById("priority").value.toLowerCase(),
    createdAt: getTimestamp(),
    status: "Pending" // Default status
  };

  try {
    // 1. Check Daily Limit
    const today = new Date().toDateString(); // "Wed Jun 14 2023" format

    // Use the same simple query as My Complaints to avoid index errors
    const historySnapshot = await db.collection("complaints")
      .where("registerNo", "==", complaintData.registerNo)
      .get();

    let todayCount = 0;
    historySnapshot.forEach(doc => {
      const data = doc.data();
      if (new Date(data.createdAt).toDateString() === today) {
        todayCount++;
      }
    });

    if (todayCount >= 5) {
      alert("Daily Limit Reached! You can only register 5 complaints per day.");
      return; // Stop submission
    }

    // 2. Submit if limit not reached
    await db.collection("complaints").add(complaintData);

    // 3. Notify In-charge via Email (Real)
    sendEmailNotification(complaintData);

    // Show Success UI
    form.style.display = "none";
    const subtitle = document.querySelector(".subtitle");
    if (subtitle) {
      subtitle.style.display = "none"; // Hide subtitle for cleaner look if it exists
    }

    const successDiv = document.getElementById("successMessage");
    const idDisplay = document.getElementById("displayComplaintId");

    idDisplay.innerText = complaintData.complaintId;
    successDiv.style.display = "block";

    // Reset hidden fields not needed since we reload
    // otherDeptInput.style.display = "none";
    // otherIssueInput.style.display = "none";

  } catch (error) {
    console.error("Error adding document: ", error);
    alert("Error: " + error.message);
  }
});
