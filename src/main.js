import './styles.css';
import gsap from 'gsap';
import Lenis from 'lenis';
import { World } from './scene/World.js';
import { createLoader } from './ui/loader.js';
import { createSound } from './ui/sound.js';
import { createCursor } from './ui/cursor.js';
import { renderTower } from './ui/timing.js';
import { createWordLight } from './ui/words.js';
import { createLap } from './ui/lap.js';
import { loadRepos, projects } from './data.js';

const params = new URLSearchParams(location.search);
const reduced = params.get('motion') === 'off' || window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const mobile = window.matchMedia('(max-width: 900px), (pointer: coarse)').matches;
const $ = (s) => document.querySelector(s);

document.body.classList.add('is-loading');
const sound = createSound();
const loader = createLoader(sound);

// ───────── subtitles (original lines, Portal-style captions) ─────────
const sub = $('.subtitle');
let subTimer;
const said = new Set();
function say(who, line, { once = true, ms = 3800 } = {}) {
  const key = who + line;
  if (once && said.has(key)) return;
  said.add(key);
  sub.innerHTML = '';
  const b = document.createElement('b');
  b.textContent = who;
  sub.append(b, document.createTextNode(line));
  sub.classList.add('show');
  clearTimeout(subTimer);
  subTimer = setTimeout(() => sub.classList.remove('show'), ms);
}

// ───────── header bits ─────────
const clock = $('.clock time');
const fmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Kolkata' });
const setClock = () => (clock.textContent = fmt.format(new Date()));
setClock();
setInterval(setClock, 15000);

const soundBtn = $('.sound-toggle');
const syncSound = () => {
  soundBtn.setAttribute('aria-pressed', String(sound.on));
  soundBtn.querySelector('span').textContent = sound.on ? 'on' : 'off';
};
syncSound();
soundBtn.addEventListener('click', () => { sound.set(!sound.on); syncSound(); sound.tick(); });

// ───────── smooth scroll ─────────
const lenis = new Lenis({ lerp: reduced ? 1 : 0.085, wheelMultiplier: 0.95, smoothWheel: !reduced });
lenis.stop();
document.querySelectorAll('a[href^="#"]').forEach((a) => {
  a.addEventListener('click', (e) => {
    const id = a.getAttribute('href');
    const target = id === '#hero' ? 0 : $(id);
    if (target === null) return;
    e.preventDefault();
    lenis.scrollTo(target, { duration: reduced ? 0 : 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
  });
});

// ───────── statement, reveals, nav ─────────
const words = createWordLight($('[data-words]'));
const sections = {
  hero: $('#hero'), statement: $('#statement'), work: $('#work'), lab: $('#lab'), subject: $('#subject'), contact: $('#contact'),
};

const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); revealIO.unobserve(en.target); }
  });
}, { threshold: 0.2, rootMargin: '0px 0px -8% 0px' });
document.querySelectorAll('.reveal').forEach((n) => revealIO.observe(n));

const navLinks = [...document.querySelectorAll('.nav a')];
const navIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (!en.isIntersecting) return;
    const id = en.target.id;
    navLinks.forEach((a) => a.classList.toggle('active', a.getAttribute('href') === `#${id}`));
    if (id === 'work') setTimeout(() => say('Wheatley', 'These are all his. The one on top has a hundred and ten stars. A hundred and ten!'), 900);
    if (id === 'subject') {
      say('GLaDOS', 'Oh. A visitor. Keep scrolling. The test results will not read themselves.');
      setTimeout(() => say('Wheatley', "I'll just wait over here. Out of frame. No reason."), 4300);
    }
  });
}, { threshold: 0.35 });
Object.values(sections).forEach((s) => navIO.observe(s));

// ───────── data ─────────
const repoPromise = loadRepos().then(({ repos, total }) => {
  renderTower(repos, { sound });
  document.querySelectorAll('.repo-count').forEach((n) => (n.textContent = total));
  return repos;
});

// ───────── world ─────────
const canvas = $('#gl');
let world;
try {
  world = new World(canvas, { reduced, mobile });
} catch (err) {
  console.warn('WebGL unavailable, running without the 3D layer', err?.message, err?.stack);
}
if (import.meta.env.DEV) window.__world = world;

const pointer = { x: 0, y: 0, px: 0, py: 0, speed: 0, lastT: performance.now() };
const speedEl = $('.speed b');

