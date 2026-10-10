import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useAuth } from '../../auth/AuthContext.jsx';
import { api } from '../../api/client.js';

const Ctx = createContext(null);

export const TOAST_VISIBLE_MS = 5000;
export const TOAST_FLY_MS = 500;
const MAX_TOASTS = 3;
const POLL_MS = 30_000;

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Live notifications (spec 12.2): the stream token is requested first (EventSource cannot send an
 * Authorization header); if the stream fails the unread count is polled every 30 seconds.
 */
export function NotificationsProvider({ children }) {
  const { isAuthenticated, user } = useAuth();
  const [count, setCount] = useState(0);
  const [toasts, setToasts] = useState([]);
  const [pulse, setPulse] = useState(0);
  const bellRef = useRef(null);
  const inFlight = useRef(0); // toasts that arrived but have not landed in the bell yet

  const refreshCount = useCallback(async () => {
    try {
      const { count: server } = await api('/notifications/unread-count');
      setCount(Math.max(0, server - inFlight.current));
    } catch {
      /* the badge simply keeps its last value */
    }
  }, []);

  const addToast = useCallback((n) => {
    inFlight.current += 1;
    setToasts((list) => [
      ...list.slice(-(MAX_TOASTS - 1)),
      { ...n, key: `${n.id}-${Date.now()}`, phase: 'visible' },
    ]);
  }, []);

  const land = useCallback((key) => {
    inFlight.current = Math.max(0, inFlight.current - 1);
    setToasts((list) => list.filter((t) => t.key !== key));
    setCount((c) => c + 1);
    setPulse((p) => p + 1);
  }, []);

  const dismiss = useCallback((key) => {
    // A toast the user clicked is already read, so it does not count as new.
    inFlight.current = Math.max(0, inFlight.current - 1);
    setToasts((list) => list.filter((t) => t.key !== key));
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) return undefined;
    let closed = false;
    let source = null;
    let poll = null;
    let retry = null;

    const startPolling = () => {
      if (poll) return;
      poll = setInterval(refreshCount, POLL_MS);
      retry = setTimeout(connect, 60_000); // try the stream again later
    };
    async function connect() {
      if (closed) return;
      clearInterval(poll);
      poll = null;
      try {
        if (typeof EventSource === 'undefined') throw new Error('no EventSource');
        const { token } = await api('/notifications/stream-token', { method: 'POST' });
        if (closed) return;
        source = new EventSource(`/api/v1/notifications/stream?token=${encodeURIComponent(token)}`);
        source.addEventListener('notification', (e) => addToast(JSON.parse(e.data)));
        source.addEventListener('discussion', (e) =>
          window.dispatchEvent(new CustomEvent('ccp:discussion', { detail: JSON.parse(e.data) })),
        );
        source.onerror = () => {
          source?.close();
          source = null;
          if (!closed) startPolling();
        };
      } catch {
        if (!closed) startPolling();
      }
    }
    refreshCount();
    connect();
    return () => {
      closed = true;
      source?.close();
      clearInterval(poll);
      clearTimeout(retry);
    };
  }, [isAuthenticated, user, addToast, refreshCount]);

  const value = useMemo(
    () => ({
      count,
      toasts,
      pulse,
      bellRef,
      refreshCount,
      land,
      dismiss,
      setCount,
      addToast,
      reducedMotion: prefersReducedMotion,
    }),
    [count, toasts, pulse, refreshCount, land, dismiss, addToast],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useNotifications() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useNotifications must be used inside NotificationsProvider');
  return ctx;
}
