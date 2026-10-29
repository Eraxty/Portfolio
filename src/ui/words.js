// Splits a sentence into words and lights them one by one as the sticky section scrolls.
export function createWordLight(el) {
  const walk = (node) => {
    [...node.childNodes].forEach((n) => {
      if (n.nodeType === 3) {
        const frag = document.createDocumentFragment();
        n.textContent.split(/(\s+)/).forEach((part) => {
          if (!part) return;
          if (/^\s+$/.test(part)) frag.append(part);
          else {
            const s = document.createElement('span');
            s.className = 'w';
            s.textContent = part;
            frag.append(s);
          }
        });
        n.replaceWith(frag);
      } else walk(n);
    });
  };
  walk(el);
  const words = [...el.querySelectorAll('.w')];
  let last = -1;
  return {
    set(p) {
      const n = Math.round(p * words.length);
      if (n === last) return;
      last = n;
      words.forEach((w, i) => w.classList.toggle('lit', i < n));
    },
  };
}
