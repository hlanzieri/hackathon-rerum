import React, { useEffect, useRef } from 'react';
export default function Modal({ titleId, children, onClose, busy = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement;
    if (dialog.showModal) dialog.showModal();
    else dialog.setAttribute('open', '');
    dialog.querySelector('input,button,select')?.focus();
    return () => {
      dialog.close?.();
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          if (!busy) onClose();
        }
      }}
    >
      {children}
    </dialog>
  );
}
