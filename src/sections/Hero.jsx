import { ArrowDown } from 'lucide-react';
import { PortalGate } from '../systems/portals/PortalGate.jsx';

export function Hero({ aiMessage, portalUses }) {
  return (
    <section id="index" className="hero-section section-chamber" aria-labelledby="hero-title">
      <div className="hero-meta mono">
        <span>GAME DEV</span>
        <span>CODER</span>
        <span>DESIGNER</span>
        <span>STUDENT</span>
        <span>JEE ASPIRANT, UNFORTUNATELY</span>
      </div>
      <div className="hero-portrait" aria-hidden="true">
        <img src="/images/hat-portrait.webp" alt="" />
      </div>
      <div className="hero-title-wrap">
        <p className="system-line mono">{aiMessage}</p>
        <h1 id="hero-title">
          <span>HARDIK</span>
          <span>RAJOTIYA</span>
        </h1>
      </div>
      <p className="hero-copy">
        I make games, experiments and things computers were probably not expecting to run.
      </p>
      <PortalGate id="orange" color="orange" className="hero-portal">
        <span>ENTRY</span>
        <em>{String(portalUses).padStart(2, '0')}</em>
      </PortalGate>
      <PortalGate id="blue" color="blue" className="hero-portal-exit">
        <span>EXIT</span>
        <em>LIVE</em>
      </PortalGate>
      <a className="scroll-cue" href="#work" aria-label="Scroll to work">
        <ArrowDown size={18} />
        <span>DESCEND</span>
      </a>
    </section>
  );
}
