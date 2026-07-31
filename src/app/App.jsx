import Lenis from 'lenis';
import { Volume2, VolumeX } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { Navigation } from '../components/Navigation.jsx';
import { LoadingScreen } from '../components/LoadingScreen.jsx';
import { About } from '../sections/About.jsx';
import { Contact } from '../sections/Contact.jsx';
import { Hero } from '../sections/Hero.jsx';
import { Projects } from '../sections/Projects.jsx';
import { useReducedMotion } from '../hooks/useReducedMotion.js';
import { useAudioSystem } from '../systems/audio/useAudioSystem.js';
import { CursorSystem } from '../systems/cursor/CursorSystem.jsx';
import { ChamberScene } from '../three/ChamberScene.jsx';
import { cursorStore } from '../systems/cursor/cursorStore.js';

export default function App() {
  const reducedMotion = useReducedMotion();
  const audio = useAudioSystem();
  const [ready, setReady] = useState(false);
  const [aiMessage, setAiMessage] = useState('SUBJECT IDENTIFIED: HARDIK RAJOTIYA');
  const [portalUses, setPortalUses] = useState(0);
  const [portalFlash, setPortalFlash] = useState(null);
  const [anomalyActive, setAnomalyActive] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 480);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const lenis = new Lenis({
      duration: 1.2,
      easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      smoothWheel: true,
      wheelMultiplier: 0.92,
    });
    let rafId = 0;
    const raf = (time) => {
      lenis.raf(time);
      rafId = requestAnimationFrame(raf);
    };
    rafId = requestAnimationFrame(raf);
    return () => {
      cancelAnimationFrame(rafId);
      lenis.destroy();
    };
  }, [reducedMotion]);

  const handlePortalUse = useCallback((color) => {
    audio.portalPulse(color);
    setPortalFlash({ color, id: performance.now() });
    setPortalUses((count) => {
      const next = count + 1;
      if (next === 3) setAiMessage('PORTAL MISUSE DETECTED. CONTINUE.');
      if (next === 7) setAiMessage('SUBJECT SHOWS POOR RESPECT FOR EUCLIDEAN SPACE.');
      if (next === 12) setAiMessage('JEE PREPARATION TEMPORARILY PAUSED.');
      return next;
    });
  }, [audio]);

  useEffect(() => {
    if (!portalFlash) return undefined;
    const timer = window.setTimeout(() => setPortalFlash(null), 520);
    return () => window.clearTimeout(timer);
  }, [portalFlash]);

  useEffect(() => {
    const transition = (event) => {
      const color = event.detail?.color || 'orange';
      cursorStore.portalEvent = {
        source: event.detail?.source,
        destination: event.detail?.destination,
        color,
        at: performance.now(),
      };
      handlePortalUse(color);

      const target = event.detail?.target;
      if (!target) return;
      const targetElement = document.querySelector(target);
      if (!targetElement) return;

      window.setTimeout(() => {
        targetElement.scrollIntoView({
          behavior: reducedMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      }, reducedMotion ? 0 : 170);
    };
    window.addEventListener('portal-transition', transition);
    return () => window.removeEventListener('portal-transition', transition);
  }, [handlePortalUse, reducedMotion]);

  useEffect(() => {
    const message = (event) => setAiMessage(event.detail);
    const impact = () => audio.cubeHit();
    window.addEventListener('ai-message', message);
    window.addEventListener('cube-impact', impact);
    return () => {
      window.removeEventListener('ai-message', message);
      window.removeEventListener('cube-impact', impact);
    };
  }, [audio]);

  const triggerAnomaly = useCallback(() => {
    if (anomalyActive) return;
    setAnomalyActive(true);
    cursorStore.anomalyActive = true;
    audio.anomaly();
    setAiMessage('ANOMALY FILE OPENED. THIS WAS PROBABLY A CHOICE.');
    window.setTimeout(() => {
      setAnomalyActive(false);
      cursorStore.anomalyActive = false;
    }, 3300);
  }, [anomalyActive, audio]);

  return (
    <>
      <LoadingScreen ready={ready} />
      <ChamberScene reducedMotion={reducedMotion} />
      <Navigation />
      <CursorSystem />
      <main id="content" className={`site-shell ${anomalyActive ? 'anomaly-active' : ''}`}>
        <Hero aiMessage={aiMessage} />
        <Projects />
        <About onAnomaly={triggerAnomaly} />
        <Contact />
      </main>
      <div className={`anomaly-sequence ${anomalyActive ? 'is-active' : ''}`} aria-hidden="true">
        <div className="anomaly-frame">
          <img src="/images/anomaly.webp" alt="" />
          <span className="mono">ANOMALY // TEMPORARY</span>
        </div>
      </div>
      <div className={`portal-flash ${portalFlash ? 'is-visible' : ''} flash-${portalFlash?.color || 'orange'}`} aria-hidden="true">
        <span>SPACE FOLDED</span>
      </div>
      <button
        className="audio-toggle"
        type="button"
        onClick={() => audio.setEnabled((value) => !value)}
        aria-pressed={audio.enabled}
        aria-label={audio.enabled ? 'Mute ambient audio' : 'Enable ambient audio'}
      >
        {audio.enabled ? <Volume2 size={17} /> : <VolumeX size={17} />}
        <span>{audio.enabled ? 'SOUND' : 'SILENT'}</span>
      </button>
      <div className="coordinate-readout" aria-hidden="true">
        HR//{String(portalUses).padStart(2, '0')}
      </div>
    </>
  );
}
