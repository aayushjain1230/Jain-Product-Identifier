const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const cameraBtn = document.getElementById('camera-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const video = document.getElementById('camera');
const canvas = document.getElementById('snapshot');

let imageBlob = null;

// Upload file
uploadBtn.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    imageBlob = file;
    showPreview(URL.createObjectURL(file));
  }
});

// Camera capture
cameraBtn.addEventListener('click', async () => {
  if (!video.srcObject) {
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.hidden = false;
    cameraBtn.textContent = "📸 Capture Photo";
  } else {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
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
  if (stream) stream.getTracks().forEach(track => track.stop());
  video.srcObject = null;
  video.hidden = true;
  cameraBtn.textContent = "📷 Take Picture";
}

function showPreview(imageURL) {
  preview.innerHTML = `<img src="${imageURL}" alt="preview">`;
  analyzeBtn.disabled = false;
}

// 🔍 Core API call
async function checkIfJain(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const response = await fetch("https://jain-product-identifier-api.onrender.com/is_jain", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const data = await response.json();
    console.log("✅ API Response:", data);
    console.log("Verdict:", data.summary?.note || "No summary available");
    return data;

  } catch (error) {
    console.error("⚠️ Error connecting to API:", error);
  }
}

// Analyze button
analyzeBtn.addEventListener('click', async () => {
  if (!imageBlob) return;
  console.log("📤 Sending image to API...");
  const data = await checkIfJain(imageBlob);
  if (data) console.log("✅ Analysis complete:", data);
});

// 🌍 Google Translate setup
function loadGoogleTranslate() {
  const script = document.createElement("script");
  script.src = "//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit";
  document.body.appendChild(script);
}

function googleTranslateElementInit() {
  new google.translate.TranslateElement({ pageLanguage: 'en' }, 'google_translate_element');
}

window.onload = loadGoogleTranslate;
