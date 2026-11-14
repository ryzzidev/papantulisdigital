// --- SKRIP PENGAMANAN KODE (SILENT BLOCK) ---
document.addEventListener('contextmenu', (e) => e.preventDefault());

document.addEventListener('keydown', (e) => {
  if (
    e.key === 'F12' ||
    (e.ctrlKey && e.shiftKey && ['I', 'J', 'C', 'i', 'j', 'c'].includes(e.key)) ||
    (e.ctrlKey && ['U', 'u', 'S', 's'].includes(e.key))
  ) {
    e.preventDefault();
    e.stopPropagation();
  }
});

(() => {
  const checkDevTools = () => {
    const threshold = 160;
    const start = performance.now();
    const end = performance.now();
    if (end - start > threshold) {
      document.body.innerHTML = '';
    }
  };
  setInterval(checkDevTools, 2000);
})();
// ---------------------------------------------

const appStage = document.getElementById('app-stage');
const boardWrapper = document.getElementById('board-wrapper');
const canvas = document.getElementById('whiteboard');
const ctx = canvas.getContext('2d', { willReadFrequently: true });

const undoBtn = document.getElementById('undo-btn');
const redoBtn = document.getElementById('redo-btn');
const toolBtns = document.querySelectorAll('.tool-btn[data-tool]');
const colorMenuBtn = document.getElementById('color-menu-btn');
const colorPopover = document.getElementById('color-popover');
const activeColorDot = document.getElementById('active-color-dot');
const customColorPicker = document.getElementById('custom-color-picker');
const sizeSlider = document.getElementById('size-slider');
const sizePreviewDot = document.getElementById('size-preview-dot');
const sizeLabel = document.getElementById('size-label');

const shapeToolBtn = document.getElementById('shape-tool-btn');
const shapePopover = document.getElementById('shape-popover');
const shapeOptions = document.querySelectorAll('.shape-option');
const addStickyBtn = document.getElementById('add-sticky-btn');
const stickyContainer = document.getElementById('sticky-container');
const gridToggleBtn = document.getElementById('grid-toggle-btn');
const gridLabel = document.getElementById('grid-label');
const rotateToggleBtn = document.getElementById('rotate-toggle-btn');
const saveImgBtn = document.getElementById('save-img-btn');
const fullscreenBtn = document.getElementById('fullscreen-btn');
const fullscreenIcon = document.getElementById('fullscreen-icon');

const textOverlay = document.getElementById('text-input-overlay');
const floatingTextarea = document.getElementById('floating-textarea');
const confirmTextBtn = document.getElementById('confirm-text-btn');
const cancelTextBtn = document.getElementById('cancel-text-btn');

let currentTool = 'pen';
let currentShape = 'line';
let currentColor = '#111827';
let currentSize = 4;
let isDrawing = false;
let points = [];
let strokeSnapshot = null;
let startPos = { x: 0, y: 0 };
let textPosX = 0;
let textPosY = 0;

let historyStack = [];
let historyStep = -1;
const MAX_HISTORY = 40;

let isForceLandscape = false;
let manualRotateOverride = false;
let autoLandscapeAttempted = false;

const gridModes = [
  { className: '', label: 'Polos' },
  { className: 'bg-ruled', label: 'Garis' },
  { className: 'bg-grid', label: 'Kotak' },
  { className: 'bg-dots', label: 'Titik' }
];
let currentGridIndex = 0;

const isMobileDevice = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && window.innerWidth < 1024);

function applyResponsiveOrientation() {
  const isPortrait = window.innerHeight > window.innerWidth;
  if (isMobileDevice && isPortrait && !manualRotateOverride) {
    isForceLandscape = true;
    appStage.classList.add('force-landscape');
  } else if (!isPortrait) {
    isForceLandscape = false;
    appStage.classList.remove('force-landscape');
  }
  setTimeout(initCanvas, 60);
}

async function tryNativeLandscapeLock() {
  if (autoLandscapeAttempted || !isMobileDevice) return;
  autoLandscapeAttempted = true;
  try {
    if (document.documentElement.requestFullscreen && !document.fullscreenElement) {
      await document.documentElement.requestFullscreen();
    }
    if (screen.orientation && screen.orientation.lock) {
      await screen.orientation.lock('landscape');
      isForceLandscape = false;
      appStage.classList.remove('force-landscape');
      setTimeout(initCanvas, 100);
    }
  } catch (err) {}
}

