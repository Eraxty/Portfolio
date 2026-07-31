import { Github, Instagram, Mail } from 'lucide-react';

function useDraggableCube(setAiMessage, onPortalUse) {
  return (node) => {
    if (!node) return;
    let dragging = false;
    let last = { x: 0, y: 0 };
    let pos = { x: 0, y: 0 };
    let velocity = { x: 0, y: 0 };
    let raf = 0;

    const moveNode = () => {
      pos.x += velocity.x;
      pos.y += velocity.y;
      velocity.x *= 0.88;
      velocity.y *= 0.88;
      node.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotateX(${pos.y * -0.08}deg) rotateY(${pos.x * 0.08}deg)`;
      if (Math.abs(velocity.x) + Math.abs(velocity.y) > 0.1) raf = requestAnimationFrame(moveNode);
    };

    const down = (event) => {
      dragging = true;
      last = { x: event.clientX, y: event.clientY };
      velocity = { x: 0, y: 0 };
      node.setPointerCapture(event.pointerId);
      node.classList.add('is-dragging');
    };
    const move = (event) => {
      if (!dragging) return;
      const dx = event.clientX - last.x;
      const dy = event.clientY - last.y;
      pos.x += dx;
      pos.y += dy;
      velocity = { x: dx, y: dy };
      last = { x: event.clientX, y: event.clientY };
      node.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) rotateX(${pos.y * -0.08}deg) rotateY(${pos.x * 0.08}deg)`;
      const portal = document.elementFromPoint(event.clientX, event.clientY)?.closest?.('[data-portal]');
      if (portal) {
        const other = document.querySelector(portal.dataset.portal === 'orange' ? '[data-portal="blue"]' : '[data-portal="orange"]');
        const rect = other?.getBoundingClientRect();
        const home = node.getBoundingClientRect();
        if (rect) {
          pos.x += rect.left + rect.width / 2 - home.left;
          pos.y += rect.top + rect.height / 2 - home.top;
          velocity.x *= 1.4;
          velocity.y *= 1.4;
          onPortalUse?.(portal.dataset.portal === 'orange' ? 'orange' : 'blue');
          setAiMessage('COMPANION OBJECT DISPLACED. EMOTIONAL ATTACHMENT UNCONFIRMED.');
        }
      }
    };
    const up = (event) => {
      dragging = false;
      node.releasePointerCapture(event.pointerId);
      node.classList.remove('is-dragging');
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(moveNode);
    };

    node.addEventListener('pointerdown', down);
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  };
}

export function Contact({ setAiMessage, onPortalUse }) {
  const cubeRef = useDraggableCube(setAiMessage, onPortalUse);

  return (
    <section id="contact" className="contact-section section-chamber" aria-labelledby="contact-title">
      <div className="section-number mono">04 // FINAL CHAMBER</div>
      <div className="final-grid">
        <div>
          <p className="system-line mono">PRIMARY OCCUPATION: MAKING THINGS</p>
          <h2 id="contact-title">Make Something Weird With Me.</h2>
          <p className="contact-copy">
            Games, web experiments, tools, shaders, impossible little systems. Send a signal.
          </p>
        </div>
        <div className="contact-links" aria-label="Contact links">
          <a href="mailto:hardikrajotiyamars@gmail.com">
            <Mail size={18} /> hardikrajotiyamars@gmail.com
          </a>
          <a href="https://github.com/Eraxty" target="_blank" rel="noreferrer">
            <Github size={18} /> github.com/Eraxty
          </a>
          <a href="https://www.instagram.com/hardik_rajotiya/?hl=en" target="_blank" rel="noreferrer">
            <Instagram size={18} /> @hardik_rajotiya
          </a>
        </div>
      </div>
      <div
        ref={cubeRef}
        className="companion-cube"
        role="button"
        tabIndex={0}
        aria-label="Draggable companion cube easter egg"
      >
        <span />
        <span />
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="final-photo" aria-hidden="true">
        <img src="/images/beach-archive.webp" alt="" />
      </div>
    </section>
  );
}
