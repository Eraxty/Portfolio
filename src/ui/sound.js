// Tiny Web Audio kit. Off by default; one switch in the header.
export function createSound() {
  let ctx = null;
  let master = null;
  let on = false;
  try { on = localStorage.getItem('eraxty:sound') === '1'; } catch { /* storage blocked */ }

  const ensure = () => {
    if (!ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.18;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  };

  const api = {
    get on() { return on; },
    set(v) {
      on = v;
      try { localStorage.setItem('eraxty:sound', v ? '1' : '0'); } catch { /* ignore */ }
      if (v) ensure();
    },
    beep(freq = 880, dur = 0.1, type = 'square', gain = 0.5) {
      if (!on || !ensure() || ctx.state !== 'running') return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(gain, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + dur + 0.02);
    },
    tick() { api.beep(2400, 0.025, 'square', 0.12); },
    thud() {
      if (!on || !ensure()) return;
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(140, ctx.currentTime);
      o.frequency.exponentialRampToValueAtTime(42, ctx.currentTime + 0.25);
      g.gain.setValueAtTime(0.9, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.3);
      o.connect(g).connect(master);
      o.start();
      o.stop(ctx.currentTime + 0.32);
    },
    whoosh(up = true) {
      if (!on || !ensure()) return;
      const len = 0.5;
      const buf = ctx.createBuffer(1, ctx.sampleRate * len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      const f = ctx.createBiquadFilter();
      f.type = 'bandpass';
      f.Q.value = 1.4;
      f.frequency.setValueAtTime(up ? 300 : 1800, ctx.currentTime);
      f.frequency.exponentialRampToValueAtTime(up ? 2200 : 260, ctx.currentTime + len);
      const g = ctx.createGain();
      g.gain.value = 0.7;
      src.connect(f).connect(g).connect(master);
      src.start();
    },
  };
  return api;
}
