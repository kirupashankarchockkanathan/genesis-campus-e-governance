import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../api/client.js';
import { TOAST_FLY_MS, TOAST_VISIBLE_MS, useNotifications } from './NotificationsProvider.jsx';

const firstChars = (s = '', n = 80) => (s.length > n ? `${s.slice(0, n)}...` : s);

function Toast({ toast }) {
  const { land, dismiss, bellRef, reducedMotion } = useNotifications();
  const navigate = useNavigate();
  const ref = useRef(null);
  const [phase, setPhase] = useState('visible'); // visible -> leaving
  const [fly, setFly] = useState(null);
  const paused = useRef(false);

  useEffect(() => {
    if (phase !== 'visible') return undefined;
    let timer;
    let left = TOAST_VISIBLE_MS;
    let started = Date.now();
    const tick = () => {
      if (paused.current) {
        // Hover or focus pauses the countdown (spec 12.3).
        timer = setTimeout(tick, 200);
        started = Date.now();
        return;
      }
      left -= Date.now() - started;
      started = Date.now();
      if (left <= 0) startLeaving();
      else timer = setTimeout(tick, Math.min(left, 200));
    };
    timer = setTimeout(tick, Math.min(left, 200));
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  function startLeaving() {
    // With reduced motion the toast just fades; otherwise it shrinks toward the bell.
    if (!reducedMotion() && ref.current && bellRef.current) {
      const a = ref.current.getBoundingClientRect();
      const b = bellRef.current.getBoundingClientRect();
      setFly({
        dx: b.left + b.width / 2 - (a.left + a.width / 2),
        dy: b.top + b.height / 2 - (a.top + a.height / 2),
      });
    }
    setPhase('leaving');
  }

  useEffect(() => {
    if (phase !== 'leaving') return undefined;
    const t = setTimeout(() => land(toast.key), TOAST_FLY_MS);
    return () => clearTimeout(t);
  }, [phase, land, toast.key]);

  const open = async () => {
    dismiss(toast.key);
    api(`/notifications/${toast.id}/read`, { method: 'POST' }).catch(() => {});
    if (toast.route) navigate(toast.route);
  };

  const style = fly ? { '--fly-x': `${fly.dx}px`, '--fly-y': `${fly.dy}px` } : undefined;
  return (
    <div
      ref={ref}
      className={`toast ${phase === 'leaving' ? (fly ? 'toast--fly' : 'toast--fade') : ''}`}
      style={style}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
      onFocus={() => (paused.current = true)}
      onBlur={() => (paused.current = false)}
    >
      <button className="toast-body" onClick={open}>
        <strong>{toast.title}</strong>
        <span>{firstChars(toast.body)}</span>
      </button>
    </div>
  );
}

/** Fixed at the top right, at most three stacked; announced to screen readers with role="status". */
export function ToastStack() {
  const { toasts } = useNotifications();
  return (
    <div className="toast-stack" role="status" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <Toast key={t.key} toast={t} />
      ))}
    </div>
  );
}
