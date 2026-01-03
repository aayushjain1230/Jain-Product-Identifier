// --- DOM ELEMENTS ---
const fileInput = document.getElementById('uploaded_image');
const result = document.getElementById('result_desc');
const preview = document.getElementById('preview');
const spinner = document.getElementById('spinner');
const scanAnimation = document.getElementById('scanAnimation');
const tipBox = document.getElementById("tip-box");
const tipText = document.getElementById("tip-text");

// Image base + cache-bust version
const IMG_BASE = '/static/images';
const IMG_VERSION = '?v=1.2';

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
const revertBtn = document.getElementById('revert-btn'); // Added Revert Button

// --- STATE VARIABLES ---
let selectedFile = null;
let originalFileBackup = null; // Stores the raw uncropped file
let originalImg = null;
let cropState = 'idle'; // 'idle', 'moving', 'resizing'
let currentHandle = null;
let cropBox = { x: 0, y: 0, w: 0, h: 0 };
const handleSize = 40; 
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
  originalFileBackup = file; // Backup the original for the Revert function
  
  if (revertBtn) revertBtn.style.display = "none"; // Hide revert on new upload
  tipBox.classList.add("hidden");
  if (scanAnimation) scanAnimation.style.display = "none";

  const reader = new FileReader();
  reader.onload = () => {
    preview.src = reader.result;
    preview.style.display = "block";
    cropButtons.style.display = "flex"; 
    result.style.display = "block";
    result.innerHTML = '<div style="text-align:center; padding: 10px; color: #666;">Photo loaded. Crop if needed or confirm to scan.</div>';
  };
  reader.readAsDataURL(file);
});

// --- CROP BOX INTERACTION LOGIC (iPhone Optimized) ---
function getHandle(mx, my) {
    const { x, y, w, h } = cropBox;
    const tolerance = handleSize * 1.5; 

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
        if (e.cancelable) e.preventDefault();
        cropState = (currentHandle === 'body') ? 'moving' : 'resizing';
    }
}

function handleMove(e) {
    if (cropState === 'idle') return;
    if (e.cancelable) e.preventDefault();

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
        
        // --- ADD THE LINE HERE ---
        if (revertBtn) {
            revertBtn.style.display = "inline-block";
        }
        // -------------------------

    }, "image/jpeg", 0.95);
});

// --- REVERT LOGIC ---
if (revertBtn) {
    revertBtn.addEventListener("click", () => {
        if (!originalFileBackup) return;
        selectedFile = originalFileBackup;
        preview.src = URL.createObjectURL(originalFileBackup);
        revertBtn.style.display = "none"; // Hide until cropped again
        result.innerHTML = '<div style="text-align:center; padding: 10px; color: #666;">Changes reverted to original photo.</div>';
    });
}

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
  
  result.innerHTML = `
    <div style="text-align:center; padding: 20px; background: #fff9e6; border-radius: 12px; border: 1px solid #ffeeba; margin-top: 15px;">
        <p>🚀 <b>Waking up AI server...</b></p>
        <p style="font-size: 0.8em; color: #856404;">If this is the first scan in a while, it may take 30 seconds. Please stay on this screen!</p>
    </div>
  `;
  result.style.display = "block";

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
    result.innerHTML = `
        <div style="background: #f8d7da; color: #721c24; padding: 15px; border-radius: 8px; text-align: center;">
            🚫 <b>Error:</b> ${err.message}<br>
            <small>The server might still be waking up. Try confirming again.</small>
        </div>
    `;
    cropButtons.style.display = "flex";
  }
});

function parseBool(v) {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'number') return v !== 0;
  if (typeof v === 'string') {
    const s = v.trim().toLowerCase();
    return ['true', 'yes', 'y', '1'].includes(s);
  }
  return false;
}

// --- RESULT RENDERING ---
function displayFormattedResult(data) {
  result.style.display = "block";
  let html = "";

  // This block creates the Overview/Summary at the top
  let statusTitle = "Jain";
  let statusClass = "jain-status";
  let statusIcon = "✅";
  let statusMessage = "This product appears to be Jain-friendly.";

  if (data.non_jain_ingredients?.length > 0) {
      statusTitle = "Non-Jain";
      statusClass = "non-jain-status";
      statusIcon = "🚫";
      statusMessage = "This product contains non-Jain ingredients.";
  } else if (data.uncertain_ingredients?.length > 0) {
      statusTitle = "Uncertain";
      statusClass = "uncertain-status";
      statusIcon = "⚠️";
      statusMessage = "Generally Jain, but contains ingredients to eat at your own risk.";
  }

  html += `<div class="overall-status ${statusClass}">
            <div class="status-header">
                <span class="status-icon-large">${statusIcon}</span>
                <h2>${statusTitle}</h2>
            </div>
            <p>${statusMessage}</p>
           </div>`;

  // --- 2. EXISTING NOTE/SUMMARY ---
  if (data.summary?.note) {
      html += `<div class="summary"><b>AI Analysis:</b> ${data.summary.note}</div>`;
  }

  // --- 3. DETAILED INGREDIENT LISTS ---
  const sections = [
      { key: 'non_jain_ingredients', title: 'Non-Jain Ingredients', jainIcon: '/static/images/nonjainicon.png', class: 'non-jain' },
      { key: 'uncertain_ingredients', title: 'Uncertain Ingredients', jainIcon: '/static/images/uncertainicon.png', class: 'uncertain' },
      { key: 'jain_ingredients', title: 'Jain Ingredients', jainIcon: '/static/images/jainicon.png', class: 'jain' }
  ];

  sections.forEach(sec => {
      if (Array.isArray(data[sec.key]) && data[sec.key].length) {
          html += `<div class="section-title"><h3>${sec.title}</h3></div>`;
          html += data[sec.key].map(i => {
            const isVeg = parseBool(i.is_veg);
            const isVegan = parseBool(i.is_vegan);
            const reasonHtml = i.reason ? `<br>${i.reason}` : '';
            return `
            <div class="result-card ${sec.class}">
              <div class="result-text">
                <b>${i.name}</b>${reasonHtml}
              </div>
              <div class="icon-group">
                ${isVeg ? `<span class="status-emoji" title="Vegetarian">🥬</span>` : ''}
                ${isVegan ? `<span class="status-emoji" title="Vegan">🌱</span>` : ''}
                <img src="${sec.jainIcon}${IMG_VERSION}" class="status-icon" alt="${sec.title}">
              </div>
            </div>`;
          }).join('');
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
