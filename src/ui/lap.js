// Level 3: a circuit drawn in code. The car slows for corners, each sector paints itself behind it,
// the speed trace draws underneath, and every lap "ships" one of the real repos.
const NS = 'http://www.w3.org/2000/svg';
const TRACK = 'M210 352 L452 352 C548 352 598 312 584 246 C574 200 522 196 508 154 C494 112 548 74 506 50 C462 26 404 56 384 98 C366 136 330 158 288 148 C246 138 238 86 194 78 C132 66 78 104 74 172 C70 236 104 262 120 300 C134 336 156 352 210 352 Z';
const SECTORS = [
  { from: 0, to: 0.3, label: 'Idea' },
  { from: 0.3, to: 0.66, label: 'Build' },
  { from: 0.66, to: 1, label: 'Break it' },
];
const COLORS = { purple: '#b44cff', green: '#22d16b', yellow: '#f2d21b' };
const PATTERNS = [
  ['purple', 'green', 'yellow'],
  ['green', 'purple', 'green'],
  ['yellow', 'green', 'purple'],
  ['purple', 'purple', 'green'],
];
const LAP_SECONDS = 7.2;

const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
  parent?.append(n);
  return n;
};

export function createLap(root, { reduced, names = ['Atlas'] }) {
  const svg = root.querySelector('.circuit');
  svg.setAttribute('viewBox', '0 0 640 480');
  const lapN = root.querySelector('.lap-n');
  const shipped = root.querySelector('.shipped b');

  el('path', { d: TRACK, fill: 'none', stroke: '#e2e1d9', 'stroke-width': 30, 'stroke-linejoin': 'round' }, svg);
  const track = el('path', { d: TRACK, fill: 'none', stroke: '#141416', 'stroke-width': 9, 'stroke-linejoin': 'round' }, svg);
  const L = track.getTotalLength();

  // sample the lap: positions, then a speed profile that brakes before corners
  const N = 720;
  const pts = Array.from({ length: N + 1 }, (_, i) => track.getPointAtLength((i / N) * L));
  const curv = pts.map((p, i) => {
    const a = pts[(i - 6 + N) % N];
    const b = pts[(i + 6) % N];
    const a1 = Math.atan2(p.y - a.y, p.x - a.x);
    const a2 = Math.atan2(b.y - p.y, b.x - p.x);
    let d = Math.abs(a2 - a1);
    if (d > Math.PI) d = 2 * Math.PI - d;
    return d;
  });
  const smoothC = curv.map((_, i) => {
    let acc = 0;
    for (let k = -10; k <= 10; k++) acc += curv[(i + k + N) % N];
    return acc / 21;
  });
  const raw = smoothC.map((c) => 1 / (1 + c * 11));
  const speed = raw.map((_, i) => {
    let m = 1;
    for (let k = 0; k < 40; k++) m = Math.min(m, raw[(i + k) % N] + k * 0.012);   // braking zone
    for (let k = 0; k < 25; k++) m = Math.min(m, raw[(i - k + N) % N] + k * 0.02); // traction out of the corner
    return 0.28 + 0.72 * m;
  });
  // distance as a function of time
  const tAt = [0];
  for (let i = 1; i <= N; i++) tAt[i] = tAt[i - 1] + 1 / speed[i - 1];
  const total = tAt[N];
  const distAt = (u) => {
    const t = u * total;
    let lo = 0, hi = N;
    while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (tAt[mid] <= t) lo = mid; else hi = mid; }
    const f = (t - tAt[lo]) / (tAt[hi] - tAt[lo] || 1);
    return (lo + f) / N;
  };

  // two overlay sets so the finished lap can fade while the next one paints
  const makeSet = () => {
    const g = el('g', { class: 'sectors' }, svg);
    g.style.transition = 'opacity .8s cubic-bezier(.33,1,.68,1)';
    const paths = SECTORS.map((s) => {
      const p = el('path', { d: TRACK, fill: 'none', 'stroke-width': 9, 'stroke-linecap': 'butt', 'stroke-linejoin': 'round' }, g);
      p.style.strokeDasharray = `0 ${L}`;
      p.style.strokeDashoffset = `${-s.from * L}`;
      return p;
    });
    return { g, paths };
  };
  const sets = [makeSet(), makeSet()];

  // start/finish: a chequered bar across the track
  const sf = pts[0];
  const chk = el('g', { transform: `translate(${sf.x} ${sf.y})` }, svg);
  for (let r = 0; r < 2; r++) for (let c = 0; c < 4; c++) {
    el('rect', { x: -4 + r * 4, y: -12 + c * 6, width: 4, height: 6, fill: (r + c) % 2 ? '#141416' : '#f1f0ea' }, chk);
  }

  // sector ticks and labels, pushed outward along the normal
  const labels = [];
  const normalAt = (u, off) => {
    const i = Math.round(u * N) % N;
    const p = pts[i];
    const q = pts[(i + 2) % N];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    // outward: away from the centroid
    let nx = -dy / len, ny = dx / len;
    if ((p.x - 330) * nx + (p.y - 200) * ny < 0) { nx = -nx; ny = -ny; }
    return { x: p.x + nx * off, y: p.y + ny * off, nx, ny };
  };
  SECTORS.forEach((s, i) => {
    const b = normalAt(s.from, 0);
    if (i > 0) el('line', { x1: b.x - b.nx * 16, y1: b.y - b.ny * 16, x2: b.x + b.nx * 16, y2: b.y + b.ny * 16, stroke: '#141416', 'stroke-width': 2 }, svg);
    const m = normalAt((s.from + s.to) / 2, 34);
    const t = el('text', { x: m.x, y: m.y, 'text-anchor': 'middle', 'dominant-baseline': 'middle', class: 'lab-label' }, svg);
    t.textContent = s.label.toUpperCase();
    labels.push(t);
  });
  const shipLbl = el('text', { x: sf.x, y: sf.y + 34, 'text-anchor': 'middle', class: 'lab-label ship' }, svg);
  shipLbl.textContent = 'SHIP';
  labels.push(shipLbl);

  // speed trace strip
  const traceY = 400, traceH = 56, traceX = 40, traceW = 560;
  const tracePts = speed.map((v, i) => `${traceX + (i / N) * traceW},${traceY + traceH - v * traceH}`);
  el('line', { x1: traceX, y1: traceY + traceH, x2: traceX + traceW, y2: traceY + traceH, stroke: '#d4d3cb', 'stroke-width': 1 }, svg);
  el('polyline', { points: tracePts.join(' '), fill: 'none', stroke: '#cfcec6', 'stroke-width': 1.5 }, svg);
  const traceLive = el('polyline', { points: '', fill: 'none', stroke: '#141416', 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
  const tLbl = el('text', { x: traceX, y: traceY - 8, class: 'lab-label small' }, svg);
  tLbl.textContent = 'SPEED';
  const head = el('line', { x1: traceX, y1: traceY - 2, x2: traceX, y2: traceY + traceH, stroke: '#ff7a1a', 'stroke-width': 1.5 }, svg);
  labels.push(tLbl);

  // the car and its trail
  const trail = Array.from({ length: 7 }, (_, i) => el('circle', { r: 6 - i * 0.6, fill: '#ff7a1a', opacity: 0.35 - i * 0.045 }, svg));
  const car = el('circle', { r: 7.5, fill: '#ff7a1a', stroke: '#141416', 'stroke-width': 2.5 }, svg);
  const ring = el('circle', { r: 8, fill: 'none', stroke: '#141416', 'stroke-width': 1.5, opacity: 0 }, svg);
  car.style.transformBox = 'fill-box';
  car.style.transformOrigin = 'center';

  const style = document.createElement('style');
  style.textContent = `
    .lab-label { font: 500 11px 'JetBrains Mono', monospace; letter-spacing: .08em; fill: #141416; }
    .lab-label.small { font-size: 9.5px; fill: #77776f; }
    .lab-label.ship { fill: #ff7a1a; }
    .island .build { opacity: 0; transform: translateY(14px); filter: blur(5px); }
    .island .build.in { opacity: 1; transform: none; filter: none; transition: opacity .9s cubic-bezier(.16,1,.3,1), transform 1s cubic-bezier(.16,1,.3,1), filter .75s cubic-bezier(.33,1,.68,1); }
  `;
  document.head.append(style);

  let lap = 1;
  let set = 0;
  let pattern = PATTERNS[0];
  let u = 0;
  let running = false;
  let built = false;
  let visible = false;
  let last = 0;
  let nameIdx = 0;

  const place = (d) => {
    const p = track.getPointAtLength(d * L);
    car.setAttribute('cx', p.x); car.setAttribute('cy', p.y);
    ring.setAttribute('cx', p.x); ring.setAttribute('cy', p.y);
  };
  const paint = (d) => {
    sets[set].paths.forEach((p, i) => {
      const s = SECTORS[i];
      const cov = Math.max(0, Math.min(d, s.to) - s.from) * L;
      p.style.strokeDasharray = `${cov} ${L}`;
      p.style.stroke = COLORS[pattern[i]];
    });
    const idx = Math.min(N, Math.round(d * N));
    traceLive.setAttribute('points', tracePts.slice(0, idx + 1).join(' '));
    const hx = traceX + d * traceW;
    head.setAttribute('x1', hx); head.setAttribute('x2', hx);
  };
  const pulse = () => {
    ring.animate([{ r: 8, opacity: 0.9 }, { r: 26, opacity: 0 }], { duration: 700, easing: 'cubic-bezier(.16,1,.3,1)' });
    car.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.25)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.16,1,.3,1)' });
  };
  const nextLap = () => {
    lap++;
    lapN.textContent = String(lap).padStart(2, '0');
    nameIdx = (nameIdx + 1) % names.length;
    shipped.animate([{ opacity: 0, transform: 'translateY(8px)', filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 650, easing: 'cubic-bezier(.16,1,.3,1)' });
    shipped.textContent = names[nameIdx];
    const old = sets[set];
    old.g.style.opacity = '0';
    set = 1 - set;
    const fresh = sets[set];
    fresh.g.style.transition = 'none';
    fresh.g.style.opacity = '1';
    fresh.paths.forEach((p) => (p.style.strokeDasharray = `0 ${L}`));
    requestAnimationFrame(() => (fresh.g.style.transition = 'opacity .8s cubic-bezier(.33,1,.68,1)'));
    pattern = PATTERNS[(lap - 1) % PATTERNS.length];
    pulse();
  };

  let prevSector = 0;
  const frame = (now) => {
    if (!running) return;
    const dt = Math.min(0.05, (now - last) / 1000 || 0);
    last = now;
    if (visible) {
      u += dt / LAP_SECONDS;
      if (u >= 1) { u -= 1; nextLap(); prevSector = 0; }
      const d = distAt(u);
      const sector = SECTORS.findIndex((s) => d >= s.from && d < s.to);
      if (sector !== prevSector) { pulse(); prevSector = sector; }
      place(d);
      paint(d);
      for (let i = trail.length - 1; i >= 0; i--) {
        const p = track.getPointAtLength(Math.max(0, d - (i + 1) * 0.006) * L);
        trail[i].setAttribute('cx', p.x); trail[i].setAttribute('cy', p.y);
      }
    }
    requestAnimationFrame(frame);
  };

  shipped.textContent = names[0];

  if (reduced) {
    paint(0.9999);
    place(0);
    trail.forEach((c) => c.setAttribute('opacity', 0));
    return { setCount() {} };
  }

  // build in once at ~30% visible: the track draws itself, labels rise, then the car rolls
  track.style.strokeDasharray = `${L}`;
  track.style.strokeDashoffset = `${L}`;
  [car, ...trail].forEach((c) => c.setAttribute('visibility', 'hidden'));
  labels.forEach((l) => l.classList.add('build'));
  place(0);

  const io = new IntersectionObserver(([en]) => {
    visible = en.isIntersecting;
    if (visible && !built) {
      built = true;
      track.animate([{ strokeDashoffset: L }, { strokeDashoffset: 0 }], { duration: 1500, easing: 'cubic-bezier(.65,0,.35,1)', fill: 'forwards' });
      labels.forEach((l, i) => setTimeout(() => l.classList.add('in'), 500 + i * 90));
      setTimeout(() => {
        [car, ...trail].forEach((c) => c.setAttribute('visibility', 'visible'));
        pulse();
        running = true;
        last = performance.now();
        requestAnimationFrame(frame);
      }, 1500);
    }
  }, { threshold: 0.3 });
  io.observe(root);

  return {};
}
