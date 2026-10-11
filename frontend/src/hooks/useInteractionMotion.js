import { useEffect } from 'react';

const surfaces = '.nexus-home-tab, .nexus-item-photo, .nexus-admission-pass, .nexus-agenda-event';
const properties = ['--surface-x', '--surface-y', '--highlight-x', '--highlight-y'];

// Delegate once so asynchronously loaded reports and tickets respond without rebinding.
export default function useInteractionMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)');
    const mouse = window.matchMedia('(hover: hover) and (pointer: fine) and (min-width: 768px)');
    let active = null;
    let frame = 0;
    let x = 0;
    let y = 0;
    const reset = () => {
      cancelAnimationFrame(frame); frame = 0;
      if (active) for (const property of properties) active.style.removeProperty(property);
      active = null;
    };
    const move = event => {
      if (reduced.matches || !mouse.matches || event.pointerType === 'touch') return reset();
      const surface = event.target.closest?.(surfaces);
      if (!surface || !root.contains(surface)) return reset();
      if (active !== surface) { reset(); active = surface; }
      const rect = surface.getBoundingClientRect();
      if (!rect.width || !rect.height) return reset();
      x = Math.max(-1, Math.min(1, (event.clientX - rect.left) / rect.width * 2 - 1));
      y = Math.max(-1, Math.min(1, (event.clientY - rect.top) / rect.height * 2 - 1));
      if (!frame) frame = requestAnimationFrame(() => {
        frame = 0;
        if (!active?.isConnected || reduced.matches || !mouse.matches) return reset();
        active.style.setProperty('--surface-x', x.toFixed(3));
        active.style.setProperty('--surface-y', y.toFixed(3));
        active.style.setProperty('--highlight-x', `${(x + 1) * 50}%`);
        active.style.setProperty('--highlight-y', `${(y + 1) * 50}%`);
      });
    };
    const leave = event => {
      if (active && !active.contains(event.relatedTarget)) reset();
    };
    const observer = new MutationObserver(() => { if (active && !root.contains(active)) reset(); });
    observer.observe(root, { childList: true, subtree: true });
    root.addEventListener('pointermove', move, { passive: true });
    root.addEventListener('pointerout', leave);
    root.addEventListener('pointerleave', reset);
    reduced.addEventListener('change', reset);
    mouse.addEventListener('change', reset);
    return () => {
      reset(); observer.disconnect();
      root.removeEventListener('pointermove', move);
      root.removeEventListener('pointerout', leave);
      root.removeEventListener('pointerleave', reset);
      reduced.removeEventListener('change', reset);
      mouse.removeEventListener('change', reset);
    };
  }, [rootRef]);
}
