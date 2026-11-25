import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

export default function Dialog({ title, subtitle, onClose, children, busy = false, wide = false }: {
  title: string; subtitle?: string; onClose: () => void; children: ReactNode; busy?: boolean; wide?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    ref.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={wide ? 'dialog wide' : 'dialog'}
    onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}
    aria-labelledby="dialog-title" aria-describedby={subtitle ? 'dialog-subtitle' : undefined}>
    <div className="dialog-heading"><div><h2 id="dialog-title">{title}</h2>
      {subtitle && <p id="dialog-subtitle">{subtitle}</p>}</div>
      <button type="button" className="icon-button" aria-label="Close dialog" onClick={onClose} disabled={busy}><X size={20} /></button>
    </div>
    {children}
  </dialog>;
}