rotateToggleBtn.addEventListener('click', () => {
  manualRotateOverride = true;
  isForceLandscape = !isForceLandscape;
  if (isForceLandscape) {
    appStage.classList.add('force-landscape');
  } else {
    appStage.classList.remove('force-landscape');
  }
  setTimeout(initCanvas, 300);
});

function getLogicalBoardSize() {
  return {
    width: boardWrapper.offsetWidth,
    height: boardWrapper.offsetHeight
  };
}

function initCanvas() {
  const { width, height } = getLogicalBoardSize();
  if (width === 0 || height === 0) return;

  const dpr = window.devicePixelRatio || 1;
  const prevData = historyStep >= 0 ? historyStack[historyStep] : null;

  canvas.width = width * dpr;
  canvas.height = height * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  if (prevData) {
    const img = new Image();
    img.onload = () => {
      ctx.drawImage(img, 0, 0, width, height);
    };
    img.src = prevData;
  } else {
    saveState();
  }
}

function saveState() {
  historyStep++;
  if (historyStep < historyStack.length) {
    historyStack = historyStack.slice(0, historyStep);
  }
  historyStack.push(canvas.toDataURL('image/png'));
  if (historyStack.length > MAX_HISTORY) {
    historyStack.shift();
    historyStep--;
  }
  updateHistoryButtons();
}

function restoreState(step) {
  const { width, height } = getLogicalBoardSize();
  const img = new Image();
  img.onload = () => {
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(img, 0, 0, width, height);
  };
  img.src = historyStack[step];
  updateHistoryButtons();
}

function updateHistoryButtons() {
  undoBtn.disabled = historyStep <= 0;
  redoBtn.disabled = historyStep >= historyStack.length - 1;
}

undoBtn.addEventListener('click', () => {
  if (historyStep > 0) {
    historyStep--;
    restoreState(historyStep);
  }
});

redoBtn.addEventListener('click', () => {
  if (historyStep < historyStack.length - 1) {
    historyStep++;
    restoreState(historyStep);
  }
});

toolBtns.forEach((btn) => {
  btn.addEventListener('click', (e) => {
    if (textOverlay.style.display === 'block') {
      commitTextToCanvas();
    }
    toolBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    currentTool = btn.dataset.tool;
    canvas.style.cursor = currentTool === 'text' ? 'text' : 'crosshair';

    if (currentTool === 'shape') {
      e.stopPropagation();
      shapePopover.classList.toggle('hidden');
      colorPopover.classList.add('hidden');
    } else {
      shapePopover.classList.add('hidden');
    }
  });
});

shapeOptions.forEach((opt) => {
  opt.addEventListener('click', () => {
    currentShape = opt.dataset.shape;
    shapeOptions.forEach((o) => {
      o.classList.remove('bg-emerald-600', 'text-white');
      o.classList.add('hover:bg-white/50', 'text-slate-800');
    });
    opt.classList.add('bg-emerald-600', 'text-white');
    opt.classList.remove('hover:bg-white/50', 'text-slate-800');
    shapePopover.classList.add('hidden');
  });
});

colorMenuBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  colorPopover.classList.toggle('hidden');
  shapePopover.classList.add('hidden');
});

document.querySelectorAll('.color-swatch').forEach((swatch) => {
  swatch.addEventListener('click', () => {
    setColor(swatch.dataset.color);
    colorPopover.classList.add('hidden');
  });
});

customColorPicker.addEventListener('input', (e) => {
  setColor(e.target.value);
});

function setColor(color) {
  currentColor = color;
  activeColorDot.style.backgroundColor = color;
  sizePreviewDot.style.backgroundColor = color;
  if (textOverlay.style.display === 'block') {
    floatingTextarea.style.color = color;
  }
}

document.addEventListener('click', (e) => {
  if (!colorPopover.contains(e.target) && !colorMenuBtn.contains(e.target)) {
    colorPopover.classList.add('hidden');
  }
  if (!shapePopover.contains(e.target) && !shapeToolBtn.contains(e.target)) {
    shapePopover.classList.add('hidden');
  }
});

sizeSlider.addEventListener('input', (e) => {
  currentSize = parseInt(e.target.value, 10);
  sizeLabel.textContent = `${currentSize}px`;
  const dotSize = Math.min(20, Math.max(3, currentSize));
  sizePreviewDot.style.width = `${dotSize}px`;
  sizePreviewDot.style.height = `${dotSize}px`;

  if (textOverlay.style.display === 'block') {
    floatingTextarea.style.fontSize = `${Math.max(14, currentSize * 2.2)}px`;
  }
});

