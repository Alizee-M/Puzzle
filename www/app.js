'use strict';

/* ----------------------------------------------------------------------
 * Puzzle Laser Generator — câblage UI.
 * La génération du puzzle elle-même vit dans puzzle.js (PuzzleGenerator),
 * sans dépendance au DOM, pour pouvoir être testée côté Node.
 * -------------------------------------------------------------------- */

const els = {
  photoInput: document.getElementById('photoInput'),
  widthMM: document.getElementById('widthMM'),
  heightMM: document.getElementById('heightMM'),
  lockRatio: document.getElementById('lockRatio'),
  cols: document.getElementById('cols'),
  rows: document.getElementById('rows'),
  pieceCountLabel: document.getElementById('pieceCountLabel'),
  targetPieceCount: document.getElementById('targetPieceCount'),
  applyPieceCountBtn: document.getElementById('applyPieceCountBtn'),
  tabSize: document.getElementById('tabSize'),
  tabSizeValue: document.getElementById('tabSizeValue'),
  jitter: document.getElementById('jitter'),
  jitterValue: document.getElementById('jitterValue'),
  centerTabs: document.getElementById('centerTabs'),
  seed: document.getElementById('seed'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  includePhoto: document.getElementById('includePhoto'),
  photoModeGray: document.getElementById('photoModeGray'),
  photoModeColor: document.getElementById('photoModeColor'),
  includeBorder: document.getElementById('includeBorder'),
  strokeColor: document.getElementById('strokeColor'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  preview: document.getElementById('preview'),
  zoomInBtn: document.getElementById('zoomInBtn'),
  zoomOutBtn: document.getElementById('zoomOutBtn'),
  zoomResetBtn: document.getElementById('zoomResetBtn'),
  zoomLevelLabel: document.getElementById('zoomLevelLabel'),
};

let imageAspect = null;
let grayDataURL = null;
let colorDataURL = null;
let zoomPct = 100;
const ZOOM_MIN = 25;
const ZOOM_MAX = 400;
const ZOOM_STEP = 25;
let lastSVGString = null;

function updatePieceCount() {
  const cols = parseInt(els.cols.value, 10) || 0;
  const rows = parseInt(els.rows.value, 10) || 0;
  els.pieceCountLabel.textContent = cols * rows;
}

/* Redimensionne une image sur un canvas pour rester raisonnable à intégrer
 * en base64 dans le SVG. */
function resizeToCanvas(img, maxDim) {
  let { width, height } = img;
  const scale = Math.min(1, maxDim / Math.max(width, height));
  width = Math.max(1, Math.round(width * scale));
  height = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, width, height);
  return { canvas, ctx };
}

function toColorDataURL(img, maxDim = 2000) {
  const { canvas } = resizeToCanvas(img, maxDim);
  return canvas.toDataURL('image/png');
}

/* Convertit une image en niveaux de gris (luminance), prête pour la
 * gravure laser (calque "engrave"). */
function toGrayscaleDataURL(img, maxDim = 2000) {
  const { canvas, ctx } = resizeToCanvas(img, maxDim);
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imageData.data;
  for (let i = 0; i < data.length; i += 4) {
    const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
    data[i] = data[i + 1] = data[i + 2] = gray;
  }
  ctx.putImageData(imageData, 0, 0);
  return canvas.toDataURL('image/png');
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const img = new Image();
    img.onload = () => {
      imageAspect = img.width / img.height;
      if (els.lockRatio.checked) {
        els.heightMM.value = (parseFloat(els.widthMM.value) / imageAspect).toFixed(1);
      }
      grayDataURL = toGrayscaleDataURL(img);
      colorDataURL = toColorDataURL(img);
    };
    img.src = e.target.result;
  };
  reader.readAsDataURL(file);
}

