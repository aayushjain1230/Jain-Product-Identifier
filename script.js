// ===============
// Element Bindings
// ===============
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const cameraBtn = document.getElementById("camera-btn");
const analyzeBtn = document.getElementById("analyze-btn");
const preview = document.getElementById("preview");
const result = document.getElementById("result");
const video = document.getElementById("camera");
const canvas = document.getElementById("snapshot");

let imageBlob = null;

// ====================
// Upload Image Handler
// ====================
uploadBtn.addEventListener("click", () => fileInput.click());

fileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (file) {
    imageBlob = file;
    showPreview(URL.createObjectURL(file));
  }
});

// ====================
// Camera Capture Logic
// ====================
cameraBtn.addEventListener("click", async () => {
  if (!video.srcObject) {
    // Start camera
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = stream;
      video.hidden = false;
      cameraBtn.textContent = "📸 Capture Photo";
    } catch (err) {
      alert("Camera access blocked or unavailable.");
    }
  } else {
    // Capture frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d").drawImage(video, 0, 0);

    canvas.toBlob((blob) => {
      imageBlob = blob;
      const url = URL.createObjectURL(blob);
      showPreview(url);
      stopCamera();
    });
  }
});

function stopCamera() {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach((t) => t.stop());
  video.srcObject = null;
  video.hidden = true;
  cameraBtn.textContent = "📷 Take Picture";
}

// ====================
// Show Preview Function
// ====================
function showPreview(url) {
  preview.innerHTML = `<img src="${url}" alt="preview">`;
  analyzeBtn.disabled = false;
}

// ========================
// API Request to Backend
// ========================
async function checkIfJain(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const response = await fetch(
      "https://jain-product-identifier-api.onrender.com/is_jain",
      {
        method: "POST",
        body: formData,
      }
    );

    if (!response.ok) throw new Error(`API error ${response.status}`);

    return await response.json();
  } catch (err) {
    console.error("API error:", err);
    showResult("API connection failed", "uncertain");
  }
}

// ====================
// Clicking “Analyze”
// ====================
analyzeBtn.addEventListener("click", async () => {
  if (!imageBlob) return;

  result.innerHTML = `<p>Analyzing...</p>`;

  const data = await checkIfJain(imageBlob);

  if (!data) return;

  // The API returns: data.summary.note OR data.verdict
  const verdict = (data.summary?.note || "").toLowerCase();

  if (verdict.includes("non-jain")) {
    showResult("❌ Not Jain-Friendly", "non-jain");
  } else if (verdict.includes("jain")) {
    showResult("✅ Jain-Friendly", "jain");
  } else {
    showResult("⚠️ Unable to determine", "uncertain");
  }
});

// ====================
// Display Result Card
// ====================
function showResult(text, type) {
  result.innerHTML = `
    <div class="result-card ${type}">
      <h3>${text}</h3>
    </div>
  `;
}
