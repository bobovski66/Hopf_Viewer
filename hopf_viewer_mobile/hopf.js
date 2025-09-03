// Hopf Viewer — Mobile + S² Panel — no external deps; Canvas 2D line rendering with a tiny 3D pipeline.

const cnv = document.getElementById('cnv');
const ctx = cnv.getContext('2d');

const ui = {
  proj: document.getElementById('projection'),
  alpha: document.getElementById('alpha'),
  alphaVal: document.getElementById('alphaVal'),
  latRings: document.getElementById('latRings'),
  latRingsVal: document.getElementById('latRingsVal'),
  longs: document.getElementById('longitudes'),
  longsVal: document.getElementById('longitudesVal'),
  segments: document.getElementById('segments'),
  segmentsVal: document.getElementById('segmentsVal'),
  lineWidth: document.getElementById('lineWidth'),
  lineWidthVal: document.getElementById('lineWidthVal'),
  showTetra: document.getElementById('showTetra'),
  regen: document.getElementById('regen'),
  resetView: document.getElementById('resetView'),
  softmaxRow: document.getElementById('softmaxRow'),
};

// S² base panel UI
const s2 = {
  cnv: document.getElementById('s2panel'),
  hemi: document.getElementById('hemi'),
  showGrid: document.getElementById('showGrid'),
  showCustom: document.getElementById('showCustom'),
  clearCustom: document.getElementById('clearCustom'),
  removeLast: document.getElementById('removeLast'),
  radius: 136,
  center: [144, 144],
};
let custom = []; // { v4: Float32Array, color: [r,g,b], base: [nx,ny,nz] }

// Mobile toggle
const panelToggle = document.getElementById('panelToggle');
panelToggle.addEventListener('click', () => {
  document.body.classList.toggle('panel-open');
});

// Tiny 3D pipeline
let cam = { yaw: 0.5, pitch: 0.2, dist: 8, fov: 800 };
let viewW = 0, viewH = 0, dpr = Math.max(1, window.devicePixelRatio || 1);

// Rotations
function rotY(p, a) { const ca=Math.cos(a), sa=Math.sin(a); return [ ca*p[0]+sa*p[2], p[1], -sa*p[0]+ca*p[2] ]; }
function rotX(p, a) { const ca=Math.cos(a), sa=Math.sin(a); return [ p[0], ca*p[1]-sa*p[2], sa*p[1]+ca*p[2] ]; }

function project(p3) {
  let p = p3.slice();
  p = rotY(p, cam.yaw);
  p = rotX(p, cam.pitch);
  p[2] += cam.dist;
  const s = cam.fov / (p[2] || 1e-6);
  return [ viewW/2 + p[0]*s, viewH/2 - p[1]*s, p[2] ];
}

// Tetra embedding for Δ³
const tet = [
  [ 1,  1,  1],
  [ 1, -1, -1],
  [-1,  1, -1],
  [-1, -1,  1],
];
const tetEdges = [[0,1],[0,2],[0,3],[1,2],[1,3],[2,3]];

// Model generation
let fibers = []; // array of {v4: Float32Array, color: [r,g,b]}

function softmax(v, alpha) {
  const exps = v.map(x => Math.exp(alpha * x));
  const Z = exps.reduce((a,b)=>a+b, 0);
  return exps.map(x => x / Z);
}
function barycentricToR3(p) {
  const x = p[0]*tet[0][0] + p[1]*tet[1][0] + p[2]*tet[2][0] + p[3]*tet[3][0];
  const y = p[0]*tet[0][1] + p[1]*tet[1][1] + p[2]*tet[2][1] + p[3]*tet[3][1];
  const z = p[0]*tet[0][2] + p[1]*tet[1][2] + p[2]*tet[2][2] + p[3]*tet[3][2];
  return [x,y,z];
}

function hopfFiberR4(n, segments) {
  const nx = n[0], ny = n[1], nz = n[2];
  const eta = 0.5 * Math.acos(Math.max(-1, Math.min(1, nz)));
  const delta = Math.atan2(ny, nx);
  const xi1 = delta, xi2 = 0.0;
  const pts = new Float32Array(segments*4);
  for (let i=0; i<segments; i++) {
    const t = 2*Math.PI * i/(segments-1);
    const c = Math.cos(eta), s = Math.sin(eta);
    const z1r = c * Math.cos(xi1 + t), z1i = c * Math.sin(xi1 + t);
    const z2r = s * Math.cos(xi2 + t), z2i = s * Math.sin(xi2 + t);
    pts[4*i+0] = z1r; // x1
    pts[4*i+1] = z1i; // x2
    pts[4*i+2] = z2r; // x3
    pts[4*i+3] = z2i; // x4
  }
  return pts;
}

