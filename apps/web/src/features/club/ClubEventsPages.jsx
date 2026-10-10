import { useNavigate, useParams } from 'react-router-dom';
import { useAction, useGet } from '../../api/hooks.js';
import { useAuth } from '../../auth/AuthContext.jsx';
import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { Button } from '../../components/ui/Button.jsx';
import { Card } from '../../components/ui/Card.jsx';
import { DataTable } from '../../components/ui/DataTable.jsx';
import { QueryState, MutationError } from '../../components/ui/QueryState.jsx';
import { StatusPill } from '../../components/events/EventBits.jsx';
import { PermissionGate } from '../../app/guards/guards.jsx';
import { fmtDateTime } from '../../utils/dates.js';
import { EventPlanForm } from './EventPlanForm.jsx';

/** Club events with status chips (spec 6.2). */
export function ClubEventsPage() {
  const { clubId } = useParams();
  const q = useGet(['club', clubId, 'events'], `/clubs/${clubId}/events`);
  return (
    <>
      <PageBanner
        title="Club events"
        description="Drafts, submitted plans and approved events of this club."
        actions={
          <PermissionGate permission="event.draft" clubId={clubId}>
            <Button variant="light" to={`/club/${clubId}/events/new`}>
              Add an event
            </Button>
          </PermissionGate>
        }
      />
      <QueryState query={q} emptyTitle="No events yet" emptyText="Create a draft to start planning.">
        {(events) => (
          <Card>
            <DataTable
              caption="Club events"
              rows={events}
              columns={[
                {
                  key: 'title',
                  header: 'Event',
                  render: (e) => (
                    <Button variant="link" to={`/club/${clubId}/events/${e.id}`}>
                      {e.title}
                    </Button>
                  ),
                },
                { key: 'when', header: 'When', render: (e) => fmtDateTime(e.startsAt) },
                { key: 'status', header: 'Status', render: (e) => <StatusPill status={e.status} /> },
                {
                  key: 'hall',
                  header: 'Hall',
                  render: (e) =>
                    e.hall
                      ? `${e.hall.name} (${e.hall.bookingStatus})`
                      : e.mode === 'online'
                        ? 'Online'
                        : 'None',
                },
                { key: 'reg', header: 'Registered', render: (e) => e.registeredCount },
              ]}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}

/** FR-EVT-01: create a draft. Needs event.draft (the route guard also checks it). */
export function NewEventPage() {
  const { clubId } = useParams();
  const navigate = useNavigate();
  const { can } = useAuth();
  const create = useAction({
    invalidate: [['club', clubId, 'events']],
    onSuccess: (ev) => navigate(`/club/${clubId}/events/${ev.id}`),
  });
  const serverErrors = Object.fromEntries(
    (Array.isArray(create.error?.details) ? create.error.details : [])
      .filter((d) => d.path)
      .map((d) => [d.path, d.message]),
  );
  return (
    <>
      <PageBanner
        title="Add an event"
        description="Start with the plan. You can add the poster, form and hall afterwards."
      />
      <Card>
        <EventPlanForm
          submitLabel="Create draft"
          busy={create.isPending}
          serverErrors={serverErrors}
          onSubmit={(body) => create.mutate({ path: `/clubs/${clubId}/events`, body })}
        />
        <MutationError mutation={create} />
        {!can('event.submit', clubId) && (
          <p className="muted small">
            Only the Leader can submit an event to the OSI. You can prepare it and ask the Leader to submit.
          </p>
        )}
      </Card>
    </>
  );
}

/** Registrations entry point from the sidebar: pick an event, then open its Registrations tab. */
export function ClubRegistrationsPage() {
  const { clubId } = useParams();
  const q = useGet(['club', clubId, 'events'], `/clubs/${clubId}/events`);
  return (
    <>
      <PageBanner
        title="Registrations"
        description="Choose an event to see who registered, download the list or run check-in."
      />
      <QueryState query={q} emptyTitle="No events yet">
        {(events) => (
          <Card>
            <DataTable
              caption="Events and registrations"
              rows={events.filter((e) => ['approved', 'completed', 'cancelled'].includes(e.status))}
              empty="Registrations appear once an event is approved."
              columns={[
                {
                  key: 'title',
                  header: 'Event',
                  render: (e) => (
                    <Button variant="link" to={`/club/${clubId}/events/${e.id}?tab=registrations`}>
                      {e.title}
                    </Button>
                  ),
                },
                { key: 'when', header: 'When', render: (e) => fmtDateTime(e.startsAt) },
                {
                  key: 'reg',
                  header: 'Registered',
                  render: (e) => `${e.registeredCount}${e.maxSeats ? ` / ${e.maxSeats}` : ''}`,
                },
                {
                  key: 'form',
                  header: 'Registration',
                  render: (e) => e.registrationStatus ?? 'Not published',
                },
              ]}
            />
          </Card>
        )}
      </QueryState>
    </>
  );
}
