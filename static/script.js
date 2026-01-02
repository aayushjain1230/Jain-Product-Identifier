// --- DOM ELEMENTS ---
const fileInput = document.getElementById('uploaded_image');
const result = document.getElementById('result_desc');
const preview = document.getElementById('preview');
const spinner = document.getElementById('spinner');
const scanAnimation = document.getElementById('scanAnimation');
const tipBox = document.getElementById("tip-box");
const tipText = document.getElementById("tip-text");

// New Crop & Action Elements
const cropContainer = document.getElementById('crop-container');
const cropCanvas = document.getElementById('cropCanvas');
const cropCtx = cropCanvas.getContext('2d');
const cropButtons = document.getElementById('crop-buttons');
const cropBtn = document.getElementById('crop-btn');
const retakeBtn = document.getElementById('retake-btn');
const confirmBtn = document.getElementById('confirm-btn');
const confirmCropBtn = document.getElementById('confirmCropBtn');
const cancelCropBtn = document.getElementById('cancelCropBtn');

// --- CROP STATE VARIABLES ---
let selectedFile = null;
let originalImg = null;
let cropState = 'idle'; // 'idle', 'moving', 'resizing'
let currentHandle = null;
let cropBox = { x: 0, y: 0, w: 0, h: 0 };
const handleSize = 30; 
let startX, startY;

// --- TIP LOGIC ---
const tips = [
  "Hold your phone steady for a clear scan.",
  "Make sure the entire ingredient list is visible.",
  "Avoid glare by tilting the package slightly.",
  "Zoom in if the text is small, but keep it sharp.",
  "Use good lighting — it helps with accuracy.",
  "Flatten crinkled packaging for better results."
];

let tipIndex = 0;
setInterval(() => {
  tipIndex = (tipIndex + 1) % tips.length;
  if (tipText) tipText.textContent = tips[tipIndex];
}, 3000);

// --- UI HELPERS ---
function clearScreen() {
  preview.src = "";
  preview.style.display = "none";
  result.innerHTML = "";
  result.style.display = "none";
  cropButtons.style.display = "none";
}

// --- FILE SELECTION ---
fileInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;

  selectedFile = file;
  tipBox.classList.add("hidden");
  if (scanAnimation) scanAnimation.style.display = "none";

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.style.display = "block";
    cropButtons.style.display = "flex"; 
    result.style.display = "block";
    result.textContent = "Photo loaded. Crop if needed or confirm to scan.";
  };
  reader.readAsDataURL(file);
});

// --- CROP BOX INTERACTION LOGIC ---
function getHandle(mx, my) {
    const { x, y, w, h } = cropBox;
    const tolerance = handleSize;
    const isNear = (px, py) => (
        mx >= px - tolerance && mx <= px + tolerance && 
        my >= py - tolerance && my <= py + tolerance
    );
    if (isNear(x, y)) return 'nw';
    if (isNear(x + w, y)) return 'ne';
    if (isNear(x + w, y + h)) return 'se';
    if (isNear(x, y + h)) return 'sw';
    if (mx > x && mx < x + w && my > y && my < y + h) return 'body';
    return null;
}

function handleStart(e) {
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = (clientX - rect.left) * scaleX;
    startY = (clientY - rect.top) * scaleY;
    currentHandle = getHandle(startX, startY);
    if (currentHandle) {
        cropState = (currentHandle === 'body') ? 'moving' : 'resizing';
    }
}

function handleMove(e) {
    if (cropState === 'idle') return;
    e.preventDefault();
    const rect = cropCanvas.getBoundingClientRect();
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const endX = (clientX - rect.left) * scaleX;
    const endY = (clientY - rect.top) * scaleY;
    const dx = endX - startX;
    const dy = endY - startY;

    if (cropState === 'moving') {
        cropBox.x += dx;
        cropBox.y += dy;
        cropBox.x = Math.max(0, Math.min(cropBox.x, cropCanvas.width - cropBox.w));
        cropBox.y = Math.max(0, Math.min(cropBox.y, cropCanvas.height - cropBox.h));
    } else if (cropState === 'resizing') {
        if (currentHandle.includes('w')) { cropBox.x += dx; cropBox.w -= dx; }
        if (currentHandle.includes('e')) { cropBox.w += dx; }
        if (currentHandle.includes('n')) { cropBox.y += dy; cropBox.h -= dy; }
        if (currentHandle.includes('s')) { cropBox.h += dy; }
        cropBox.w = Math.max(50, cropBox.w);
        cropBox.h = Math.max(50, cropBox.h);
    }
    startX = endX;
    startY = endY;
    drawCropBox();
}

function handleEnd() { cropState = 'idle'; }

cropCanvas.addEventListener('mousedown', handleStart);
window.addEventListener('mousemove', handleMove);
window.addEventListener('mouseup', handleEnd);
cropCanvas.addEventListener('touchstart', handleStart, {passive: false});
window.addEventListener('touchmove', handleMove, {passive: false});
window.addEventListener('touchend', handleEnd);

