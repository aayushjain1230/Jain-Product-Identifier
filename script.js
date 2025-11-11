const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const cameraBtn = document.getElementById('camera-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const preview = document.getElementById('preview');
const result = document.getElementById('result');
const video = document.getElementById('camera');
const canvas = document.getElementById('snapshot');

let imageBlob = null;

// Upload button
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
}

function showPreview(imageURL) {
  preview.innerHTML = `<img src="${imageURL}" alt="preview">`;
  analyzeBtn.disabled = false;
}

// 🔍 Core API call function
async function checkIfJain(imageFile) {
  const formData = new FormData();
  formData.append("image", imageFile);

  try {
    const response = await fetch("https://jain-product-identifier-api.onrender.com/is_jain", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    const data = await response.json();
    console.log("✅ API Response:", data);

    // Log info for debugging
    if (data.non_jain_ingredients?.length > 0)
      console.log("❌ Non-Jain Ingredients:", data.non_jain_ingredients);
    if (data.uncertain_ingredients?.length > 0)
      console.log("⚠️ Uncertain Ingredients:", data.uncertain_ingredients);
    if (data.jain_ingredients?.length > 0)
      console.log("✅ Jain Ingredients:", data.jain_ingredients);

    console.log("Verdict:", data.summary?.note || "No summary available");
    return data;

  } catch (error) {
    console.error("⚠️ Error connecting to API:", error);
  }
}

// Analyze button event
analyzeBtn.addEventListener('click', async () => {
  if (!imageBlob) return;

  result.innerHTML = "🔍 Analyzing...";
  const data = await checkIfJain(imageBlob);

  if (data) displayResult(data);
  else result.innerHTML = "⚠️ Could not analyze the image. Please try again.";
});

function displayResult(data) {
  result.innerHTML = "";

  if (data.non_jain_ingredients?.length) {
    result.innerHTML += `<h3>❌ Non-Jain Ingredients</h3>`;
    data.non_jain_ingredients.forEach(i => {
      result.innerHTML += `<div class="result-card non-jain"><b>${i.name}</b><br>${i.reason}</div>`;
    });
  }

  if (data.uncertain_ingredients?.length) {
    result.innerHTML += `<h3>⚠️ Uncertain Ingredients</h3>`;
    data.uncertain_ingredients.forEach(i => {
      result.innerHTML += `<div class="result-card uncertain"><b>${i.name}</b><br>${i.reason}</div>`;
    });
  }

  if (data.jain_ingredients?.length) {
    result.innerHTML += `<h3>✅ Jain Ingredients</h3>`;
    data.jain_ingredients.forEach(i => {
      result.innerHTML += `<div class="result-card jain"><b>${i.name}</b></div>`;
    });
  }

  if (data.summary?.note) {
    result.innerHTML += `<div class="result-card"><b>Summary:</b> ${data.summary.note}</div>`;
  }
}
