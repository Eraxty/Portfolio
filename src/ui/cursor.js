// The Portal gun crosshair: blue bracket left, orange right. Grows and turns over anything clickable.
export function createCursor({ isHot }) {
  const fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const el = document.getElementById('cursor');
  if (!fine) return { update() {} };
  document.body.classList.add('has-cursor');

  let x = -100, y = -100, cx = -100, cy = -100;
  let hot = false;

  window.addEventListener('pointermove', (e) => { x = e.clientX; y = e.clientY; }, { passive: true });
  window.addEventListener('pointerdown', () => el.classList.add('down'));
  window.addEventListener('pointerup', () => el.classList.remove('down'));
  document.addEventListener('mouseleave', () => (el.style.opacity = '0'));
  document.addEventListener('mouseenter', () => (el.style.opacity = ''));

  return {
    update(nx, ny) {
      cx += (x - cx) * 0.35;
      cy += (y - cy) * 0.35;
      el.style.transform = `translate3d(${cx}px, ${cy}px, 0)`;
      const target = document.elementFromPoint(x, y);
      const overLink = !!target?.closest('a, button, .row');
      const over3d = !overLink && isHot(nx, ny);
      const next = overLink || over3d;
      if (next !== hot) { hot = next; el.classList.toggle('hover', hot); }
      el.classList.toggle('on-light', !!target?.closest('.row:hover, .island'));
    },
  };
}
