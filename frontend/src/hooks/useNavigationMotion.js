import { useLayoutEffect, useRef } from 'react';
import { animate, utils } from 'animejs';

export default function useNavigationMotion(navRef, activeTab) {
  const ready = useRef(false);
  useLayoutEffect(() => {
    const nav = navRef.current;
    const marker = nav?.querySelector('.nexus-nav-indicator');
    if (!marker) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let animation;
    const place = (smooth = false) => {
      const button = nav.querySelector('[aria-current="page"]');
      if (!button || !nav.offsetWidth) return;
      animation?.cancel();
      if (smooth && !preference.matches && ready.current) {
        animation = animate(marker, { x: button.offsetLeft, width: button.offsetWidth, duration: 320, ease: 'outCubic' });
      } else {
        utils.set(marker, { x: button.offsetLeft, width: button.offsetWidth });
      }
      ready.current = true;
    };
    const sync = () => place(false);
    place(true);
    window.addEventListener('resize', sync);
    preference.addEventListener('change', sync);
    return () => {
      animation?.cancel();
      window.removeEventListener('resize', sync);
      preference.removeEventListener('change', sync);
    };
  }, [navRef, activeTab]);
}