function stereographicR3(v4) {
  const X = new Float32Array((v4.length/4)*3);
  for (let i=0; i<v4.length/4; i++) {
    const x1 = v4[4*i+0], x2 = v4[4*i+1], x3 = v4[4*i+2], x4 = v4[4*i+3];
    let d = 1 - x4;
    if (Math.abs(d) < 1e-6) d = (d>=0?1:-1)*1e-6;
    X[3*i+0] = x1 / d;
    X[3*i+1] = x2 / d;
    X[3*i+2] = x3 / d;
  }
  return X;
}

function softmaxR3(v4, alpha) {
  const X = new Float32Array((v4.length/4)*3);
  for (let i=0; i<v4.length/4; i++) {
    const p = softmax([v4[4*i+0], v4[4*i+1], v4[4*i+2], v4[4*i+3]], alpha);
    const r3 = barycentricToR3(p);
    X[3*i+0] = r3[0];
    X[3*i+1] = r3[1];
    X[3*i+2] = r3[2];
  }
  return X;
}

function hueColor(h) {
  const s=0.65, l=0.6;
  const a = s * Math.min(l, 1-l);
  function f(n){
    const k = (n + h*12) % 12;
    return l - a * Math.max(-1, Math.min(k-3, 9-k, 1));
  }
  return [f(0), f(8), f(4)];
}

function regenFibers() {
  fibers = [];
  const latRings = parseInt(ui.latRings.value, 10);
  const longs = parseInt(ui.longs.value, 10);
  const segments = parseInt(ui.segments.value, 10);

  const nzs = [];
  for (let i=0; i<latRings; i++) {
    const z = -0.85 + (1.7) * i / Math.max(1, latRings-1);
    nzs.push(z);
  }
  const deltas = [];
  for (let j=0; j<longs; j++) {
    deltas.push(2*Math.PI*j/longs);
  }

  nzs.forEach((nz, ri) => {
    const r = Math.sqrt(Math.max(0, 1 - nz*nz));
    deltas.forEach((delta, li) => {
      const nx = r * Math.cos(delta);
      const ny = r * Math.sin(delta);
      const v4 = hopfFiberR4([nx,ny,nz], segments);
      fibers.push({
        v4,
        color: hueColor( (ri / Math.max(1,latRings-1))*0.66 )
      });
    });
  });
}

// ----- S² base panel -----
function drawS2Panel() {
  const c = s2.cnv.getContext('2d');
  c.clearRect(0,0,s2.cnv.width,s2.cnv.height);

  // Disk boundary
  c.save();
  c.lineWidth = 2;
  c.strokeStyle = '#334155';
  c.beginPath();
  c.arc(s2.center[0], s2.center[1], s2.radius, 0, Math.PI*2);
  c.stroke();

  // Latitude circles
  c.globalAlpha = 0.3;
  c.lineWidth = 1;
  const zLats = [0.0, 0.5, -0.5, 0.8, -0.8];
  zLats.forEach(z => {
    if (z*z >= 1) return;
    const r = Math.sqrt(1 - z*z) * s2.radius;
    c.beginPath();
    c.arc(s2.center[0], s2.center[1], r, 0, Math.PI*2);
    c.strokeStyle = z >= 0 ? '#6ea8fe' : '#a78bfa';
    c.stroke();
  });
  c.globalAlpha = 1.0;

  // Crosshair
  c.strokeStyle = '#203047';
  c.beginPath();
  c.moveTo(s2.center[0]-s2.radius, s2.center[1]);
  c.lineTo(s2.center[0]+s2.radius, s2.center[1]);
  c.moveTo(s2.center[0], s2.center[1]-s2.radius);
  c.lineTo(s2.center[0], s2.center[1]+s2.radius);
  c.stroke();

  // Hemisphere label
  c.fillStyle = '#98a2b3';
  c.font = '12px system-ui, sans-serif';
  c.fillText(s2.hemi.value === 'north' ? 'North hemisphere (z≥0)' : 'South hemisphere (z≤0)', 10, 18);

  // Custom basepoints
  custom.forEach(f => {
    const nx = f.base[0], ny = f.base[1];
    const x = s2.center[0] + nx * s2.radius;
    const y = s2.center[1] - ny * s2.radius;
    c.fillStyle = `rgb(${Math.floor(f.color[0]*255)}, ${Math.floor(f.color[1]*255)}, ${Math.floor(f.color[2]*255)})`;
    c.beginPath();
    c.arc(x, y, 3, 0, Math.PI*2);
    c.fill();
  });

  c.restore();
}

