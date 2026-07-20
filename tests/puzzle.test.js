'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const {
  computeGridForPieceCount,
  mulberry32,
  catmullRomToBezierPath,
  TAB_RELATIVE_PROFILE,
  tabProfilePoints,
  buildHorizontalBoundary,
  buildVerticalBoundary,
  generatePuzzleCutPaths,
  buildSVG,
} = require('../www/puzzle.js');

test('computeGridForPieceCount returns cols*rows close to the target', () => {
  const { cols, rows } = computeGridForPieceCount(300, 297 / 210);
  assert.ok(Math.abs(cols * rows - 300) <= 30, `${cols}x${rows}=${cols * rows} too far from 300`);
});

test('computeGridForPieceCount respects the aspect ratio (cols/rows close to aspect)', () => {
  const aspect = 297 / 210; // ~1.414 (paysage)
  const { cols, rows } = computeGridForPieceCount(300, aspect);
  const gridAspect = cols / rows;
  assert.ok(Math.abs(gridAspect - aspect) < 0.35, `grid aspect ${gridAspect} too far from ${aspect}`);
});

test('computeGridForPieceCount never returns less than 2 columns or rows', () => {
  const { cols, rows } = computeGridForPieceCount(1, 5);
  assert.ok(cols >= 2 && rows >= 2);
});

