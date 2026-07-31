import { useEffect, useRef } from 'react';
import { cursorStore } from './cursorStore.js';
import { portalStore } from '../portals/portalStore.js';

function isPortalVisible(portal) {
  if (!portal || !portal.rect) return false;
  const { rect } = portal;
  return (
    rect.bottom > -60 &&
    rect.top < window.innerHeight + 60 &&
    rect.right > -60 &&
    rect.left < window.innerWidth + 60
  );
}

function portalCenter(portal) {
  return {
    x: portal.rect.left + portal.rect.width / 2,
    y: portal.rect.top + portal.rect.height / 2,
  };
}

function portalDistance(point, portal) {
  const { rect } = portal;
  const center = portalCenter(portal);
  const rx = rect.width * 0.39;
  const ry = rect.height * 0.43;
  const nx = (point.x - center.x) / rx;
  const ny = (point.y - center.y) / ry;
  return Math.sqrt(nx * nx + ny * ny);
}

function pointInPortal(point, portal) {
  return portalDistance(point, portal) < 1;
}

function portalState(point, list) {
  let nearest = null;
  let distance = Infinity;
  for (const portal of list) {
    const nextDistance = portalDistance(point, portal);
    if (nextDistance < distance) {
      nearest = portal;
      distance = nextDistance;
    }
  }
  return { nearest, distance };
}

export function CursorSystem() {
  const pointer = useRef({ x: window.innerWidth / 2, y: window.innerHeight / 2 });
  const velocity = useRef({ x: 0, y: 0 });
  const portals = useRef(new Map());
  const cooldown = useRef(0);
  const raf = useRef(0);

  useEffect(() => {
    const unsubscribe = portalStore.subscribe((next) => {
      portals.current = new Map(next);
    });

    const move = (event) => {
      velocity.current.x = event.clientX - pointer.current.x;
      velocity.current.y = event.clientY - pointer.current.y;
      pointer.current.x = event.clientX;
      pointer.current.y = event.clientY;
      cursorStore.screen.x = event.clientX / window.innerWidth;
      cursorStore.screen.y = event.clientY / window.innerHeight;
      cursorStore.velocity.x = velocity.current.x;
      cursorStore.velocity.y = velocity.current.y;
      cursorStore.pointer.x = event.clientX;
      cursorStore.pointer.y = event.clientY;
    };

    window.addEventListener('pointermove', move, { passive: true });

    const tick = (now) => {
      cursorStore.world.x = (pointer.current.x / window.innerWidth) * 2 - 1;
      cursorStore.world.y = -(pointer.current.y / window.innerHeight) * 2 + 1;

      const list = [...portals.current.values()].filter(isPortalVisible);
      const { nearest, distance } = portalState(pointer.current, list);
      cursorStore.portalProximity = Math.max(0, 1 - distance);
      cursorStore.portalHover = distance < 1.12 ? nearest?.color || null : null;

      if (now > cooldown.current) {
        const currentPortal = list.find((portal) => pointInPortal(pointer.current, portal));
        const speed = Math.hypot(velocity.current.x, velocity.current.y);
        if (currentPortal && list.length > 1 && speed > 0.7) {
          const transitioned = portalStore.requestTransition(currentPortal.id, {
            point: { ...pointer.current },
          });
          if (transitioned) {
            cursorStore.portalEvent = { source: currentPortal.id, color: currentPortal.color, at: now };
            cooldown.current = now + 900;
          }
        }
      }

      velocity.current.x *= 0.86;
      velocity.current.y *= 0.86;
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf.current);
      window.removeEventListener('pointermove', move);
      unsubscribe();
    };
  }, []);

  return null;
}
