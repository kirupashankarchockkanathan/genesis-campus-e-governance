import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { useAuth } from './AuthContext';
import { useGov } from './GovContext';
import {
  cancelEventRegistration,
  fetchStudent,
  markNotificationsRead,
  registerForEvent,
  saveStudentPrefs,
  toggleBookmarkEvent,
  toggleFavoriteClub,
} from '../utils/api';

// Student state: registrations, favourites, bookmarks, notifications and preferences. The server stores them per
// account; the screens update at once (optimistic) and the server's copy replaces the local one when it answers.
// Registering is checked by the server (seats, deadline), so a full event cannot be booked from a stale screen.

const AppContext = createContext(null);
const POLL_MS = 15000;
const BLANK = {
  registrations: [],
  favorites: [],
  bookmarks: [],
  notifications: [],
  history: [],
  prefs: { inApp: true, email: false, deadlines: true, news: true, interests: [] },
};

export function AppProvider({ children }) {
  const gov = useGov();
  const { user } = useAuth();
  const { getEvent } = gov;
  const isStudent = user?.role === 'student';
  const [data, setData] = useState(BLANK);
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // event shown in the success modal
  const busy = useRef(0);

  const { registrations, favorites, bookmarks, notifications, prefs, history } = data;

  const notify = useCallback((message, tone = 'success') => setToast({ message, tone, id: Date.now() }), []);

  // Load the student's own data after sign-in and keep it fresh.
  const load = useCallback(async () => {
    if (!isStudent || busy.current > 0) return;
    try {
      const next = await fetchStudent();
      if (busy.current === 0) setData({ ...BLANK, ...next });
    } catch {
      /* the next poll retries */
    }
  }, [isStudent]);

  useEffect(() => {
    if (!isStudent) {
      setData(BLANK);
      return undefined;
    }
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [isStudent, load]);

  useEffect(() => {
    if (!toast) return undefined;
    const t = setTimeout(() => setToast(null), 3200);
    return () => clearTimeout(t);
  }, [toast]);

  // A change the server refused (published from another screen, stale data...) is reported once.
  useEffect(() => {
    const onError = (e) => notify(e.detail?.message || 'That change could not be saved.', 'info');
    window.addEventListener('gov:sync-error', onError);
    return () => window.removeEventListener('gov:sync-error', onError);
  }, [notify]);

  // Pull in student-facing notices created when events are published (the server merges them too).
  const broadcasts = gov.state.broadcasts;
  useEffect(() => {
    setData((prev) => {
      const known = new Set(prev.notifications.map((n) => n.id));
      const fresh = broadcasts.filter((b) => !known.has(b.id));
      return fresh.length ? { ...prev, notifications: [...fresh, ...prev.notifications] } : prev;
    });
  }, [broadcasts]);

  /** Optimistic change, then the server's answer. On failure the server copy is re-read and the person told. */
  const sync = useCallback(
    async (optimistic, call, failure) => {
      busy.current += 1;
      if (optimistic) setData(optimistic);
      try {
        const next = await call();
        busy.current -= 1;
        if (busy.current === 0) setData({ ...BLANK, ...next });
        return next;
      } catch (e) {
        busy.current -= 1;
        notify(e.message || failure, 'info');
        await load();
        return null;
      }
    },
    [load, notify],
  );

  const isRegistered = useCallback(
    (eventId) => registrations.some((r) => r.eventId === eventId && r.status === 'confirmed'),
    [registrations],
  );

  const register = useCallback(
    (eventId) => {
      const ev = getEvent(eventId);
      if (!ev || ev.status === 'full' || ev.status === 'closed') return false;
      if (registrations.some((r) => r.eventId === eventId && r.status === 'confirmed')) return true;
      sync(
        {
          ...data,
          registrations: [
            { eventId, ref: ev.ref, status: 'confirmed', registeredOn: '2026-10-10' },
            ...registrations.filter((r) => r.eventId !== eventId),
          ],
          notifications: [
            {
              id: `n-reg-${eventId}-${Date.now()}`,
              type: 'registration',
              label: 'Registration',
              time: 'Just now',
              title: 'Your registration is confirmed',
              body: `You're on the list for ${ev.title} on ${ev.dateLabel} at ${ev.time}.`,
              eventId,
              unread: true,
              kind: 'event',
            },
            ...notifications,
          ],
        },
        () => registerForEvent(eventId),
        'Could not complete your registration.',
      ).then((r) => {
        if (r) gov.refreshCounts?.();
      });
      setConfirmation(ev);
      return true;
    },
    [data, registrations, notifications, getEvent, sync, gov],
  );

  const cancelRegistration = useCallback(
    (eventId) => {
      sync(
        { ...data, registrations: registrations.filter((r) => r.eventId !== eventId) },
        () => cancelEventRegistration(eventId),
        'Could not cancel that registration.',
      );
      notify('Registration cancelled.', 'info');
    },
    [data, registrations, sync, notify],
  );

  const toggleFavorite = useCallback(
    (clubId) => {
      const has = favorites.includes(clubId);
      notify(has ? 'Removed from favourites.' : 'Saved to favourites.', has ? 'info' : 'success');
      sync(
        { ...data, favorites: has ? favorites.filter((c) => c !== clubId) : [...favorites, clubId] },
        () => toggleFavoriteClub(clubId),
        'Could not update favourites.',
      );
    },
    [data, favorites, sync, notify],
  );

  const toggleBookmark = useCallback(
    (eventId) => {
      const has = bookmarks.includes(eventId);
      notify(has ? 'Event bookmark removed.' : 'Event bookmarked.', has ? 'info' : 'success');
      sync(
        { ...data, bookmarks: has ? bookmarks.filter((c) => c !== eventId) : [...bookmarks, eventId] },
        () => toggleBookmarkEvent(eventId),
        'Could not update the bookmark.',
      );
    },
    [data, bookmarks, sync, notify],
  );

  const markAllRead = useCallback(() => {
    sync(
      { ...data, notifications: notifications.map((n) => ({ ...n, unread: false })) },
      () => markNotificationsRead({ all: true }),
      'Could not mark notifications as read.',
    );
    notify('All notifications marked as read.');
  }, [data, notifications, sync, notify]);

  const markRead = useCallback(
    (id) => {
      sync(
        { ...data, notifications: notifications.map((n) => (n.id === id ? { ...n, unread: false } : n)) },
        () => markNotificationsRead({ id }),
        'Could not mark that notification as read.',
      );
    },
    [data, notifications, sync],
  );

  const setPrefs = useCallback(
    (updater) => {
      const next = typeof updater === 'function' ? updater(prefs) : updater;
      sync({ ...data, prefs: next }, () => saveStudentPrefs(next), 'Could not save your preferences.');
    },
    [data, prefs, sync],
  );

  const unreadCount = notifications.filter((n) => n.unread).length;

  const value = {
    events: gov.events,
    registrations,
    favorites,
    bookmarks,
    notifications,
    history,
    unreadCount,
    prefs,
    setPrefs,
    toast,
    notify,
    confirmation,
    closeConfirmation: () => setConfirmation(null),
    isRegistered,
    register,
    cancelRegistration,
    toggleFavorite,
    toggleBookmark,
    markAllRead,
    markRead,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = () => {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside <AppProvider>');
  return ctx;
};