window.addEventListener('pointermove', (e) => {
  const now = performance.now();
  const dt = Math.max(1, now - pointer.lastT);
  const dist = Math.hypot(e.clientX - pointer.px, e.clientY - pointer.py);
  pointer.speed = pointer.speed * 0.7 + (dist / dt) * 1000 * 0.3;
  pointer.px = e.clientX; pointer.py = e.clientY; pointer.lastT = now;
  pointer.x = (e.clientX / innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / innerHeight) * 2 + 1;
  world?.setPointer(pointer.x, pointer.y);
}, { passive: true });

// phones: Wheatley follows touches, and the tilt of the phone when allowed
window.addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  world?.setPointer((t.clientX / innerWidth) * 2 - 1, -(t.clientY / innerHeight) * 2 + 1);
}, { passive: true });

const pokes = [
  'Oh! Hello. Yes, that is my eye.',
  'Still my eye.',
  "Right. I'm going to pretend that didn't happen.",
  'Have you tried scrolling? Loads of good stuff down there.',
  'Okay. Okay. I am choosing to find this flattering.',
];
let pokeN = 0;
window.addEventListener('click', (e) => {
  if (!world || e.target.closest('a, button')) return;
  world.click((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
});
world?.on('wheatley-poke', () => {
  say('Wheatley', pokes[Math.min(pokeN, pokes.length - 1)], { once: false, ms: 2800 });
  pokeN++;
  sound.beep(520, 0.08, 'triangle', 0.4);
});
world?.on('cube-land', (loops) => {
  sound.thud();
  if (loops > 2) say('Wheatley', `${loops} laps through the portals and not a scratch. Good cube.`, { once: false });
  else say('Wheatley', 'Button pressed. In my experience that opens something. Probably the email.');
  $('.mail').animate([{ color: '#ff7a1a' }, { color: '' }], { duration: 1600, easing: 'ease-out' });
});
world?.on('cube-click', (state) => {
  sound.whoosh(state === 'looping');
  if (state === 'looping') say('Wheatley', 'Ooh, infinite fall. Click it again to stop. Probably.');
});

const cursor = createCursor({
  isHot: (() => {
    let n = 0, last = false;
    return (nx, ny) => {
      if (!world || n++ % 6) return last;
      last = world.hoverTarget(nx, ny);
      return last;
    };
  })(),
});

// measure section positions for the camera rig, and keep them fresh
const measure = () => world?.measure(sections);
const onResize = () => { world?.resize(); measure(); };
window.addEventListener('resize', onResize);
new ResizeObserver(() => measure()).observe(document.querySelector('main'));

// ───────── frame loop ─────────
const flash = $('.portal-flash');
let lastScroll = 0;
let t0 = performance.now();
let crossed = false;

gsap.ticker.lagSmoothing(0);
gsap.ticker.add((time) => {
  lenis.raf(time * 1000);
  const now = performance.now();
  const dt = Math.min(0.05, (now - t0) / 1000);
  t0 = now;
  const y = lenis.scroll;
  const vel = (y - lastScroll) / Math.max(dt, 1e-3);
  lastScroll = y;

  // statement words light over the first part of its sticky run
  const st = sections.statement;
  const p = (y - (st.offsetTop - innerHeight * 0.35)) / ((st.offsetHeight - innerHeight) * 0.6);
  words.set(Math.min(1, Math.max(0, p)));

  pointer.speed *= 0.94;
  const speed01 = Math.min(pointer.speed / 4000, 1);
  speedEl.textContent = String(Math.min(999, Math.round(pointer.speed * 0.09))).padStart(3, '0');

  if (world) {
    world.update(dt, now / 1000, y, vel, speed01);
    // DOM flash in sync with the portal transit
    flash.style.opacity = (world.transit * 0.9).toFixed(3);
    flash.style.setProperty('--flash', y > world.portalAt ? '#ff7a1a' : '#2f9bff');
    if (!crossed && y > world.portalAt) { crossed = true; sound.whoosh(false); }
    if (crossed && y < world.portalAt - 10) crossed = false;
  }
  cursor.update(pointer.x, pointer.y);
});

// ───────── boot ─────────
(async () => {
  try {
    if (world) {
      await world.load((p) => loader.progress(p * 0.9));
      onResize();
    }
    await document.fonts.ready;
    const repos = await repoPromise;
    createLap($('#lab'), { reduced, names: repos.filter((r) => projects[r.id]).map((r) => r.name) });
    loader.progress(1);
  } catch (err) {
    console.error(err);
    loader.progress(1);
  }
  measure();
  await loader.finish({ reduced });
  document.body.classList.remove('is-loading');
  lenis.start();
  window.scrollTo(0, 0);
  window.__ready = true;
  setTimeout(() => { if (lenis.scroll < 40) say('Wheatley', 'Hello? Oh, hello! Move that thing about a bit. I can see it.', { ms: 4200 }); }, 2600);
})();
