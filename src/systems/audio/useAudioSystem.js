import { useCallback, useEffect, useRef, useState } from 'react';

const STORAGE_KEY = 'hardik-audio-enabled';

export function useAudioSystem() {
  const audioRef = useRef(null);
  const contextRef = useRef(null);
  const gainRef = useRef(null);
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) === 'true');
  const [hasFile, setHasFile] = useState(true);

  useEffect(() => {
    const audio = new Audio('/audio/ambient.mp3');
    audio.loop = true;
    audio.preload = 'metadata';
    audio.volume = 0;
    audio.addEventListener('error', () => setHasFile(false));
    audioRef.current = audio;
    return () => {
      audio.pause();
      audio.src = '';
    };
  }, []);

  const fade = useCallback((target) => {
    const audio = audioRef.current;
    if (!audio || !hasFile) return;
    const start = audio.volume;
    const startedAt = performance.now();
    const duration = 900;

    const tick = (now) => {
      const t = Math.min(1, (now - startedAt) / duration);
      audio.volume = start + (target - start) * (1 - Math.pow(1 - t, 3));
      if (t < 1) requestAnimationFrame(tick);
      else if (target === 0) audio.pause();
    };
    requestAnimationFrame(tick);
  }, [hasFile]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(enabled));
    const audio = audioRef.current;
    if (!audio || !hasFile) return;
    if (enabled) {
      audio.play().then(() => fade(0.22)).catch(() => setEnabled(false));
    } else {
      fade(0);
    }
  }, [enabled, fade, hasFile]);

  const portalPulse = useCallback((color = 'orange') => {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!contextRef.current) {
      contextRef.current = new Ctx();
      gainRef.current = contextRef.current.createGain();
      gainRef.current.gain.value = 0.04;
      gainRef.current.connect(contextRef.current.destination);
    }

    const ctx = contextRef.current;
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
  }, []);

  return { enabled, setEnabled, hasFile, portalPulse };
}