function renderPreview() {
  const W = parseFloat(els.widthMM.value);
  const H = parseFloat(els.heightMM.value);
  const cols = parseInt(els.cols.value, 10);
  const rows = parseInt(els.rows.value, 10);
  const tabSizeFrac = parseInt(els.tabSize.value, 10) / 100;
  const jitterAmt = parseInt(els.jitter.value, 10) / 100;
  const centerTabs = els.centerTabs.checked;
  const seed = parseInt(els.seed.value, 10) || 1;
  const strokeColor = els.strokeColor.value;
  const includePhoto = els.includePhoto.checked;
  const includeBorder = els.includeBorder.checked;
  const engraveDataURL = els.photoModeColor.checked ? colorDataURL : grayDataURL;

  if (!W || !H || !cols || !rows) return;

  lastSVGString = PuzzleGenerator.buildSVG({
    W, H, cols, rows, tabSizeFrac, jitterAmt, centerTabs, seed,
    strokeColor, includePhoto, includeBorder, engraveDataURL,
  });
  els.preview.innerHTML = lastSVGString;
  els.downloadBtn.disabled = false;
  applyZoom();
}

function applyZoom() {
  const svg = els.preview.querySelector('svg');
  if (svg) {
    svg.style.width = `${zoomPct}%`;
    svg.style.maxWidth = `${zoomPct}%`;
  }
  els.zoomLevelLabel.textContent = `${zoomPct}%`;
}

function setZoom(pct) {
  zoomPct = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, pct));
  applyZoom();
}

function enablePreviewPan() {
  let isDragging = false;
  let startX = 0;
  let startY = 0;
  let startScrollLeft = 0;
  let startScrollTop = 0;

  els.preview.addEventListener('mousedown', (e) => {
    if (e.target.closest('svg') === null) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    startScrollLeft = els.preview.scrollLeft;
    startScrollTop = els.preview.scrollTop;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    els.preview.scrollLeft = startScrollLeft - (e.clientX - startX);
    els.preview.scrollTop = startScrollTop - (e.clientY - startY);
  });

  window.addEventListener('mouseup', () => {
    isDragging = false;
  });
}

function downloadSVG() {
  if (!lastSVGString) return;
  const blob = new Blob([lastSVGString], { type: 'image/svg+xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'puzzle-laser.svg';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

els.photoInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) loadImage(file);
});

els.widthMM.addEventListener('input', () => {
  if (els.lockRatio.checked && imageAspect) {
    els.heightMM.value = (parseFloat(els.widthMM.value) / imageAspect).toFixed(1);
  }
});

els.cols.addEventListener('input', updatePieceCount);
els.rows.addEventListener('input', updatePieceCount);

function updatePhotoModeAvailability() {
  const disabled = !els.includePhoto.checked;
  els.photoModeGray.disabled = disabled;
  els.photoModeColor.disabled = disabled;
}
els.includePhoto.addEventListener('change', updatePhotoModeAvailability);
updatePhotoModeAvailability();

els.applyPieceCountBtn.addEventListener('click', () => {
  const target = parseInt(els.targetPieceCount.value, 10);
  if (!target) return;
  const W = parseFloat(els.widthMM.value) || 1;
  const H = parseFloat(els.heightMM.value) || 1;
  const { cols, rows } = PuzzleGenerator.computeGridForPieceCount(target, W / H);
  els.cols.value = cols;
  els.rows.value = rows;
  updatePieceCount();
});

els.tabSize.addEventListener('input', () => {
  els.tabSizeValue.textContent = els.tabSize.value;
});
els.jitter.addEventListener('input', () => {
  els.jitterValue.textContent = els.jitter.value;
});

els.randomizeBtn.addEventListener('click', () => {
  els.seed.value = Math.floor(Math.random() * 1000000);
});

els.generateBtn.addEventListener('click', renderPreview);
els.downloadBtn.addEventListener('click', downloadSVG);

els.zoomInBtn.addEventListener('click', () => setZoom(zoomPct + ZOOM_STEP));
els.zoomOutBtn.addEventListener('click', () => setZoom(zoomPct - ZOOM_STEP));
els.zoomResetBtn.addEventListener('click', () => setZoom(100));
enablePreviewPan();

updatePieceCount();
