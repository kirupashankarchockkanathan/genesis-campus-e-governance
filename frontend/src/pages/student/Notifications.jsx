import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { EmptyState, Icon } from '../../components/ui';
import { useApp } from '../../context/AppContext';
import { cn } from '../../utils/helpers';

const TYPE_STYLE = {
  registration: { icon: 'ShieldCheck', box: 'bg-brand-50 text-brand-600', pill: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  deadline: { icon: 'Clock3', box: 'bg-amber-soft text-amber-ink', pill: 'bg-amber-soft text-amber-ink', dot: 'bg-[#e3a02c]' },
  venue: { icon: 'MapPin', box: 'bg-sky-soft text-sky-ink', pill: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  cancellation: { icon: 'CircleAlert', box: 'bg-rose-soft text-rose-ink', pill: 'bg-rose-soft text-rose-ink', dot: 'bg-[#e06052]' },
  club: { icon: 'PartyPopper', box: 'bg-brand-50 text-brand-600', pill: 'bg-brand-50 text-brand-700', dot: 'bg-brand-500' },
  university: { icon: 'Megaphone', box: 'bg-sky-soft text-sky-ink', pill: 'bg-sky-soft text-sky-ink', dot: 'bg-[#4a73c4]' },
};

export default function Notifications() {
  const app = useApp();
  const navigate = useNavigate();
  const [tab, setTab] = useState('all');
  const { notifications, unreadCount } = app;

  const list = notifications.filter((n) => (tab === 'all' ? true : tab === 'unread' ? n.unread : n.kind === 'event'));
  const tabs = [['all', 'All'], ['unread', 'Unread'], ['events', 'Event Updates']];

  const open = (n) => {
    app.markRead(n.id);
    navigate(n.eventId ? `/student/events/${n.eventId}` : '/student/dashboard');
  };

  return (
    <div className="mx-auto max-w-[1050px]">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="eyebrow">Your campus, in the loop</div>
          <h1 className="mt-2 text-3xl font-extrabold text-brand-900">Notifications</h1>
          <p className="mt-1.5 text-xs text-ink-soft">{unreadCount} unread update{unreadCount === 1 ? '' : 's'} · Only student-facing announcements and approved event updates appear here.</p>
        </div>
        <button onClick={app.markAllRead} disabled={unreadCount === 0} className="btn-ghost"><Icon name="CheckCheck" className="h-4 w-4" /> Mark all as read</button>
      </div>

      <section className="card overflow-hidden">
        <div className="px-6 pt-6">
          <div className="flex items-start justify-between">
            <div>
              <h2 className="text-lg font-extrabold text-brand-900">Recent updates</h2>
              <p className="text-[10px] text-ink-mute">Keep track of registrations, event changes, and campus news.</p>
            </div>
            <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-brand-800"><span className="h-1.5 w-1.5 rounded-full bg-brand-500" /> Student portal</span>
          </div>
          <div className="mt-5 flex gap-2 border-b border-line pb-4" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn('rounded-lg px-3.5 py-2 text-[11px] font-bold transition', tab === id ? 'bg-brand-50 text-brand-800' : 'text-ink-soft hover:bg-brand-50/50')}>
                {label}{id === 'unread' && <span className="ml-1.5 text-[9px] text-ink-mute">{unreadCount}</span>}
              </button>
            ))}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="p-6"><EmptyState icon="BellOff" title="You're all caught up" body="New updates will show up here." /></div>
        ) : (
          <ul>
            {list.map((n) => {
              const s = TYPE_STYLE[n.type];
              return (
                <li key={n.id} className={cn('flex gap-4 border-b border-line px-6 py-5 last:border-0', n.unread && 'bg-gradient-to-r from-brand-50/60 to-transparent')}>
                  <span className={cn('grid h-11 w-11 shrink-0 place-items-center rounded-xl', s.box)}><Icon name={s.icon} className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5">
                      <span className={cn('pill', s.pill)}><span className={cn('h-1.5 w-1.5 rounded-full', s.dot)} /> {n.label}</span>
                      <span className="text-[10px] text-ink-mute">{n.time}</span>
                    </div>
                    <h3 className="mt-1.5 flex items-center gap-2 text-[13px] font-bold text-brand-900">{n.title}{n.unread && <span className="h-1.5 w-1.5 rounded-full bg-brand-500" />}</h3>
                    <p className="mt-0.5 text-[11px] text-ink-soft">{n.body}</p>
                    <button onClick={() => open(n)} className="link-arrow mt-2.5">{n.eventId ? 'View event details' : 'View campus update'} <Icon name="ChevronRight" className="h-3.5 w-3.5" /></button>
                  </div>
                  {n.unread && <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-brand-500" aria-label="Unread" />}
                </li>
              );
            })}
          </ul>
        )}
        <div className="flex items-center gap-2 border-t border-line bg-canvas/60 px-6 py-3 text-[10px] text-ink-mute">
          <Icon name="Bell" className="h-3.5 w-3.5" /> In-app updates only. Email and mobile delivery aren't enabled in this demo.
        </div>
      </section>
    </div>
  );
}
