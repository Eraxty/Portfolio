import gsap from 'gsap';

// F1 start sequence. Each light is a real fifth of the load. When all five are lit the hold is random,
// exactly like a real start, then lights out.
export function createLoader(sound) {
  const el = document.getElementById('loader');
  const units = [...el.querySelectorAll('.light-unit')];
  const pct = el.querySelector('.loader-pct');
  const status = el.querySelector('.loader-status');
  let shown = 0;
  let target = 0;
  let lit = 0;
  let raf;

  const tick = () => {
    shown += (target - shown) * 0.12;
    if (target - shown < 0.002) shown = target;
    pct.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    const want = Math.min(5, Math.floor(shown * 5 + 0.001));
    while (lit < want) {
      units[lit].classList.add('on');
      sound.beep(lit < 4 ? 880 : 880, 0.12);
      lit++;
    }
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);

  return {
    progress(p) { target = Math.max(target, Math.min(1, p)); },
    async finish({ reduced }) {
      target = 1;
      await new Promise((r) => {
        const wait = () => (lit >= 5 && shown >= 0.999 ? r() : setTimeout(wait, 30));
        wait();
      });
      cancelAnimationFrame(raf);
      if (!reduced) await new Promise((r) => setTimeout(r, 500 + Math.random() * 1500));
      units.forEach((u) => u.classList.remove('on'));
      status.textContent = 'Lights out';
      sound.beep(1320, 0.25);
      await gsap.to(el, { yPercent: -100, duration: reduced ? 0.01 : 1.05, ease: 'expo.inOut', delay: reduced ? 0 : 0.35 });
      el.remove();
    },
  };
}
