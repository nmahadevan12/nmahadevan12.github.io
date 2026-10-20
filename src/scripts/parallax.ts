/**
 * Sitewide scroll parallax for `[data-parallax="<speed>"]`.
 * Uses the CSS `translate` property so it composes with reveal `transform`s.
 */
export function mountParallax(root: ParentNode = document): void {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;

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
      if (rect.bottom < -120 || rect.top > vh + 120) continue;

      const mid = rect.top + rect.height * 0.5;
      const delta = (mid - vh * 0.5) / vh;
      el.style.setProperty('--parallax-y', (delta * speed * -88).toFixed(2));
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
