/**
 * Sitewide scroll parallax for `[data-parallax="<speed>"]`.
 * Uses the CSS `translate` property so it composes with reveal `transform`s.
 * Also auto-tags common layout nodes so depth shows up without hand-wiring every block.
 */

const AUTO: Array<[string, number]> = [
  ['.section-head:not([data-parallax])', 0.2],
  ['.section-title:not([data-parallax])', 0.16],
  ['.section-lede:not([data-parallax])', 0.12],
  ['.eyebrow:not([data-parallax])', 0.18],
  ['.job:not([data-parallax])', 0.16],
  ['.card .body:not([data-parallax])', 0.14],
  ['.page-hero-inner:not([data-parallax])', 0.22],
  ['.filters:not([data-parallax])', 0.14],
  ['.aside:not([data-parallax])', 0.24],
  ['.prose > *', 0.12],
  ['.specs > div', 0.14],
  ['.btn-row', 0.12],
  ['.badges', 0.14],
  ['.site-footer .cols', 0.16],
  ['.site-footer .about', 0.12],
  ['.gallery-grid > figure', 0.22],
  ['.ww-demos, .rv-demos, .pi-demos, .mis-demos', 0.18],
  ['.listing .grid > *', 0.16],
  ['.crumbs', 0.1],
];

function autoTag(root: ParentNode): void {
  for (const [selector, speed] of AUTO) {
    for (const node of root.querySelectorAll(selector)) {
      if (!(node instanceof HTMLElement)) continue;
      if (node.hasAttribute('data-parallax')) continue;
      if (node.closest('[data-parallax]')) continue;
      if (node.querySelector('[data-parallax]')) continue;
      node.dataset.parallax = String(speed);
    }
  }
}

export function mountParallax(root: ParentNode = document): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  autoTag(root);

  const nodes = [...root.querySelectorAll<HTMLElement>('[data-parallax]')];
  if (!nodes.length) return;

  let ticking = false;

  const update = () => {
    ticking = false;
    const vh = window.innerHeight || 1;

    for (const el of nodes) {
      const speed = Number(el.dataset.parallax);
      if (!Number.isFinite(speed) || speed === 0) continue;

      const rect = el.getBoundingClientRect();
      if (rect.bottom < -160 || rect.top > vh + 160) continue;

      const mid = rect.top + rect.height * 0.5;
      const delta = (mid - vh * 0.45) / vh;
      // Stronger travel so mid-page scrolling feels layered.
      el.style.setProperty('--parallax-y', (delta * speed * -140).toFixed(2));
    }
  };

  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  };

  update();
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
}
