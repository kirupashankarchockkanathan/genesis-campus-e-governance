import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { QueryState, MutationError } from '../../components/ui/QueryState.jsx';
import { ConfirmDialog } from '../../components/ui/Modal.jsx';
import { FormRenderer } from '../../components/forms/FormRenderer.jsx';
import { QrTicket, ShareButton, StatusPill } from '../../components/events/EventBits.jsx';
import { fmtDateTime, fmtRange } from '../../utils/dates.js';

/** Client-side view of what the registration button should say (TC-UI-10). */
export function registrationState(event, now = Date.now()) {
  if (event.myRegistration?.status === 'registered' || event.myRegistration?.status === 'attended')
    return 'registered';
  if (event.myRegistration?.status === 'waitlisted') return 'waitlisted';
  if (['cancelled', 'rejected', 'completed'].includes(event.status)) return 'ended';
  if (event.registrationStatus !== 'published')
    return event.registrationStatus === 'closed' ? 'closed' : 'not_open';
  if (
    new Date(event.startsAt).getTime() <= now ||
    (event.registrationClosesAt && new Date(event.registrationClosesAt).getTime() <= now)
  )
    return 'closed';
  if (event.maxSeats !== null && event.registeredCount >= event.maxSeats) return 'full';
  return 'open';
}

const LABEL = {
  not_open: 'Registration not open yet',
  closed: 'Registration closed',
  full: 'Full',
  ended: 'Event ended',
};

function Ticket({ eventId }) {
  const q = useGet(['ticket', eventId], `/me/registrations/${eventId}/ticket`);
  return <QueryState query={q}>{(t) => <QrTicket ticket={t} />}</QueryState>;
}

