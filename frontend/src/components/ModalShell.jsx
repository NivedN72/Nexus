import React, { useEffect, useRef } from 'react';
import { Sparkles, ArrowUpRight } from 'lucide-react';

export default function ModalShell({ children, label, title, description, className = '' }) {
  const dialogRef = useRef(null);
  useEffect(() => {
    const dialog = dialogRef.current;
    const previousFocus = document.activeElement;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const focusable = () => [...dialog.querySelectorAll('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled), a[href]')].filter(element => element.getClientRects().length > 0);
    const initial = focusable()[0];
    initial?.focus();
    const handleKey = event => {
      if (event.key === 'Escape') {
        const close = dialog.querySelector('.nexus-dialog-main > button');
        if (close && !close.disabled) { event.preventDefault(); close.click(); }
      }
      if (event.key !== 'Tab') return;
      const elements = focusable();
      const first = elements[0]; const last = elements[elements.length - 1];
      if (!first) { event.preventDefault(); return; }
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    };
    dialog.addEventListener('keydown', handleKey);
    return () => {
      document.body.style.overflow = previousOverflow;
      dialog.removeEventListener('keydown', handleKey);
      if (previousFocus && document.contains(previousFocus)) previousFocus.focus();
    };
  }, []);
  return <div className="nexus-dialog-backdrop animate-fade-in">
    <section ref={dialogRef} className={`nexus-dialog ${className}`} role="dialog" aria-modal="true" aria-label={label}>
      <aside className="nexus-dialog-aside">
        <div className="nexus-dialog-brand"><span><Sparkles size={20} /></span>Nexus</div>
        <div className="nexus-dialog-story"><span className="nexus-dialog-kicker">{label}</span><h2>{title}</h2><p>{description}</p></div>
        <div className="nexus-dialog-mark" aria-hidden="true"><ArrowUpRight size={50} strokeWidth={1.25} /></div>
        <span className="nexus-dialog-footnote">Events &amp; AI Lost and Found</span>
      </aside>
      <div className="nexus-dialog-main">{children}</div>
    </section>
  </div>;
}
