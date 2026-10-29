// The Portal gun crosshair: blue bracket left, orange right. Grows and turns over anything clickable.
export function createCursor({ isHot }) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const el = document.getElementById('cursor');
  // like the real gun: each bracket fills once its portal is on a wall
  const setPortals = (blue, orange) => { el.classList.toggle('has-blue', blue); el.classList.toggle('has-orange', orange); };
  if (!fine) return { update() {}, setPortals };
  document.body.classList.add('has-cursor');

  let x = -100, y = -100, cx = -100, cy = -100;
  let hot = false;
  let moved = true;
  let overLink = false;
  let onLight = false;

  window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; moved = true; }, { passive: true });
  window.addEventListener('scroll', () => (moved = true), { passive: true });
  window.addEventListener('pointerdown', () => el.classList.add('down'));
  window.addEventListener('pointerup', () => el.classList.remove('down'));
  document.addEventListener('mouseleave', () => (el.style.opacity = '0'));
  document.addEventListener('mouseenter', () => (el.style.opacity = ''));

  return {
    update(nx, ny) {
      cx += (x - cx) * 0.35;
      cy += (y - cy) * 0.35;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      // DOM hit testing only when something under the cursor could have changed
      if (moved) {
        moved = false;
        const target = document.elementFromPoint(x, y);
        overLink = !!target?.closest('a, button, .row');
        onLight = !!target?.closest('.row:hover, .island');
        el.classList.toggle('on-light', onLight);
      }
      const next = overLink || isHot(nx, ny);
      if (next !== hot) { hot = next; el.classList.toggle('hover', hot); }
    },
    setPortals,
  };
}