// --- CROP BOX DRAWING ---
function drawCropBox() {
    if (!cropCtx || !originalImg) return;
    cropCtx.drawImage(originalImg, 0, 0, cropCanvas.width, cropCanvas.height);
    const { x, y, w, h } = cropBox;
    cropCtx.fillStyle = 'rgba(0, 0, 0, 0.6)';
    cropCtx.fillRect(0, 0, cropCanvas.width, y);
    cropCtx.fillRect(0, y + h, cropCanvas.width, cropCanvas.height - (y + h));
    cropCtx.fillRect(0, y, x, h);
    cropCtx.fillRect(x + w, y, cropCanvas.width - (x + w), h);
    cropCtx.strokeStyle = '#e53935'; 
    cropCtx.lineWidth = Math.max(4, cropCanvas.width / 150);
    cropCtx.strokeRect(x, y, w, h);
    cropCtx.fillStyle = '#ffffff';
    const s = handleSize / 1.5;
    [[x,y], [x+w,y], [x+w,y+h], [x,y+h]].forEach(([hx, hy]) => {
        cropCtx.fillRect(hx - s, hy - s, s * 2, s * 2);
    });
}

// --- CROP EVENT LISTENERS ---
cropBtn.addEventListener("click", () => {
    const img = new Image();
    img.onload = function () {
        originalImg = img;
        cropCanvas.width = img.naturalWidth;
        cropCanvas.height = img.naturalHeight;
        cropBox = { x: img.naturalWidth * 0.2, y: img.naturalHeight * 0.2, w: img.naturalWidth * 0.6, h: img.naturalHeight * 0.3 };
        preview.style.display = "none";
        cropButtons.style.display = "none";
        cropContainer.style.display = "block";
        drawCropBox();
    };
    img.src = preview.src;
});

confirmCropBtn.addEventListener("click", () => {
    const tempCanvas = document.createElement('canvas');
    const tempCtx = tempCanvas.getContext('2d');
    tempCanvas.width = cropBox.w;
    tempCanvas.height = cropBox.h;
    tempCtx.drawImage(originalImg, cropBox.x, cropBox.y, cropBox.w, cropBox.h, 0, 0, cropBox.w, cropBox.h);
    tempCanvas.toBlob(blob => {
        selectedFile = blob;
        preview.src = URL.createObjectURL(blob);
        cropContainer.style.display = "none";
        preview.style.display = "block";
        cropButtons.style.display = "flex";
    }, "image/jpeg", 0.95);
});

cancelCropBtn.addEventListener("click", () => {
    cropContainer.style.display = "none";
    preview.style.display = "block";
    cropButtons.style.display = "flex";
});

retakeBtn.addEventListener("click", () => { fileInput.click(); });

// --- API ANALYSIS ---
confirmBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  cropButtons.style.display = "none";
  spinner.style.display = "block"; 
  result.textContent = "Analyzing ingredients...";
  const formData = new FormData();
  formData.append('file', selectedFile, "label.jpg");
  try {
    const res = await fetch("https://jain-product-identifier-api.onrender.com/classify", {
      method: "POST",
      body: formData,
    });
    spinner.style.display = "none";
    if (!res.ok) throw new Error(`Server Error: ${res.status}`);
    const data = await res.json();
    displayFormattedResult(data);
  } catch (err) {
    spinner.style.display = "none";
    result.textContent = `🚫 Error: ${err.message}`;
    cropButtons.style.display = "flex";
  }
});

// --- RESULT RENDERING ---
function displayFormattedResult(data) {
  result.style.display = "block";
  let html = "";
  if (data.summary?.note) html += `<div class="summary"><b>Summary:</b> ${data.summary.note}</div>`;

  // Updated image paths to include the images/ folder
  // This replaces the part inside your displayFormattedResult function
const sections = [
    { key: 'non_jain_ingredients', title: 'Non-Jain Ingredients', jainIcon: '/static/images/nonjainicon.png', class: 'non-jain' },
    { key: 'uncertain_ingredients', title: 'Uncertain Ingredients', jainIcon: '/static/images/uncertainicon.png', class: 'uncertain' },
    { key: 'jain_ingredients', title: 'Jain Ingredients', jainIcon: '/static/images/jainicon.png', class: 'jain' }
];

sections.forEach(sec => {
    if (data[sec.key]?.length) {
        html += `<div class="section-title"><h3>${sec.title}</h3></div>`;
        html += data[sec.key].map(i => `
          <div class="result-card ${sec.class}">
            <div class="result-text">
              <b>${i.name}</b>${i.reason ? '<br>' + i.reason : ''}
            </div>
            <div class="icon-group">
              <img src="/static/images/veg_icon.png" class="status-icon" title="Vegetarian">
              <img src="/static/images/vegan_icon.png" class="status-icon" title="Vegan">
              <img src="${sec.jainIcon}" class="status-icon" title="Jain Status">
            </div>
          </div>
        `).join('');
    }
});
  result.innerHTML = html || "⚠️ No analysis results returned.";
}

// --- MODAL LOGIC ---
const infoModal = document.getElementById("infoModal");
const infoBtn = document.getElementById("info-btn");
if(infoBtn) infoBtn.onclick = () => infoModal.style.display = "flex";
document.getElementById("closeModal").onclick = () => infoModal.style.display = "none";
document.getElementById("modalOk").onclick = () => infoModal.style.display = "none";
window.onclick = (e) => { if (e.target === infoModal) infoModal.style.display = "none"; };