s2.cnv.addEventListener('click', (e) => {
  const rect = s2.cnv.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = (x - s2.center[0]) / s2.radius;
  const dy = (s2.center[1] - y) / s2.radius;
  const r2 = dx*dx + dy*dy;
  if (r2 > 1.0) return;

  let nz = Math.sqrt(Math.max(0, 1 - r2));
  if (s2.hemi.value === 'south') nz = -nz;
  const n = [dx, dy, nz];

  const segments = parseInt(ui.segments.value, 10);
  const v4 = hopfFiberR4(n, segments);
  const ang = Math.atan2(n[1], n[0]);
  const hue = (ang/(2*Math.PI) + 1) % 1.0;
  const color = hueColor(hue);

  custom.push({ v4, color, base: n });
  drawS2Panel();
});

// Touch support on S² panel (pointerdown -> synth click behavior for iOS Safari)
s2.cnv.addEventListener('pointerdown', (e) => {
  const rect = s2.cnv.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  const dx = (x - s2.center[0]) / s2.radius;
  const dy = (s2.center[1] - y) / s2.radius;
  const r2 = dx*dx + dy*dy;
  if (r2 <= 1.0) {
    let nz = Math.sqrt(Math.max(0, 1 - r2));
    if (s2.hemi.value === 'south') nz = -nz;
    const n = [dx, dy, nz];
    const segments = parseInt(ui.segments.value, 10);
    const v4 = hopfFiberR4(n, segments);
    const ang = Math.atan2(n[1], n[0]);
    const hue = (ang/(2*Math.PI) + 1) % 1.0;
    const color = hueColor(hue);
    custom.push({ v4, color, base: n });
    drawS2Panel();
  }
}, { passive: false });

s2.clearCustom.addEventListener('click', () => { custom = []; drawS2Panel(); });
s2.removeLast.addEventListener('click', () => { custom.pop(); drawS2Panel(); });

// DPR & responsive canvas
function resize() {
  const small = window.innerWidth <= 720;
  const panelW = small ? 0 : 320;
  viewW = Math.max(300, window.innerWidth - panelW);
  viewH = window.innerHeight;
  dpr = Math.max(1, window.devicePixelRatio || 1);
  cnv.style.width = viewW + 'px';
  cnv.style.height = viewH + 'px';
  cnv.width = Math.floor(viewW * dpr);
  cnv.height = Math.floor(viewH * dpr);
}
window.addEventListener('resize', resize);

// Pointer gestures for main canvas
const pointers = new Map();
let lastPinchDist = null;
let lastTapTime = 0;

function pointerPos(e) { return [e.clientX, e.clientY]; }
function distance(a, b) { const dx=a[0]-b[0], dy=a[1]-b[1]; return Math.hypot(dx,dy); }

function cnvPointerDown(e) {
  cnv.setPointerCapture(e.pointerId);
  pointers.set(e.pointerId, pointerPos(e));
  const now = performance.now();
  if (now - lastTapTime < 300) { cam = { yaw: 0.5, pitch: 0.2, dist: 8, fov: 800 }; }
  lastTapTime = now;
  e.preventDefault();
}
function cnvPointerMove(e) {
  if (!pointers.has(e.pointerId)) return;
  const prev = pointers.get(e.pointerId);
  const cur = pointerPos(e);
  pointers.set(e.pointerId, cur);

  if (pointers.size === 1) {
    const dx = cur[0] - prev[0], dy = cur[1] - prev[1];
    cam.yaw += dx * 0.005;
    cam.pitch += dy * 0.005;
  } else if (pointers.size === 2) {
    const pts = Array.from(pointers.values());
    const d = distance(pts[0], pts[1]);
    if (lastPinchDist != null) {
      const scale = d / (lastPinchDist || d);
      cam.dist /= (scale || 1);
      cam.dist = Math.max(2, Math.min(40, cam.dist));
    }
    lastPinchDist = d;
  }
  e.preventDefault();
}
function cnvPointerUp(e) {
  pointers.delete(e.pointerId);
  if (pointers.size < 2) lastPinchDist = null;
  e.preventDefault();
}

