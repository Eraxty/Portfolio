import { Github, Instagram, Mail } from 'lucide-react';
import { PortalGate } from '../systems/portals/PortalGate.jsx';

export function Contact() {
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
      <div className="final-photo" aria-hidden="true">
        <img src="/images/beach-archive.webp" alt="" />
      </div>
      <PortalGate id="contact-orange" color="orange" target="#index" className="section-portal contact-portal" />
    </section>
  );
}