export function EventDetailPage() {
  const { id } = useParams();
  const { user, platformRole } = useAuth();
  const key = ['event', id];
  const q = useGet(key, `/events/${id}`);
  const isStudent = platformRole === 'student';
  const [confirmCancel, setConfirmCancel] = useState(false);
  const form = useGet(['event', id, 'form'], `/events/${id}/form`, {
    enabled: Boolean(q.data?.registrationStatus === 'published'),
  });
  const register = useAction({
    invalidate: [key, ['events'], ['activities'], ['ticket', id], ['calendar'], ['notifications']],
  });
  const cancel = useAction({
    invalidate: [key, ['events'], ['activities'], ['ticket', id], ['calendar']],
    onSuccess: () => setConfirmCancel(false),
  });

  const serverErrors = Object.fromEntries(
    (Array.isArray(register.error?.details) ? register.error.details : [])
      .filter((d) => d.path)
      .map((d) => [d.path, d.message]),
  );

  return (
    <QueryState query={q}>
      {(ev) => {
        const state = registrationState(ev);
        return (
          <>
            <PageBanner
              title={ev.title}
              description={`${ev.clubName} · ${fmtRange(ev.startsAt, ev.endsAt)}`}
              actions={<StatusPill status={ev.status} />}
            />
            <div className="two-col">
              <div className="stack">
                {ev.posterUrl && /\.(png|jpe?g|webp)$/i.test(ev.posterUrl) && (
                  <img className="poster" src={ev.posterUrl} alt={`Poster of ${ev.title}`} />
                )}
                {ev.posterUrl?.endsWith('.pdf') && (
                  <a className="btn btn-secondary" href={ev.posterUrl} target="_blank" rel="noreferrer">
                    Open poster (PDF)
                  </a>
                )}
                <Card>
                  <h2>About this event</h2>
                  <p>{ev.summary}</p>
                  {ev.description && <p style={{ whiteSpace: 'pre-wrap' }}>{ev.description}</p>}
                  {ev.objectives && (
                    <>
                      <h3>Objectives</h3>
                      <p style={{ whiteSpace: 'pre-wrap' }}>{ev.objectives}</p>
                    </>
                  )}
                  {ev.agenda?.length > 0 && (
                    <>
                      <h3>Agenda</h3>
                      <ul>
                        {ev.agenda.map((a, i) => (
                          <li key={i}>
                            {a.time && <strong>{a.time}: </strong>}
                            {a.title}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </Card>
              </div>
              <aside className="stack">
                <Card>
                  <dl className="stack-sm">
                    <div>
                      <dt className="muted small">When</dt>
                      <dd>{fmtRange(ev.startsAt, ev.endsAt)}</dd>
                    </div>
                    <div>
                      <dt className="muted small">Mode</dt>
                      <dd>{ev.mode}</dd>
                    </div>
                    <div>
                      <dt className="muted small">Venue</dt>
                      <dd>
                        {ev.hall?.bookingStatus === 'confirmed'
                          ? `${ev.hall.name}${ev.hall.building ? `, ${ev.hall.building}` : ''}`
                          : ev.mode === 'online'
                            ? 'Online'
                            : 'To be confirmed'}
                      </dd>
                    </div>
                    {ev.onlineLink && ev.myRegistration && (
                      <div>
                        <dt className="muted small">Online link</dt>
                        <dd>
                          <a href={ev.onlineLink}>{ev.onlineLink}</a>
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="muted small">Registration closes</dt>
                      <dd>{fmtDateTime(ev.registrationClosesAt ?? ev.registrationDeadline)}</dd>
                    </div>
                    {ev.maxSeats !== null && (
                      <div>
                        <dt className="muted small">Seats</dt>
                        <dd>
                          {ev.registeredCount} of {ev.maxSeats} taken
                        </dd>
                      </div>
                    )}
                    <div>
                      <dt className="muted small">Organised by</dt>
                      <dd>
                        <Link to={`/clubs/${ev.clubSlug}`}>{ev.clubName}</Link>
                      </dd>
                    </div>
                  </dl>
                  <ShareButton event={ev} />
                </Card>

                {isStudent && (
                  <Card>
                    {state === 'registered' && (
                      <div className="stack">
                        <span className="pill pill-ok">You are registered</span>
                        <Ticket eventId={ev.id} />
                        <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                          Cancel registration
                        </Button>
                      </div>
                    )}
                    {state === 'waitlisted' && (
                      <div className="stack">
                        <span className="pill pill-warn">You are on the waitlist</span>
                        <p className="small">You will be registered automatically if a seat opens up.</p>
                        <Button variant="secondary" onClick={() => setConfirmCancel(true)}>
                          Leave the waitlist
                        </Button>
                      </div>
                    )}
                    {state !== 'registered' && state !== 'waitlisted' && state !== 'open' && (
                      <>
                        <Button disabled>{LABEL[state]}</Button>
                        {state === 'full' && form.data?.waitlistEnabled && (
                          <p className="small">A waitlist is open: register below to join it.</p>
                        )}
                      </>
                    )}
                    {(state === 'open' || (state === 'full' && form.data?.waitlistEnabled)) && form.data && (
                      <div className="stack">
                        <h2>{state === 'full' ? 'Join the waitlist' : 'Register'}</h2>
                        <FormRenderer
                          fields={form.data.fields}
                          profile={{
                            fullName: user.fullName,
                            email: user.email,
                            rollNumber: user.rollNumber,
                            department: user.department,
                            yearOfStudy: user.yearOfStudy,
                          }}
                          submitLabel={state === 'full' ? 'Join waitlist' : 'Register'}
                          busy={register.isPending}
                          serverErrors={serverErrors}
                          onSubmit={(answers) =>
                            register.mutate({ path: `/events/${ev.id}/register`, body: { answers } })
                          }
                        />
                        <MutationError mutation={register} />
                      </div>
                    )}
                  </Card>
                )}
              </aside>
            </div>
            <ConfirmDialog
              open={confirmCancel}
              title="Cancel your registration?"
              message="Your seat will be freed for someone else. You can register again while registration is open."
              confirmLabel="Cancel registration"
              danger
              busy={cancel.isPending}
              onCancel={() => setConfirmCancel(false)}
              onConfirm={() => cancel.mutate({ method: 'DELETE', path: `/events/${ev.id}/register` })}
            />
          </>
        );
      }}
    </QueryState>
  );
}