cnv.addEventListener('pointerdown', cnvPointerDown, { passive: false });
cnv.addEventListener('pointermove', cnvPointerMove, { passive: false });
cnv.addEventListener('pointerup', cnvPointerUp, { passive: false });
cnv.addEventListener('pointercancel', cnvPointerUp, { passive: false });

// Mouse wheel zoom (desktop)
cnv.addEventListener('wheel', (e) => {
  cam.dist *= (1 + Math.sign(e.deltaY) * 0.1);
  cam.dist = Math.max(2, Math.min(40, cam.dist));
}, { passive: true });

function drawTetra() {
  ctx.save();
  ctx.globalAlpha = 0.25;
  ctx.lineWidth = 1;
  ctx.strokeStyle = '#dbe2ef';
  tetEdges.forEach(([a,b]) => {
    const A = project(tet[a]);
    const B = project(tet[b]);
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.stroke();
  });
  ctx.restore();
}

function draw() {
  // scale to device pixels but draw in CSS pixels
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.clearRect(0,0,viewW,viewH);

  // S² panel refresh
  drawS2Panel();

  // Softmax tetrahedron (optional)
  if (ui.proj.value === 'softmax' && ui.showTetra.checked) {
    drawTetra();
  }

  const alpha = parseFloat(ui.alpha.value);
  const lineWidth = parseInt(ui.lineWidth.value, 10);

  // Grid fibers
  if (s2.showGrid.checked) fibers.forEach(f => {
    const pts3 = (ui.proj.value === 'stereo') ? stereographicR3(f.v4) : softmaxR3(f.v4, alpha);
    ctx.beginPath();
    for (let i=0; i<pts3.length/3; i++) {
      const q = project([pts3[3*i], pts3[3*i+1], pts3[3*i+2]]);
      if (i===0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgb(${Math.floor(f.color[0]*255)}, ${Math.floor(f.color[1]*255)}, ${Math.floor(f.color[2]*255)})`;
    ctx.stroke();
  });

  // Custom fibers
  if (s2.showCustom.checked) custom.forEach(f => {
    const pts3 = (ui.proj.value === 'stereo') ? stereographicR3(f.v4) : softmaxR3(f.v4, alpha);
    ctx.beginPath();
    for (let i=0; i<pts3.length/3; i++) {
      const q = project([pts3[3*i], pts3[3*i+1], pts3[3*i+2]]);
      if (i===0) ctx.moveTo(q[0], q[1]); else ctx.lineTo(q[0], q[1]);
    }
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = `rgb(${Math.floor(f.color[0]*255)}, ${Math.floor(f.color[1]*255)}, ${Math.floor(f.color[2]*255)})`;
    ctx.stroke();
  });

  requestAnimationFrame(draw);
}

// UI bindings and init
function bindUI() {
  ui.alpha.addEventListener('input', () => ui.alphaVal.textContent = parseFloat(ui.alpha.value).toFixed(1));
  ui.latRings.addEventListener('input', () => ui.latRingsVal.textContent = ui.latRings.value);
  ui.longs.addEventListener('input', () => ui.longsVal.textContent = ui.longs.value);
  ui.segments.addEventListener('input', () => ui.segmentsVal.textContent = ui.segments.value);
  ui.lineWidth.addEventListener('input', () => ui.lineWidthVal.textContent = ui.lineWidth.value);
  ui.proj.addEventListener('change', () => { ui.softmaxRow.style.display = (ui.proj.value === 'softmax') ? 'flex' : 'none'; });

  // S² panel redraw hooks
  ['change','input'].forEach(ev => {
    s2.hemi.addEventListener(ev, drawS2Panel);
    s2.showGrid.addEventListener(ev, drawS2Panel);
    s2.showCustom.addEventListener(ev, drawS2Panel);
  });

  ui.regen.addEventListener('click', regenFibers);
  ui.resetView.addEventListener('click', () => { cam = { yaw: 0.5, pitch: 0.2, dist: 8, fov: 800 }; });
}

function init() {
  ui.alphaVal.textContent = parseFloat(ui.alpha.value).toFixed(1);
  ui.latRingsVal.textContent = ui.latRings.value;
  ui.longsVal.textContent = ui.longs.value;
  ui.segmentsVal.textContent = ui.segments.value;
  ui.lineWidthVal.textContent = ui.lineWidth.value;
  ui.softmaxRow.style.display = (ui.proj.value === 'softmax') ? 'flex' : 'none';
  resize();
  regenFibers();
  bindUI();
  drawS2Panel();
  requestAnimationFrame(draw);
}

init();