gridToggleBtn.addEventListener('click', () => {
  const prevClass = gridModes[currentGridIndex].className;
  if (prevClass) boardWrapper.classList.remove(prevClass);

  currentGridIndex = (currentGridIndex + 1) % gridModes.length;
  const nextMode = gridModes[currentGridIndex];
  if (nextMode.className) boardWrapper.classList.add(nextMode.className);
  gridLabel.textContent = nextMode.label;
});

const noteColors = ['#fef08a', '#bbf7d0', '#bfdbfe', '#fbcfe8', '#fed7aa'];
let noteCount = 0;

addStickyBtn.addEventListener('click', () => {
  const bg = noteColors[noteCount % noteColors.length];
  const offset = (noteCount % 6) * 16;
  noteCount++;

  const note = document.createElement('div');
  note.className = 'sticky-note';
  note.style.backgroundColor = bg;
  note.style.left = `${55 + offset}px`;
  note.style.top = `${55 + offset}px`;

  note.innerHTML = `
    <div class="sticky-header">
      <span class="text-[10px] font-bold text-slate-700/70 tracking-wide">CATATAN</span>
      <div class="flex items-center gap-1">
        <button class="stamp-note-btn text-[10px] font-semibold px-1.5 py-0.5 rounded bg-white/60 hover:bg-white text-emerald-800">Tempel</button>
        <button class="close-note-btn text-xs font-bold px-1 text-slate-700 hover:text-red-600">✕</button>
      </div>
    </div>
    <textarea class="sticky-body" placeholder="Tulis catatan di sini..."></textarea>
  `;

  stickyContainer.appendChild(note);
  const textarea = note.querySelector('.sticky-body');
  textarea.focus();

  note.querySelector('.close-note-btn').addEventListener('click', () => note.remove());
  note.querySelector('.stamp-note-btn').addEventListener('click', () => {
    stampStickyToCanvas(note, bg, textarea.value);
    note.remove();
  });

  const header = note.querySelector('.sticky-header');
  let isDragging = false;
  let startClientX = 0;
  let startClientY = 0;
  let initLeft = 0;
  let initTop = 0;

  const startDrag = (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    startClientX = e.touches ? e.touches[0].clientX : e.clientX;
    startClientY = e.touches ? e.touches[0].clientY : e.clientY;
    initLeft = parseFloat(note.style.left) || 0;
    initTop = parseFloat(note.style.top) || 0;
  };

  const onDrag = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startClientX;
    const dy = clientY - startClientY;

    const logicalDx = isForceLandscape ? dy : dx;
    const logicalDy = isForceLandscape ? -dx : dy;

    const { width, height } = getLogicalBoardSize();
    const newLeft = Math.max(0, Math.min(initLeft + logicalDx, width - note.offsetWidth));
    const newTop = Math.max(0, Math.min(initTop + logicalDy, height - note.offsetHeight));

    note.style.left = `${newLeft}px`;
    note.style.top = `${newTop}px`;
  };

  const stopDrag = () => {
    isDragging = false;
  };

  header.addEventListener('mousedown', startDrag);
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', stopDrag);

  header.addEventListener('touchstart', startDrag, { passive: false });
  window.addEventListener('touchmove', onDrag, { passive: false });
  window.addEventListener('touchend', stopDrag);
});

function stampStickyToCanvas(noteEl, bgColor, text) {
  const x = parseFloat(noteEl.style.left) || 0;
  const y = parseFloat(noteEl.style.top) || 0;
  const w = noteEl.offsetWidth;
  const h = noteEl.offsetHeight;

  ctx.save();
  ctx.fillStyle = bgColor;
  ctx.shadowColor = 'rgba(0,0,0,0.12)';
  ctx.shadowBlur = 10;
  ctx.shadowOffsetY = 4;

  ctx.beginPath();
  ctx.roundRect(x, y, w, h, 14);
  ctx.fill();
  ctx.restore();

  if (text.trim()) {
    ctx.save();
    ctx.font = '500 13px Inter, sans-serif';
    ctx.fillStyle = '#1f2937';
    ctx.textBaseline = 'top';
    const lines = text.split('\n');
    lines.forEach((line, idx) => {
      ctx.fillText(line, x + 10, y + 32 + idx * 18, w - 20);
    });
    ctx.restore();
  }
  saveState();
}

