"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

// Native modal dialogs provide focus containment and make the scene inert without changing OrbitControls.
export function ExplorationDialog({ title, eyebrow, onClose, children }: {
  title: string; eyebrow: string; onClose: () => void; children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const previous = document.activeElement;
    const dialog = ref.current;
    dialog?.showModal();
    return () => {
      dialog?.close();
      if (previous instanceof HTMLElement && previous.isConnected) previous.focus();
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className="exploration-dialog"
    onKeyDown={(event) => {
      if (event.key === "Tab") {
        const focusable = event.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), select:not(:disabled), [tabindex="0"]',
        );
        const first = focusable[0];
        const last = focusable[focusable.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last?.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first?.focus();
        }
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      onClose();
    }}
    onCancel={(event) => { event.preventDefault(); event.stopPropagation(); onClose(); }}>
    <header className="flex shrink-0 items-start justify-between gap-4 border-b border-white/10 p-5 sm:p-6">
      <div className="min-w-0"><p className="text-xs uppercase tracking-[0.2em] text-amber-200/80">{eyebrow}</p><h2 id={titleId} className="mt-2 text-2xl text-white">{title}</h2></div>
      <button autoFocus type="button" className="mission-button shrink-0" onClick={onClose} aria-label={`Close ${title}`}>Close</button>
    </header>
    <div tabIndex={0} className="exploration-dialog-content min-h-0 overflow-y-auto overscroll-contain p-5 sm:p-6">{children}</div>
  </dialog>;
}
