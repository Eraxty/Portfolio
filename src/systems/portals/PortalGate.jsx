import { useEffect, useRef } from 'react';
import { portalStore } from './portalStore.js';

function portalCenter(rect) {
  return {
    x: rect.left + rect.width / 2,
    y: rect.top + rect.height / 2,
  };
}

export function PortalGate({ id, color, target = null, className = '' }) {
  const ref = useRef(null);
  const frame = useRef(0);

  const pulse = () => {
    const element = ref.current;
    if (!element) return;
    element.classList.add('is-pulsing');
    window.setTimeout(() => element.classList.remove('is-pulsing'), 520);
    portalStore.requestTransition(id, { force: true, point: portalCenter(element.getBoundingClientRect()) });
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => {
      window.cancelAnimationFrame(frame.current);
      frame.current = window.requestAnimationFrame(() => {
        portalStore.register(id, element.getBoundingClientRect(), color, element, target);
      });
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    const move = (event) => {
      const rect = element.getBoundingClientRect();
      const center = portalCenter(rect);
      const dx = (event.clientX - center.x) / Math.max(1, rect.width * 0.5);
      const dy = (event.clientY - center.y) / Math.max(1, rect.height * 0.5);
      const proximity = Math.max(0, 1 - Math.sqrt(dx * dx + dy * dy));
      element.style.setProperty('--proximity', proximity.toFixed(3));
      element.style.setProperty('--tilt-x', `${THREE_CLAMP(-dy * 8, -7, 7).toFixed(2)}deg`);
      element.style.setProperty('--tilt-y', `${THREE_CLAMP(dx * 10, -9, 9).toFixed(2)}deg`);
    };
    const leave = () => {
      element.style.setProperty('--proximity', '0');
      element.style.setProperty('--tilt-x', '0deg');
      element.style.setProperty('--tilt-y', '0deg');
    };
    const react = (event) => {
      const mode = event.detail?.source === id ? 'is-entering' : event.detail?.destination === id ? 'is-exiting' : '';
      if (!mode) return;
      element.classList.add(mode);
      window.setTimeout(() => element.classList.remove(mode), 700);
    };
    element.addEventListener('pointermove', move, { passive: true });
    element.addEventListener('pointerleave', leave);
    window.addEventListener('portal-transition', react);

    return () => {
      window.cancelAnimationFrame(frame.current);
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      element.removeEventListener('pointermove', move);
      element.removeEventListener('pointerleave', leave);
      window.removeEventListener('portal-transition', react);
      portalStore.unregister(id);
    };
  }, [color, id, target]);

  const portalImage = color === 'blue' ? '/images/portal-1.png' : '/images/portal-2.png';

  return (
    <button
      ref={ref}
      className={`portal-gate portal-${color} ${className}`}
      type="button"
      aria-label={`${color} portal`}
      data-portal={id}
      data-portal-target={target || undefined}
      onClick={pulse}
    >
      <img src={portalImage} alt="" className="portal-image" />
    </button>
  );
}

function THREE_CLAMP(value, min, max) {
  return Math.min(max, Math.max(min, value));
}
