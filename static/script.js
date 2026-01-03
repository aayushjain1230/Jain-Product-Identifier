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

// --- CROP STATE VARIABLES ---
let selectedFile = null;
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

// --- CROP BOX INTERACTION LOGIC ---
function getHandle(mx, my) {
    const { x, y, w, h } = cropBox;
    
    // Increase tolerance specifically for touch. 
    // This creates a larger "invisible" hit box around the corners.
    const tolerance = handleSize * 1.5; 

    const isNear = (px, py) => (
        mx >= px - tolerance && mx <= px + tolerance && 
        my >= py - tolerance && my <= py + tolerance
    );

    // Check corners first (Top-Left, Top-Right, Bottom-Right, Bottom-Left)
    if (isNear(x, y)) return 'nw';
    if (isNear(x + w, y)) return 'ne';
    if (isNear(x + w, y + h)) return 'se';
    if (isNear(x, y + h)) return 'sw';

    // Check if the touch is anywhere inside the box to move the whole thing
    if (mx > x && mx < x + w && my > y && my < y + h) return 'body';

    return null;
}

function handleStart(e) {
    const rect = cropCanvas.getBoundingClientRect();
    
    // Scale factors to account for CSS resizing
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;

    // Support both Touch (iPhone) and Mouse
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Convert to internal canvas coordinates
    startX = (clientX - rect.left) * scaleX;
    startY = (clientY - rect.top) * scaleY;

    // Check if the user touched a handle (corner) or the body of the box
    currentHandle = getHandle(startX, startY);

    if (currentHandle) {
        // Prevent the iPhone from trying to select text or scroll during the initial touch
        if (e.cancelable) e.preventDefault();
        
        cropState = (currentHandle === 'body') ? 'moving' : 'resizing';
    }
}

function handleMove(e) {
    if (cropState === 'idle') return;

    // Prevent iPhone from scrolling while you drag the crop box
    if (e.cancelable) {
        e.preventDefault();
    }

    const rect = cropCanvas.getBoundingClientRect();
    
    // Calculate scale factors in case the canvas is resized by CSS
    const scaleX = cropCanvas.width / rect.width;
    const scaleY = cropCanvas.height / rect.height;

    // Support both Touch (iPhone/Android) and Mouse (Computer)
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Convert screen coordinates to Canvas coordinates
    const endX = (clientX - rect.left) * scaleX;
    const endY = (clientY - rect.top) * scaleY;

    // Calculate how much the finger/mouse moved
    const dx = endX - startX;
    const dy = endY - startY;

    if (cropState === 'moving') {
        // Move the entire box
        cropBox.x += dx;
        cropBox.y += dy;

        // Keep the box inside the image boundaries
        cropBox.x = Math.max(0, Math.min(cropBox.x, cropCanvas.width - cropBox.w));
        cropBox.y = Math.max(0, Math.min(cropBox.y, cropCanvas.height - cropBox.h));
    } else if (cropState === 'resizing') {
        // Adjust edges based on which handle is being pulled
        if (currentHandle.includes('w')) { cropBox.x += dx; cropBox.w -= dx; }
        if (currentHandle.includes('e')) { cropBox.w += dx; }
        if (currentHandle.includes('n')) { cropBox.y += dy; cropBox.h -= dy; }
        if (currentHandle.includes('s')) { cropBox.h += dy; }

        // Prevent the box from becoming too small (min 50px)
        cropBox.w = Math.max(50, cropBox.w);
        cropBox.h = Math.max(50, cropBox.h);

        // Optional: Add logic here if you want to prevent resizing outside boundaries
    }

    // Update start positions for the next movement frame
    startX = endX;
    startY = endY;

    // Redraw the canvas with the new box position
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

// --- API ANALYSIS (Updated for Option 3: Waking Up Status) ---
confirmBtn.addEventListener('click', async () => {
  if (!selectedFile) return;
  
  cropButtons.style.display = "none";
  spinner.style.display = "block"; 
  
  // Show "Waking Up" message immediately for better phone UX
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
    console.log('API response:', data); 
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

// --- HELPER: parse boolean-like values safely ---
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
  if (data.summary?.note) html += `<div class="summary"><b>Summary:</b> ${data.summary.note}</div>`;

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
              <div class="icon-group" aria-hidden="true">
                ${isVeg ? `<span class="status-emoji" title="Vegetarian" aria-label="Vegetarian">🥬</span>` : ''}
                ${isVegan ? `<span class="status-emoji" title="Vegan" aria-label="Vegan">🌱</span>` : ''}
                <img src="${sec.jainIcon}${IMG_VERSION}" class="status-icon" title="${sec.title}" alt="${sec.title}" onerror="this.style.display='none';console.warn('Missing image:', this.src)">
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
