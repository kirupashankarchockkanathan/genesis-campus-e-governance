import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../api/client.js';
import { Icon } from '../layout/Icon.jsx';
import { fmtDateTime } from '../../utils/dates.js';
import { useNotifications } from './NotificationsProvider.jsx';

export const badgeText = (n) => (n > 99 ? '99+' : String(n));

function NotificationPanel({ onClose }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { refreshCount, setCount } = useNotifications();
  const list = useQuery({ queryKey: ['notifications', 'latest'], queryFn: () => api('/notifications') });

  const open = async (n) => {
    if (!n.read) {
      await api(`/notifications/${n.id}/read`, { method: 'POST' }).catch(() => {});
      qc.invalidateQueries({ queryKey: ['notifications'] });
      refreshCount();
    }
    onClose();
    if (n.route) navigate(n.route);
  };
  const markAll = async () => {
    await api('/notifications/read-all', { method: 'POST' });
    setCount(0);
    qc.invalidateQueries({ queryKey: ['notifications'] });
  };

  const items = (list.data ?? []).slice(0, 20);
  return (
    <div className="panel" role="dialog" aria-label="Notifications">
      <div className="row-between panel-head">
        <h2>Notifications</h2>
        <button className="btn btn-link" onClick={markAll}>
          Mark all read
        </button>
      </div>
      {list.isLoading && (
        <p className="muted" role="status">
          Loading...
        </p>
      )}
      {list.isError && (
        <p className="notice notice-bad" role="alert">
          Could not load notifications.
        </p>
      )}
      {list.data && items.length === 0 && <p className="muted">You are all caught up.</p>}
      <ul className="panel-list">
        {items.map((n) => (
          <li key={n.id}>
            <button className={`panel-item ${n.read ? '' : 'unread'}`} onClick={() => open(n)}>
              <strong>
                {!n.read && <span className="visually-hidden">Unread: </span>}
                {n.title}
              </strong>
              <span>{n.body}</span>
              <span className="muted small">{fmtDateTime(n.createdAt)}</span>
            </button>
          </li>
        ))}
      </ul>
      <Link to="/notifications" className="btn btn-secondary" onClick={onClose}>
        See all
      </Link>
    </div>
  );
}

/** Bell at the top right with the unread count (99+ above 99) and a pulse when a toast lands (FR-NOTIF-01). */
export function BellButton() {
  const { count, pulse, bellRef } = useNotifications();
  const [open, setOpen] = useState(false);
  const wrap = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => !wrap.current?.contains(e.target) && setOpen(false);
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="bell-wrap" ref={wrap}>
      <button
        ref={bellRef}
        className="icon-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={`Notifications (${count} unread)`}
        aria-expanded={open}
        title="Notifications"
      >
        <Icon name="bell" />
        {count > 0 && (
          <span key={pulse} className="badge badge-pulse" aria-hidden="true">
            {badgeText(count)}
          </span>
        )}
      </button>
      {open && <NotificationPanel onClose={() => setOpen(false)} />}
    </div>
  );
}
