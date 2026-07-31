import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'hardik-audio-enabled';

export function useAudioSystem() {
  const contextRef = useRef(null);
  const gainRef = useRef(null);
  const ambientSynth = useRef(null);
  const [enabled, setEnabled] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'true'; } catch { return false; }
  });

  const ensureContext = useCallback(() => {
    if (contextRef.current && contextRef.current.state !== 'closed') return contextRef.current;
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return null;
    const ctx = new Ctx();
    contextRef.current = ctx;
    const gain = ctx.createGain();
    gain.gain.value = 0.8;
    gain.connect(ctx.destination);
    gainRef.current = gain;
    return ctx;
  }, []);

  const startAmbientSynth = useCallback((ctx) => {
    if (ambientSynth.current) return;

    const osc1 = ctx.createOscillator();
    osc1.type = 'triangle';
    osc1.frequency.setValueAtTime(55, ctx.currentTime);

    const osc2 = ctx.createOscillator();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(110, ctx.currentTime);

    const osc3 = ctx.createOscillator();
    osc3.type = 'sine';
    osc3.frequency.setValueAtTime(82.5, ctx.currentTime);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(160, ctx.currentTime);
    filter.Q.setValueAtTime(1.2, ctx.currentTime);

    const lfo = ctx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.setValueAtTime(0.12, ctx.currentTime);

    const lfoGain = ctx.createGain();
    lfoGain.gain.setValueAtTime(12, ctx.currentTime);

    const gainNode = ctx.createGain();
    gainNode.gain.setValueAtTime(0.001, ctx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.028, ctx.currentTime + 3);

    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);

    osc1.connect(filter);
    osc2.connect(filter);
    osc3.connect(filter);
    filter.connect(gainNode);
    gainNode.connect(gainRef.current);

    lfo.start();
    osc1.start();
    osc2.start();
    osc3.start();

    ambientSynth.current = {
      osc1, osc2, osc3, lfo, gainNode,
      stop: () => {
        try {
          gainNode.gain.linearRampToValueAtTime(0.001, ctx.currentTime + 1.5);
          window.setTimeout(() => {
            try {
              osc1.stop();
              osc2.stop();
              osc3.stop();
              lfo.stop();
              osc1.disconnect();
              osc2.disconnect();
              osc3.disconnect();
              lfo.disconnect();
              gainNode.disconnect();
            } catch { /* already stopped */ }
            ambientSynth.current = null;
          }, 1600);
        } catch {
          ambientSynth.current = null;
        }
      },
    };
  }, []);

  const stopAmbientSynth = useCallback(() => {
    if (ambientSynth.current) {
      ambientSynth.current.stop();
    }
  }, []);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(enabled)); } catch { /* */ }

    if (!enabled) {
      stopAmbientSynth();
      if (contextRef.current && contextRef.current.state === 'running') {
        contextRef.current.suspend().catch(() => {});
      }
      return;
    }

    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    startAmbientSynth(ctx);
  }, [enabled, ensureContext, startAmbientSynth, stopAmbientSynth]);

  useEffect(() => {
    const handleGesture = () => {
      if (enabled && contextRef.current && contextRef.current.state === 'suspended') {
        contextRef.current.resume().catch(() => {});
      }
    };
    window.addEventListener('click', handleGesture);
    window.addEventListener('pointerdown', handleGesture);
    window.addEventListener('keydown', handleGesture);
    return () => {
      window.removeEventListener('click', handleGesture);
      window.removeEventListener('pointerdown', handleGesture);
      window.removeEventListener('keydown', handleGesture);
    };
  }, [enabled]);

  useEffect(() => {
    return () => {
      stopAmbientSynth();
      if (contextRef.current && contextRef.current.state !== 'closed') {
        contextRef.current.close().catch(() => {});
      }
    };
  }, [stopAmbientSynth]);

  const portalPulse = useCallback((color = 'orange') => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const amp = ctx.createGain();
    osc.type = color === 'blue' ? 'triangle' : 'sine';
    osc.frequency.setValueAtTime(color === 'blue' ? 170 : 92, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(color === 'blue' ? 62 : 140, ctx.currentTime + 0.32);
    filter.type = 'lowpass';
    filter.frequency.value = 520;
    amp.gain.setValueAtTime(0.001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(0.06, ctx.currentTime + 0.03);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.36);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(gainRef.current);
    osc.start();
    osc.stop(ctx.currentTime + 0.38);
  }, [ensureContext]);

  const shortEffect = useCallback((type) => {
    const ctx = ensureContext();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume().catch(() => {});

    const osc = ctx.createOscillator();
    const amp = ctx.createGain();
    const filter = ctx.createBiquadFilter();
    osc.type = type === 'anomaly' ? 'sawtooth' : 'triangle';
    osc.frequency.value = type === 'anomaly' ? 54 : 96;
    filter.type = type === 'anomaly' ? 'bandpass' : 'lowpass';
    filter.frequency.value = type === 'anomaly' ? 420 : 190;
    amp.gain.setValueAtTime(0.001, ctx.currentTime);
    amp.gain.exponentialRampToValueAtTime(type === 'anomaly' ? 0.05 : 0.035, ctx.currentTime + 0.02);
    amp.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + (type === 'anomaly' ? 0.7 : 0.24));
    osc.frequency.exponentialRampToValueAtTime(type === 'anomaly' ? 22 : 52, ctx.currentTime + 0.28);
    osc.connect(filter);
    filter.connect(amp);
    amp.connect(gainRef.current);
    osc.start();
    osc.stop(ctx.currentTime + (type === 'anomaly' ? 0.72 : 0.26));
  }, [ensureContext]);

  return {
    enabled,
    setEnabled,
    hasFile: false,
    portalPulse,
    cubeHit: () => shortEffect('cube'),
    anomaly: () => shortEffect('anomaly'),
  };
}