saveImgBtn.addEventListener('click', () => {
  const { width, height } = getLogicalBoardSize();
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = canvas.width;
  exportCanvas.height = canvas.height;
  const eCtx = exportCanvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;

  eCtx.fillStyle = '#ffffff';
  eCtx.fillRect(0, 0, exportCanvas.width, exportCanvas.height);

  eCtx.save();
  eCtx.scale(dpr, dpr);
  const activeGrid = gridModes[currentGridIndex].className;
  if (activeGrid === 'bg-ruled') {
    eCtx.strokeStyle = 'rgba(16, 156, 107, 0.16)';
    eCtx.lineWidth = 1;
    for (let y = 32; y < height; y += 32) {
      eCtx.beginPath();
      eCtx.moveTo(0, y);
      eCtx.lineTo(width, y);
      eCtx.stroke();
    }
  } else if (activeGrid === 'bg-grid') {
    eCtx.strokeStyle = 'rgba(16, 156, 107, 0.14)';
    eCtx.lineWidth = 1;
    for (let x = 28; x < width; x += 28) {
      eCtx.beginPath();
      eCtx.moveTo(x, 0);
      eCtx.lineTo(x, height);
      eCtx.stroke();
    }
    for (let y = 28; y < height; y += 28) {
      eCtx.beginPath();
      eCtx.moveTo(0, y);
      eCtx.lineTo(width, y);
      eCtx.stroke();
    }
  } else if (activeGrid === 'bg-dots') {
    eCtx.fillStyle = 'rgba(16, 156, 107, 0.28)';
    for (let x = 12; x < width; x += 24) {
      for (let y = 12; y < height; y += 24) {
        eCtx.beginPath();
        eCtx.arc(x, y, 1.5, 0, Math.PI * 2);
        eCtx.fill();
      }
    }
  }
  eCtx.restore();

  eCtx.drawImage(canvas, 0, 0);

  const link = document.createElement('a');
  const timestamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-');
  link.download = `Papan-Tulis-${timestamp}.png`;
  link.href = exportCanvas.toDataURL('image/png');
  link.click();
});

fullscreenBtn.addEventListener('click', () => {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
});

document.addEventListener('fullscreenchange', () => {
  if (document.fullscreenElement) {
    fullscreenIcon.innerHTML = `
      <polyline points="4 14 10 14 10 20" />
      <polyline points="20 10 14 10 14 4" />
      <line x1="14" y1="10" x2="21" y2="3" />
      <line x1="3" y1="21" x2="10" y2="14" />
    `;
  } else {
    fullscreenIcon.innerHTML = `
      <polyline points="15 3 21 3 21 9" />
      <polyline points="9 21 3 21 3 15" />
      <line x1="21" y1="3" x2="14" y2="10" />
      <line x1="3" y1="21" x2="10" y2="14" />
    `;
  }
  setTimeout(initCanvas, 120);
});

function getCoords(e) {
  const rect = canvas.getBoundingClientRect();
  const clientX = e.touches ? e.touches[0].clientX : e.clientX;
  const clientY = e.touches ? e.touches[0].clientY : e.clientY;

  if (isForceLandscape) {
    return {
      x: clientY - rect.top,
      y: rect.right - clientX
    };
  }

  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

function startAction(e) {
  tryNativeLandscapeLock();
  if (e.target !== canvas) return;
  const { x, y } = getCoords(e);

  if (currentTool === 'text') {
    if (textOverlay.style.display === 'block') {
      commitTextToCanvas();
    }
    openTextBox(x, y);
    return;
  }

  isDrawing = true;
  points = [{ x, y }];
  startPos = { x, y };

  if (currentTool === 'marker' || currentTool === 'pencil' || currentTool === 'shape') {
    strokeSnapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);
    if (currentTool !== 'shape') redrawLiveStroke();
  } else {
    drawCurrentSegment(x, y, x, y);
  }
}

function moveAction(e) {
  if (!isDrawing || currentTool === 'text') return;
  e.preventDefault();
  const { x, y } = getCoords(e);

  if (currentTool === 'shape') {
    drawLiveShape(startPos.x, startPos.y, x, y);
    return;
  }

  const prev = points[points.length - 1];
  if (Math.hypot(x - prev.x, y - prev.y) > 1.5) {
    points.push({ x, y });
    if (currentTool === 'marker' || currentTool === 'pencil') {
      redrawLiveStroke();
    } else {
      drawCurrentSegment(prev.x, prev.y, x, y);
    }
  }
}

function endAction() {
  if (!isDrawing) return;
  if (currentTool === 'marker' || currentTool === 'pencil') {
    redrawLiveStroke();
    strokeSnapshot = null;
  } else if (currentTool === 'shape') {
    strokeSnapshot = null;
  }
  isDrawing = false;
  points = [];
  saveState();
}

