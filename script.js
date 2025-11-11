// ✅ DOM elements
const uploadBtn = document.getElementById('upload-btn');
const fileInput = document.getElementById('file-input');
const cameraBtn = document.getElementById('camera-btn');
const analyzeBtn = document.getElementById('analyze-btn');
const preview = document.getElementById('preview');
const result = document.getElementById('results');
const video = document.getElementById('camera');
const canvas = document.getElementById('snapshot');

let imageBlob = null;

// 📸 Upload button
uploadBtn.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    imageBlob = file;
    showPreview(URL.createObjectURL(file));
  }
});

// 📷 Camera capture
cameraBtn.addEventListener('click', async () => {
  if (!video.srcObject) {
    // Start camera
    const stream = await navigator.mediaDevices.getUserMedia({ video: true });
    video.srcObject = stream;
    video.hidden = false;
    cameraBtn.textContent = "📸 Capture Photo";
  } else {
    // Take photo
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

// 🔒 Stop camera
function stopCamera() {
  const stream = video.srcObject;
  if (stream) stream.getTracks().forEach(track => track.stop());
  video.srcObject = null;
  video.hidden = true;
  cameraBtn.textContent = "📷 Take Photo";
}

// 🖼️ Show image preview
function showPreview(imageURL) {
  preview.innerHTML = `<img src="${imageURL}" alt="preview">`;
  analyzeBtn.disabled = false;
}

// 🧠 Check if Jain-friendly
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

    if (data.non_jain_ingredients?.length)
      console.log("❌ Non-Jain Ingredients:", data.non_jain_ingredients);
    if (data.uncertain_ingredients?.length)
      console.log("⚠️ Uncertain Ingredients:", data.uncertain_ingredients);
    if (data.jain_ingredients?.length)
      console.log("✅ Jain Ingredients:", data.jain_ingredients);

    console.log("Verdict:", data.summary?.note || "No summary available");

    return data;
  } catch (error) {
    console.error("⚠️ Error connecting to API:", error);
  }
}

// 🔍 Analyze button click
analyzeBtn.addEventListener('click', async () => {
  if (!imageBlob) return;
  result.innerHTML = "🔍 Analyzing...";
  const data = await checkIfJain(imageBlob);
  if (data) displayResult(data);
  else result.innerHTML = "⚠️ Could not analyze the image. Please try again.";
});

// 🧾 Display result and enable translation
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

  // 🌍 Add Google Translate widget
  addTranslateWidget();
}

// 🌐 Google Translate Integration
function addTranslateWidget() {
  if (document.getElementById('google_translate_element')) return;

  const translateDiv = document.createElement('div');
  translateDiv.id = 'google_translate_element';
  translateDiv.style.marginTop = '15px';
  result.appendChild(translateDiv);

  const script = document.createElement('script');
  script.type = 'text/javascript';
  script.src = '//translate.google.com/translate_a/element.js?cb=googleTranslateElementInit';
  document.body.appendChild(script);

  window.googleTranslateElementInit = () => {
    new google.translate.TranslateElement(
      { pageLanguage: 'en', includedLanguages: 'hi,gu,ta,te,bn,ml,mr,pa,en', layout: google.translate.TranslateElement.InlineLayout.SIMPLE },
      'google_translate_element'
    );
  };
}
