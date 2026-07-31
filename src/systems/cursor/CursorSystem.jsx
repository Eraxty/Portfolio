import { useEffect, useRef, useState } from 'react';
import { portalStore } from '../portals/portalStore.js';

const isFinePointer = () => window.matchMedia('(hover: hover) and (pointer: fine)').matches;

function pointInPortal(point, portal) {
  const { rect } = portal;
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const rx = rect.width * 0.42;
  const ry = rect.height * 0.42;
  const nx = (point.x - cx) / rx;
  const ny = (point.y - cy) / ry;
  return nx * nx + ny * ny < 1;
}

function mapPortalPoint(point, from, to) {
  const fromCenter = {
    x: from.rect.left + from.rect.width / 2,
    y: from.rect.top + from.rect.height / 2,
  };
  const toCenter = {
    x: to.rect.left + to.rect.width / 2,
    y: to.rect.top + to.rect.height / 2,
  };
  const rel = {
    x: (point.x - fromCenter.x) / from.rect.width,
    y: (point.y - fromCenter.y) / from.rect.height,
  };
  return {
    x: toCenter.x + rel.x * to.rect.width,
    y: toCenter.y + rel.y * to.rect.height,
  };
}

export function CursorSystem({ onPortalUse }) {
  const visual = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const real = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const velocity = useRef({ x: 0, y: 0 });
  const offset = useRef({ x: 0, y: 0 });
  const portals = useRef(new Map());
  const cooldown = useRef(0);
  const raf = useRef(0);
  const node = useRef(null);
  const [active, setActive] = useState(false);
  const [state, setState] = useState('idle');

  useEffect(() => {
    if (!isFinePointer()) return undefined;
    setActive(true);
    document.documentElement.classList.add('has-custom-cursor');
    const unsubscribe = portalStore.subscribe((next) => {
      portals.current = new Map(next);
    });

    const move = (event) => {
      const last = real.current;
      real.current = { x: event.clientX, y: event.clientY };
      velocity.current = {
        x: event.clientX - last.x,
        y: event.clientY - last.y,
      };
    };

    const down = (event) => {
      const dx = visual.current.x - real.current.x;
      const dy = visual.current.y - real.current.y;
      if (Math.hypot(dx, dy) < 32) return;
      const target = document.elementFromPoint(visual.current.x, visual.current.y);
      const clickable = target?.closest?.('a,button,[role="button"],input,textarea,select');
      if (clickable) {
        event.preventDefault();
        clickable.focus?.();
        clickable.click?.();
      }
    };

    const reset = (event) => {
      if (event.key === 'Escape') {
        offset.current = { x: 0, y: 0 };
        setState('idle');
      }
    };

    window.addEventListener('pointermove', move, { passive: true });
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', reset);

    const tick = (now) => {
      const target = {
        x: real.current.x + offset.current.x,
        y: real.current.y + offset.current.y,
      };
      visual.current.x += (target.x - visual.current.x) * 0.34;
      visual.current.y += (target.y - visual.current.y) * 0.34;

      if (now > cooldown.current) {
        const list = [...portals.current.values()];
        const currentPortal = list.find((portal) => pointInPortal(visual.current, portal));
        if (currentPortal && list.length > 1) {
          const destination = list.find((portal) => portal.id !== currentPortal.id);
          if (destination) {
            const mapped = mapPortalPoint(visual.current, currentPortal, destination);
            const projected = {
              x: mapped.x + velocity.current.x * 5.2,
              y: mapped.y + velocity.current.y * 5.2,
            };
            offset.current = {
              x: projected.x - real.current.x,
              y: projected.y - real.current.y,
            };
            visual.current = mapPortalPoint(visual.current, currentPortal, destination);
            cooldown.current = now + 720;
            setState(currentPortal.color);
            document.documentElement.dataset.portalEvent = String(now);
            onPortalUse?.(currentPortal.color);
          }
        }
      }

      offset.current.x *= 0.996;
      offset.current.y *= 0.996;

      if (node.current) {
        node.current.style.transform = `translate3d(${visual.current.x}px, ${visual.current.y}px, 0)`;
        node.current.style.setProperty('--speed', String(Math.min(1, Math.hypot(velocity.current.x, velocity.current.y) / 34)));
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', reset);
      document.documentElement.classList.remove('has-custom-cursor');
      unsubscribe();
    };
  }, [onPortalUse]);

  if (!active) return null;

  return (
    <div ref={node} className={`custom-cursor cursor-${state}`} aria-hidden="true">
      <span />
    </div>
  );
}