function drawCurrentSegment(x1, y1, x2, y2) {
  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (currentTool === 'pen') {
    ctx.globalAlpha = 1;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize;
  } else if (currentTool === 'brush') {
    ctx.globalAlpha = 0.85;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize * 1.8;
    ctx.shadowBlur = currentSize * 0.6;
    ctx.shadowColor = currentColor;
  } else if (currentTool === 'eraser') {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.lineWidth = currentSize * 2.5;
  }

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function redrawLiveStroke() {
  if (points.length === 0 || !strokeSnapshot) return;
  ctx.putImageData(strokeSnapshot, 0, 0);

  ctx.save();
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (currentTool === 'marker') {
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = currentSize * 2.2;
  } else if (currentTool === 'pencil') {
    ctx.globalAlpha = 0.7;
    ctx.strokeStyle = currentColor;
    ctx.lineWidth = Math.max(1, currentSize * 0.75);
  }

  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  if (points.length === 1) {
    ctx.lineTo(points[0].x + 0.1, points[0].y + 0.1);
  } else {
    for (let i = 1; i < points.length; i++) {
      ctx.lineTo(points[i].x, points[i].y);
    }
  }
  ctx.stroke();
  ctx.restore();
}

function drawLiveShape(x1, y1, x2, y2) {
  if (!strokeSnapshot) return;
  ctx.putImageData(strokeSnapshot, 0, 0);

  ctx.save();
  ctx.strokeStyle = currentColor;
  ctx.lineWidth = currentSize;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();

  if (currentShape === 'line') {
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
  } else if (currentShape === 'arrow') {
    const headLen = Math.max(12, currentSize * 3);
    const angle = Math.atan2(y2 - y1, x2 - x1);
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
  } else if (currentShape === 'rect') {
    ctx.strokeRect(x1, y1, x2 - x1, y2 - y1);
  } else if (currentShape === 'circle') {
    const radiusX = Math.abs(x2 - x1) / 2;
    const radiusY = Math.abs(y2 - y1) / 2;
    const centerX = Math.min(x1, x2) + radiusX;
    const centerY = Math.min(y1, y2) + radiusY;
    ctx.ellipse(centerX, centerY, radiusX, radiusY, 0, 0, Math.PI * 2);
  } else if (currentShape === 'triangle') {
    ctx.moveTo((x1 + x2) / 2, y1);
    ctx.lineTo(x2, y2);
    ctx.lineTo(x1, y2);
    ctx.closePath();
  }

  ctx.stroke();
  ctx.restore();
}

function openTextBox(x, y) {
  const { width, height } = getLogicalBoardSize();
  textPosX = Math.min(x, width - 160);
  textPosY = Math.min(y, height - 60);

  const fontSize = Math.max(14, currentSize * 2.2);
  textOverlay.style.left = `${textPosX}px`;
  textOverlay.style.top = `${textPosY}px`;
  textOverlay.style.display = 'block';

  floatingTextarea.value = '';
  floatingTextarea.style.color = currentColor;
  floatingTextarea.style.fontSize = `${fontSize}px`;
  setTimeout(() => floatingTextarea.focus(), 10);
}

function commitTextToCanvas() {
  const text = floatingTextarea.value.trim();
  if (text) {
    const fontSize = Math.max(14, currentSize * 2.2);
    ctx.save();
    ctx.font = `500 ${fontSize}px Inter, sans-serif`;
    ctx.fillStyle = currentColor;
    ctx.textBaseline = 'top';

    const lines = floatingTextarea.value.split('\n');
    lines.forEach((line, index) => {
      ctx.fillText(line, textPosX + 10, textPosY + 8 + index * (fontSize * 1.3));
    });
    ctx.restore();
    saveState();
  }
  textOverlay.style.display = 'none';
  floatingTextarea.value = '';
}

confirmTextBtn.addEventListener('click', commitTextToCanvas);
cancelTextBtn.addEventListener('click', () => {
  textOverlay.style.display = 'none';
  floatingTextarea.value = '';
});

canvas.addEventListener('mousedown', startAction);
canvas.addEventListener('mousemove', moveAction);
window.addEventListener('mouseup', endAction);

canvas.addEventListener('touchstart', startAction, { passive: false });
canvas.addEventListener('touchmove', moveAction, { passive: false });
window.addEventListener('touchend', endAction);

window.addEventListener('resize', applyResponsiveOrientation);
window.addEventListener('orientationchange', applyResponsiveOrientation);

applyResponsiveOrientation();