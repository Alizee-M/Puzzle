'use strict';

/* ----------------------------------------------------------------------
 * Puzzle Laser Generator
 * Génère le réseau complet de découpe d'un puzzle photo à taquets
 * classiques (jigsaw) et l'exporte en SVG (unités = millimètres) prêt
 * pour une découpe laser (xTool M2, LightBurn, xTool Creative Space...).
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

/* ---------------- Seeded PRNG (mulberry32) ---------------- */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- Catmull-Rom -> cubic Bezier ---------------- */
function catmullRomToBezierPath(points) {
  let d = '';
  const p = points;
  const n = p.length;
  for (let i = 0; i < n - 1; i++) {
    const p0 = p[i - 1] || p[i];
    const p1 = p[i];
    const p2 = p[i + 1];
    const p3 = p[i + 2] || p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${cp1x.toFixed(3)},${cp1y.toFixed(3)} ${cp2x.toFixed(3)},${cp2y.toFixed(3)} ${p2.x.toFixed(3)},${p2.y.toFixed(3)}`;
  }
  return d;
}

/* ---------------- Tab (taquet) profile ----------------
 * Profil générique d'un bord de pièce, exprimé en coordonnées locales :
 * x = position le long du bord (0..len), y = décalage perpendiculaire.
 * La forme "champignon" (col étroit + bulbe) est ce qui crée
 * l'emboîtement classique des puzzles à taquets. Les positions sont
 * exprimées relativement au centre du taquet (0.5 par défaut), qui est
 * lui-même randomisé par pièce pour que le col/bulbe ne soit pas
 * systématiquement au milieu du bord.
 * ------------------------------------------------------- */
const TAB_RELATIVE_PROFILE = [
  [-0.200, 0.00],
  [-0.140, 0.20],
  [-0.180, 0.55],
  [-0.140, 0.85],
  [0.000, 1.00],
  [0.140, 0.85],
  [0.180, 0.55],
  [0.140, 0.20],
  [0.200, 0.00],
];

function tabProfilePoints(len, flip, tabSizeFrac, jitterAmt, rnd) {
  const depth = len * tabSizeFrac * flip * (0.85 + rnd() * 0.3);
  const centerSpread = 0.15 + jitterAmt * 0.35;
  const center = 0.5 + (rnd() - 0.5) * centerSpread;

  const points = [{ x: 0, y: 0 }];
  for (const [relT, o] of TAB_RELATIVE_PROFILE) {
    points.push({ x: (center + relT) * len, y: o * depth });
  }
  points.push({ x: len, y: 0 });
  return points;
}

function buildHorizontalBoundary(y0, cols, cellW, tabSizeFrac, jitterAmt, rnd) {
  const points = [{ x: 0, y: y0 }];
  for (let c = 0; c < cols; c++) {
    const flip = rnd() < 0.5 ? 1 : -1;
    const seg = tabProfilePoints(cellW, flip, tabSizeFrac, jitterAmt, rnd);
    for (let i = 1; i < seg.length; i++) {
      points.push({ x: c * cellW + seg[i].x, y: y0 + seg[i].y });
    }
  }
  return points;
}

function buildVerticalBoundary(x0, rows, cellH, tabSizeFrac, jitterAmt, rnd) {
  const points = [{ x: x0, y: 0 }];
  for (let r = 0; r < rows; r++) {
    const flip = rnd() < 0.5 ? 1 : -1;
    const seg = tabProfilePoints(cellH, flip, tabSizeFrac, jitterAmt, rnd);
    for (let i = 1; i < seg.length; i++) {
      points.push({ x: x0 + seg[i].y, y: r * cellH + seg[i].x });
    }
  }
  return points;
}

/**
 * Construit le réseau complet de traits de découpe du puzzle.
 * @returns {string[]} tableau de "d" (path data) SVG, en millimètres.
 */
function generatePuzzleCutPaths(W, H, cols, rows, tabSizeFrac, jitterAmt, seed, includeBorder) {
  const rnd = mulberry32(seed);
  const cellW = W / cols;
  const cellH = H / rows;
  const d = [];

  if (includeBorder) {
    d.push(`M 0,0 L ${W},0 L ${W},${H} L 0,${H} Z`);
  }

  for (let r = 1; r < rows; r++) {
    const pts = buildHorizontalBoundary(r * cellH, cols, cellW, tabSizeFrac, jitterAmt, rnd);
    d.push(`M ${pts[0].x.toFixed(3)},${pts[0].y.toFixed(3)}` + catmullRomToBezierPath(pts));
  }

  for (let c = 1; c < cols; c++) {
    const pts = buildVerticalBoundary(c * cellW, rows, cellH, tabSizeFrac, jitterAmt, rnd);
    d.push(`M ${pts[0].x.toFixed(3)},${pts[0].y.toFixed(3)}` + catmullRomToBezierPath(pts));
  }

  return d;
}

/* ---------------- Assemblage du SVG final ---------------- */
function buildSVG({ W, H, cols, rows, tabSizeFrac, jitterAmt, seed, strokeColor, includePhoto, includeBorder }) {
  const cutPaths = generatePuzzleCutPaths(W, H, cols, rows, tabSizeFrac, jitterAmt, seed, includeBorder);
  const strokeWidth = 0.1; // mm — trait fin adapté à la découpe vectorielle laser
  const margin = includeBorder ? 1 : 0; // mm — évite que le contour extérieur soit rogné par le viewBox

  let photoLayer = '';
  if (includePhoto && imageDataURL) {
    photoLayer = `<g id="photo">
    <image x="0" y="0" width="${W}" height="${H}" href="${imageDataURL}" preserveAspectRatio="xMidYMid slice" />
  </g>`;
  }

  const cutLayer = `<g id="cut" fill="none" stroke="${strokeColor}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round">
    ${cutPaths.map((d) => `<path d="${d}" />`).join('\n    ')}
  </g>`;

  const totalW = W + margin * 2;
  const totalH = H + margin * 2;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}mm" height="${totalH}mm" viewBox="0 0 ${totalW} ${totalH}">
  <g transform="translate(${margin}, ${margin})">
  ${photoLayer}
  ${cutLayer}
  </g>
</svg>`;
}

/* ---------------- UI wiring ---------------- */
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
  const seed = parseInt(els.seed.value, 10) || 1;
  const strokeColor = els.strokeColor.value;
  const includePhoto = els.includePhoto.checked;
  const includeBorder = els.includeBorder.checked;

  if (!W || !H || !cols || !rows) return;

  lastSVGString = buildSVG({ W, H, cols, rows, tabSizeFrac, jitterAmt, seed, strokeColor, includePhoto, includeBorder });
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
