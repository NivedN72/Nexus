import { useEffect } from 'react';

// Pointer response belongs to the decorative composition only; touch stays static.
export default function useHeroDepth(compositionRef) {
  useEffect(() => {
    const composition = compositionRef.current;
    if (!composition) return;
    const area = composition.closest('.nexus-home-hero') || composition;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const pointer = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0;
      composition.style.removeProperty('--depth-x');
      composition.style.removeProperty('--depth-y');
    };
    const update = event => {
      if (preference.matches || !pointer.matches || event.pointerType === 'touch') return;
      const rect = composition.getBoundingClientRect();
      x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        composition.style.setProperty('--depth-x', x.toFixed(3));
        composition.style.setProperty('--depth-y', y.toFixed(3));
      });
    };
    area.addEventListener('pointermove', update, { passive: true });
    area.addEventListener('pointerleave', reset);
    preference.addEventListener('change', reset);
    pointer.addEventListener('change', reset);
    return () => {
      reset();
      area.removeEventListener('pointermove', update);
      area.removeEventListener('pointerleave', reset);
      preference.removeEventListener('change', reset);
      pointer.removeEventListener('change', reset);
    };
  }, [compositionRef]);
}