test('mulberry32 is deterministic for a given seed', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('mulberry32 produces different sequences for different seeds', () => {
  const a = mulberry32(1);
  const b = mulberry32(2);
  assert.notEqual(a(), b());
});

test('mulberry32 stays within [0, 1)', () => {
  const rnd = mulberry32(7);
  for (let i = 0; i < 1000; i++) {
    const v = rnd();
    assert.ok(v >= 0 && v < 1, `value ${v} out of range`);
  }
});

test('catmullRomToBezierPath produces one C command per segment and passes through every point', () => {
  const points = [{ x: 0, y: 0 }, { x: 10, y: 5 }, { x: 20, y: 0 }, { x: 30, y: 5 }];
  const d = catmullRomToBezierPath(points);
  const commands = d.trim().split(/\s+(?=C)/);
  assert.equal(commands.length, points.length - 1);
  // The final coordinate of each "C x1,y1 x2,y2 ex,ey" segment must match the
  // corresponding input point (the curve must pass through its anchors).
  for (let i = 1; i < points.length; i++) {
    const nums = commands[i - 1].replace('C', '').trim().split(/[\s,]+/).map(Number);
    const [, , , , ex, ey] = nums;
    assert.ok(Math.abs(ex - points[i].x) < 1e-6);
    assert.ok(Math.abs(ey - points[i].y) < 1e-6);
  }
});

test('tabProfilePoints starts at (0,0) and ends at (len,0)', () => {
  const rnd = mulberry32(1);
  const len = 30;
  const pts = tabProfilePoints(len, 1, 0.2, 0.4, false, rnd);
  assert.deepEqual(pts[0], { x: 0, y: 0 });
  assert.equal(pts[pts.length - 1].x, len);
  assert.equal(pts[pts.length - 1].y, 0);
});

test('tabProfilePoints has one point per TAB_RELATIVE_PROFILE entry plus the two fixed endpoints', () => {
  const rnd = mulberry32(1);
  const pts = tabProfilePoints(30, 1, 0.2, 0.4, false, rnd);
  assert.equal(pts.length, TAB_RELATIVE_PROFILE.length + 2);
});

test('tabProfilePoints centers the peak at len/2 when centerTabs is true, regardless of jitter', () => {
  const len = 40;
  for (const seed of [1, 2, 3, 4, 5]) {
    const rnd = mulberry32(seed);
    const pts = tabProfilePoints(len, 1, 0.2, 1, true, rnd);
    // TAB_RELATIVE_PROFILE's middle entry [0.000, 1.00] is the tab peak.
    const peakIndex = TAB_RELATIVE_PROFILE.findIndex(([relT]) => relT === 0);
    const peak = pts[peakIndex + 1]; // +1 to account for the fixed leading (0,0) point
    assert.ok(Math.abs(peak.x - len / 2) < 1e-9, `peak.x=${peak.x} expected ${len / 2}`);
  }
});

test('tabProfilePoints keeps the peak centered at jitterAmt=0 even when centerTabs is false (irregularity slider at its minimum means no position spread)', () => {
  const len = 40;
  const peakIndex = TAB_RELATIVE_PROFILE.findIndex(([relT]) => relT === 0) + 1;
  for (const seed of [10, 20, 30]) {
    const rnd = mulberry32(seed);
    const pts = tabProfilePoints(len, 1, 0.2, 0, false, rnd);
    assert.ok(Math.abs(pts[peakIndex].x - len / 2) < 1e-9);
  }
});

test('tabProfilePoints varies the peak position across seeds when jitterAmt > 0 and centerTabs is false', () => {
  const len = 40;
  const peakIndex = TAB_RELATIVE_PROFILE.findIndex(([relT]) => relT === 0) + 1;
  const positions = [1, 2, 3, 4, 5, 6, 7, 8].map((seed) => {
    const rnd = mulberry32(seed);
    return tabProfilePoints(len, 1, 1, 0.8, false, rnd)[peakIndex].x;
  });
  const allSame = positions.every((x) => Math.abs(x - positions[0]) < 1e-9);
  assert.ok(!allSame, 'expected the tab peak position to vary across seeds with jitter enabled');
});

test('buildHorizontalBoundary spans exactly from x=0 to x=cols*cellW at height y0', () => {
  const rnd = mulberry32(3);
  const cellW = 25;
  const cols = 6;
  const pts = buildHorizontalBoundary(50, cols, cellW, 0.2, 0.4, false, rnd);
  assert.deepEqual(pts[0], { x: 0, y: 50 });
  const last = pts[pts.length - 1];
  assert.ok(Math.abs(last.x - cols * cellW) < 1e-6);
  assert.ok(Math.abs(last.y - 50) < 1e-6);
});

test('buildVerticalBoundary spans exactly from y=0 to y=rows*cellH at x=x0', () => {
  const rnd = mulberry32(3);
  const cellH = 20;
  const rows = 5;
  const pts = buildVerticalBoundary(70, rows, cellH, 0.2, 0.4, false, rnd);
  assert.deepEqual(pts[0], { x: 70, y: 0 });
  const last = pts[pts.length - 1];
  assert.ok(Math.abs(last.x - 70) < 1e-6);
  assert.ok(Math.abs(last.y - rows * cellH) < 1e-6);
});

test('generatePuzzleCutPaths returns border + (rows-1) horizontal + (cols-1) vertical paths', () => {
  const cols = 5;
  const rows = 4;
  const withBorder = generatePuzzleCutPaths(200, 150, cols, rows, 0.2, 0.4, false, 1, true);
  assert.equal(withBorder.length, 1 + (rows - 1) + (cols - 1));

  const withoutBorder = generatePuzzleCutPaths(200, 150, cols, rows, 0.2, 0.4, false, 1, false);
  assert.equal(withoutBorder.length, (rows - 1) + (cols - 1));
});

test('generatePuzzleCutPaths includes the exact outer rectangle as the first path when includeBorder is true', () => {
  const paths = generatePuzzleCutPaths(200, 150, 5, 4, 0.2, 0.4, false, 1, true);
  assert.equal(paths[0], 'M 0,0 L 200,0 L 200,150 L 0,150 Z');
});

test('generatePuzzleCutPaths is deterministic for a given seed', () => {
  const a = generatePuzzleCutPaths(200, 150, 5, 4, 0.2, 0.4, false, 99, true);
  const b = generatePuzzleCutPaths(200, 150, 5, 4, 0.2, 0.4, false, 99, true);
  assert.deepEqual(a, b);
});

test('generatePuzzleCutPaths differs for different seeds', () => {
  const a = generatePuzzleCutPaths(200, 150, 5, 4, 0.2, 0.4, false, 1, true);
  const b = generatePuzzleCutPaths(200, 150, 5, 4, 0.2, 0.4, false, 2, true);
  assert.notDeepEqual(a, b);
});

test('buildSVG sizes the viewBox to W/H with no margin when the border is excluded', () => {
  const svg = buildSVG({
    W: 100, H: 80, cols: 3, rows: 2, tabSizeFrac: 0.2, jitterAmt: 0.4, centerTabs: false,
    seed: 1, strokeColor: '#ff0000', includePhoto: false, includeBorder: false, engraveDataURL: null,
  });
  assert.match(svg, /viewBox="0 0 100 80"/);
  assert.match(svg, /width="100mm" height="80mm"/);
});

test('buildSVG adds a 1mm margin on each side when the border is included', () => {
  const svg = buildSVG({
    W: 100, H: 80, cols: 3, rows: 2, tabSizeFrac: 0.2, jitterAmt: 0.4, centerTabs: false,
    seed: 1, strokeColor: '#ff0000', includePhoto: false, includeBorder: true, engraveDataURL: null,
  });
  assert.match(svg, /viewBox="0 0 102 82"/);
  assert.match(svg, /width="102mm" height="82mm"/);
});

test('buildSVG only embeds the engrave layer when includePhoto is true and engraveDataURL is set', () => {
  const base = {
    W: 100, H: 80, cols: 3, rows: 2, tabSizeFrac: 0.2, jitterAmt: 0.4, centerTabs: false,
    seed: 1, strokeColor: '#ff0000', includeBorder: false,
  };
  assert.doesNotMatch(buildSVG({ ...base, includePhoto: true, engraveDataURL: null }), /<image/);
  assert.doesNotMatch(buildSVG({ ...base, includePhoto: false, engraveDataURL: 'data:image/png;base64,xx' }), /<image/);
  assert.match(buildSVG({ ...base, includePhoto: true, engraveDataURL: 'data:image/png;base64,xx' }), /<image/);
});

test('buildSVG uses the requested stroke color for the cut layer', () => {
  const svg = buildSVG({
    W: 100, H: 80, cols: 3, rows: 2, tabSizeFrac: 0.2, jitterAmt: 0.4, centerTabs: false,
    seed: 1, strokeColor: '#00ff00', includePhoto: false, includeBorder: true, engraveDataURL: null,
  });
  assert.match(svg, /stroke="#00ff00"/);
});

test('buildSVG produces one <path> per cut path returned by generatePuzzleCutPaths', () => {
  const cols = 4;
  const rows = 3;
  const svg = buildSVG({
    W: 200, H: 150, cols, rows, tabSizeFrac: 0.2, jitterAmt: 0.4, centerTabs: false,
    seed: 1, strokeColor: '#ff0000', includePhoto: false, includeBorder: true, engraveDataURL: null,
  });
  const pathCount = (svg.match(/<path /g) || []).length;
  assert.equal(pathCount, 1 + (rows - 1) + (cols - 1));
});
