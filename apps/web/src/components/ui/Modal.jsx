import { useEffect, useRef } from 'react';
import { Button } from './Button.jsx';

/** Modal built on <dialog>: focus is trapped by the browser and Escape closes it. */
export function Modal({ open, title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal?.() ?? d.setAttribute('open', '');
    if (!open && d.open) d.close?.() ?? d.removeAttribute('open');
  }, [open]);
  if (!open) return null;
  return (
    <dialog
      ref={ref}
      className="modal"
      aria-labelledby="modal-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
    >
      <div className="modal-body stack">
        <div className="row-between">
          <h2 id="modal-title">{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>
        {children}
        {footer && <div className="row modal-footer">{footer}</div>}
      </div>
    </dialog>
  );
}

/** Never window.confirm (CLAUDE.md): a styled confirmation with a clear action label. */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  danger = false,
  busy = false,
  onConfirm,
  onCancel,
}) {
  return (
    <Modal
      open={open}
      title={title}
      onClose={onCancel}
      footer={
        <>
          <Button variant="secondary" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant={danger ? 'danger' : 'primary'} onClick={onConfirm} disabled={busy}>
            {busy ? 'Working...' : confirmLabel}
          </Button>
        </>
      }
    >
      <p>{message}</p>
    </Modal>
  );
}
