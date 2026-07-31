import { useEffect, useRef } from 'react';
import { portalStore } from './portalStore.js';

export function PortalGate({ id, color, className = '', children }) {
  const ref = useRef(null);

  const pulse = () => {
    const element = ref.current;
    if (!element) return;
    element.classList.add('is-pulsing');
    window.setTimeout(() => element.classList.remove('is-pulsing'), 520);
    window.dispatchEvent(new CustomEvent('portal-tap', { detail: { id, color } }));
  };

  useEffect(() => {
    const element = ref.current;
    if (!element) return undefined;

    const update = () => portalStore.register(id, element.getBoundingClientRect(), color);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);

    return () => {
      observer.disconnect();
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
      portalStore.unregister(id);
    };
  }, [color, id]);

  return (
    <button
      ref={ref}
      className={`portal-gate portal-${color} ${className}`}
      type="button"
      aria-label={`${color} portal`}
      data-portal={id}
      onClick={pulse}
    >
      <span className="portal-shell" />
      <span className="portal-depth">{children}</span>
      <span className="portal-rim" />
      <span className="portal-sparks" />
    </button>
  );
}
