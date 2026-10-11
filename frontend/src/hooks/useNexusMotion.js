import { useEffect } from 'react';
import { animate } from 'animejs';

const targets = [
  '.nexus-home-copy > *', '.nexus-campus-photo', '.nexus-hero-pass', '.nexus-hero-item',
  '.nexus-home-tab', '.nexus-page-header', '.nexus-agenda-event', '.nexus-item-report',
  '.nexus-admission-pass', '.nexus-access-panel', '.nexus-empty-state', '.nexus-dialog',
  '[data-motion="confirmation"]', '[data-motion="notice"]', '[data-motion="cloud-details"]',
].join(',');

// Only animate arriving content. Nothing is hidden while waiting for data or scrolling.
// Revert every temporary inline style so CSS hover states and React remain in control.
export default function useNexusMotion(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const preference = window.matchMedia('(prefers-reduced-motion: reduce)');
    const seen = new WeakSet();
    const pending = new Set();
    const running = new Set();
    let frame = 0;
    let disposed = false;

    const play = (element, delay = 0) => {
      if (preference.matches || !element.isConnected || disposed) return;
      const options = { opacity: [0.55, 1], y: [14, 0], duration: 500, delay, ease: 'outCubic' };
      let subject = element;
      if (element.matches('.nexus-home-copy h1')) {
        subject = element.querySelectorAll('.nexus-title-word');
        Object.assign(options, { y: ['112%', '0%'], rotate: [5, 0], opacity: [1, 1], duration: 850, delay: (_, index) => 70 + index * 55, ease: 'outExpo' });
      } else if (element.matches('.nexus-campus-photo') && element.closest('.nexus-home-hero--panorama')) {
        Object.assign(options, { y: [0, 0], opacity: [1, 1], scale: [1.04, 1], duration: 1100, delay: 0, ease: 'outExpo' });
      } else if (element.matches('.nexus-campus-photo')) {
        Object.assign(options, { y: [0, 0], opacity: [1, 1], scale: [1.12, 1], clipPath: ['inset(12% 34% 12% 34% round 90px)', 'inset(0% 0% 0% 0% round 26px)'], duration: 1100, delay: 80, ease: 'outExpo' });
      } else if (element.matches('.nexus-hero-pass')) {
        Object.assign(options, { x: [-70, 0], y: [65, 0], rotate: [-12, -3], scale: [0.9, 1], opacity: [0, 1], duration: 950, delay: 340, ease: 'outBack' });
      } else if (element.matches('.nexus-hero-item')) {
        Object.assign(options, { x: [45, 0], y: [-35, 0], rotate: [12, 3], scale: [0.9, 1], opacity: [0, 1], duration: 850, delay: 480, ease: 'outBack' });
      } else if (element.matches('.nexus-home-tab')) {
        Object.assign(options, { y: [0, 0], x: [18, 0], clipPath: ['inset(0% 100% 0% 0%)', 'inset(0% 0% 0% 0%)'], duration: 700, delay: delay + 180, ease: 'outExpo' });
      } else if (element.matches('.nexus-agenda-event')) {
        Object.assign(options, { y: [0, 0], x: [28, 0], duration: 650, ease: 'outExpo' });
      } else if (element.matches('.nexus-item-report')) {
        Object.assign(options, { y: [24, 0], clipPath: ['inset(0% 0% 14% 0%)', 'inset(0% 0% 0% 0%)'], duration: 700, ease: 'outExpo' });
      } else if (element.matches('.nexus-admission-pass')) {
        Object.assign(options, { y: [32, 0], rotate: [-2.5, 0], transformOrigin: '15% 100%', duration: 700, ease: 'outBack' });
      } else if (element.matches('.nexus-page-header')) {
        Object.assign(options, { y: [0, 0], x: [-18, 0], duration: 600, ease: 'outExpo' });
      } else if (element.matches('.nexus-dialog')) {
        Object.assign(options, { y: [24, 0], scale: [0.96, 1], duration: 450, delay: 0, ease: 'outExpo' });
      } else if (element.matches('[data-motion="confirmation"]')) {
        Object.assign(options, { y: [16, 0], scale: [0.96, 1], duration: 600, delay: 0, ease: 'outBack' });
      } else if (element.matches('[data-motion="notice"]')) {
        Object.assign(options, { y: [-8, 0], duration: 220, delay: 0 });
      }
      const animation = animate(subject, { ...options, onComplete: self => {
        self.revert(); running.delete(self);
      }});
      running.add(animation);
    };

    const intersection = 'IntersectionObserver' in window ? new IntersectionObserver(entries => {
      let position = 0;
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        intersection.unobserve(entry.target); pending.delete(entry.target);
        play(entry.target, Math.min(position++ * 55, 165));
      }
    }, { threshold: 0.08 }) : null;

    const scan = () => {
      frame = 0;
      for (const element of pending) {
        if (!element.isConnected) { intersection?.unobserve(element); pending.delete(element); }
      }
      let position = 0;
      for (const element of root.querySelectorAll(targets)) {
        if (seen.has(element)) continue;
        seen.add(element);
        if (preference.matches) continue;
        const rect = element.getBoundingClientRect();
        if (!rect.width || !rect.height) continue;
        if (element.matches('.nexus-dialog, [data-motion="notice"]') || (rect.top < window.innerHeight && rect.bottom > 0) || !intersection) {
          play(element, Math.min(position++ * 45, 180));
        } else { pending.add(element); intersection.observe(element); }
      }
    };
    const queueScan = () => { if (!frame) frame = requestAnimationFrame(scan); };
    const observer = new MutationObserver(queueScan);
    observer.observe(root, { childList: true, subtree: true });
    const changePreference = () => {
      for (const animation of running) animation.revert();
      running.clear();
      if (preference.matches) { intersection?.disconnect(); pending.clear(); }
      queueScan();
    };
    preference.addEventListener('change', changePreference);
    queueScan();
    return () => {
      disposed = true;
      cancelAnimationFrame(frame);
      observer.disconnect(); intersection?.disconnect(); pending.clear();
      preference.removeEventListener('change', changePreference);
      for (const animation of running) animation.revert();
      running.clear();
    };
  }, [rootRef]);
}
