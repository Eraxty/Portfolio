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

export default function App() {
  const reducedMotion = useReducedMotion();
  const audio = useAudioSystem();
  const [ready, setReady] = useState(false);
  const [aiMessage, setAiMessage] = useState('SUBJECT IDENTIFIED: HARDIK RAJOTIYA');
  const [portalUses, setPortalUses] = useState(0);
  const [portalFlash, setPortalFlash] = useState(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setReady(true), 480);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (reducedMotion) return undefined;
    const lenis = new Lenis({
      duration: 1.05,
      easing: (t) => 1 - Math.pow(1 - t, 3),
      smoothWheel: true,
      wheelMultiplier: 0.86,
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
    const tapped = (event) => handlePortalUse(event.detail?.color || 'orange');
    window.addEventListener('portal-tap', tapped);
    return () => window.removeEventListener('portal-tap', tapped);
  }, [handlePortalUse]);

  return (
    <>
      <LoadingScreen ready={ready} />
      <ChamberScene reducedMotion={reducedMotion} />
      <Navigation />
      <CursorSystem onPortalUse={handlePortalUse} />
      <main id="content" className="site-shell">
        <Hero aiMessage={aiMessage} portalUses={portalUses} />
        <Projects />
        <About />
        <Contact setAiMessage={setAiMessage} onPortalUse={handlePortalUse} />
      </main>
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
        <span>{audio.hasFile ? 'AUDIO' : 'SILENT'}</span>
      </button>
      <div className="coordinate-readout" aria-hidden="true">
        HR//{String(portalUses).padStart(2, '0')}
      </div>
    </>
  );
}
