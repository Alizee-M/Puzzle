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
  tabSize: document.getElementById('tabSize'),
  tabSizeValue: document.getElementById('tabSizeValue'),
  jitter: document.getElementById('jitter'),
  jitterValue: document.getElementById('jitterValue'),
  centerTabs: document.getElementById('centerTabs'),
  seed: document.getElementById('seed'),
  randomizeBtn: document.getElementById('randomizeBtn'),
  includePhoto: document.getElementById('includePhoto'),
  includeBorder: document.getElementById('includeBorder'),
  strokeColor: document.getElementById('strokeColor'),
  generateBtn: document.getElementById('generateBtn'),
  downloadBtn: document.getElementById('downloadBtn'),
  preview: document.getElementById('preview'),
};

let imageDataURL = null;
let imageAspect = null;
let lastSVGString = null;

function updatePieceCount() {
  const cols = parseInt(els.cols.value, 10) || 0;
  const rows = parseInt(els.rows.value, 10) || 0;
  els.pieceCountLabel.textContent = cols * rows;
}

function loadImage(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    imageDataURL = e.target.result;
    const img = new Image();
    img.onload = () => {
      imageAspect = img.width / img.height;
      if (els.lockRatio.checked) {
        els.heightMM.value = (parseFloat(els.widthMM.value) / imageAspect).toFixed(1);
      }
    };
    img.src = imageDataURL;
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

  if (!W || !H || !cols || !rows) return;

  lastSVGString = PuzzleGenerator.buildSVG({
    W, H, cols, rows, tabSizeFrac, jitterAmt, centerTabs, seed,
    strokeColor, includePhoto, includeBorder, imageDataURL,
  });
  els.preview.innerHTML = lastSVGString;
  els.downloadBtn.disabled = false;
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

updatePieceCount();
