import { useState } from 'react';
import { EVENT_MODES, EVENT_TYPES, eventCreateSchema } from '@ccp/shared';
import { Button } from '../../components/ui/Button.jsx';
import { FormField } from '../../components/ui/FormField.jsx';
import { fromInputValue, toInputValue } from '../../utils/dates.js';

const agendaToText = (a = []) => a.map((x) => (x.time ? `${x.time} | ${x.title}` : x.title)).join('\n');
const textToAgenda = (t) =>
  t
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((l) => {
      const [a, ...rest] = l.split('|');
      return rest.length ? { time: a.trim(), title: rest.join('|').trim() } : { time: '', title: a };
    });

const label = (s) => s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());

/** Event plan form (FR-EVT-01). Dates are typed in the portal time zone and sent as UTC. */
export function EventPlanForm({ initial, onSubmit, busy, submitLabel = 'Save', serverErrors = {} }) {
  const [v, setV] = useState({
    title: initial?.title ?? '',
    type: initial?.type ?? 'workshop',
    summary: initial?.summary ?? '',
    description: initial?.description ?? '',
    objectives: initial?.objectives ?? '',
    agenda: agendaToText(initial?.agenda),
    facultyCoordinator: initial?.facultyCoordinator ?? '',
    mode: initial?.mode ?? 'offline',
    onlineLink: initial?.onlineLink ?? '',
    startsAt: toInputValue(initial?.startsAt),
    endsAt: toInputValue(initial?.endsAt),
    registrationDeadline: toInputValue(initial?.registrationDeadline),
    expectedParticipants: initial?.expectedParticipants ?? 50,
  });
  const [errors, setErrors] = useState({});
  const set = (k) => (e) => setV((x) => ({ ...x, [k]: e.target.value }));
  const err = (k) => errors[k] ?? serverErrors[k];

  const submit = (e) => {
    e.preventDefault();
    const payload = {
      title: v.title,
      type: v.type,
      summary: v.summary,
      description: v.description || undefined,
      objectives: v.objectives || undefined,
      agenda: textToAgenda(v.agenda),
      facultyCoordinator: v.facultyCoordinator || undefined,
      mode: v.mode,
      onlineLink: v.onlineLink || undefined,
      startsAt: fromInputValue(v.startsAt),
      endsAt: fromInputValue(v.endsAt),
      registrationDeadline: fromInputValue(v.registrationDeadline),
      expectedParticipants: v.expectedParticipants,
    };
    const r = eventCreateSchema.safeParse(payload);
    if (!r.success) {
      setErrors(Object.fromEntries(r.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    onSubmit(payload);
  };

  return (
    <form className="stack" onSubmit={submit} noValidate>
      <FormField label="Title" value={v.title} onChange={set('title')} error={err('title')} />
      <div className="row">
        <FormField label="Type" as="select" value={v.type} onChange={set('type')} error={err('type')}>
          {EVENT_TYPES.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </FormField>
        <FormField label="Mode" as="select" value={v.mode} onChange={set('mode')} error={err('mode')}>
          {EVENT_MODES.map((t) => (
            <option key={t} value={t}>
              {label(t)}
            </option>
          ))}
        </FormField>
        <FormField
          label="Expected participants"
          type="number"
          min={1}
          value={v.expectedParticipants}
          onChange={set('expectedParticipants')}
          error={err('expectedParticipants')}
        />
      </div>
      <FormField
        label="Short summary"
        value={v.summary}
        onChange={set('summary')}
        error={err('summary')}
        help="One or two sentences shown in lists"
      />
      <div className="field">
        <label htmlFor="ev-desc">Full description</label>
        <textarea
          id="ev-desc"
          className="input textarea"
          rows={5}
          value={v.description}
          onChange={set('description')}
        />
        <span className="help">Needed before you can submit to the OSI</span>
      </div>
      <div className="field">
        <label htmlFor="ev-obj">Objectives</label>
        <textarea
          id="ev-obj"
          className="input textarea"
          rows={3}
          value={v.objectives}
          onChange={set('objectives')}
        />
      </div>
      <div className="field">
        <label htmlFor="ev-agenda">Schedule (one line each: time | title)</label>
        <textarea
          id="ev-agenda"
          className="input textarea"
          rows={4}
          value={v.agenda}
          onChange={set('agenda')}
          placeholder={'10:00 | Welcome\n10:15 | Hands-on session'}
        />
      </div>
      <div className="row">
        <FormField
          label="Starts"
          type="datetime-local"
          value={v.startsAt}
          onChange={set('startsAt')}
          error={err('startsAt')}
        />
        <FormField
          label="Ends"
          type="datetime-local"
          value={v.endsAt}
          onChange={set('endsAt')}
          error={err('endsAt')}
        />
        <FormField
          label="Registration deadline"
          type="datetime-local"
          value={v.registrationDeadline}
          onChange={set('registrationDeadline')}
          error={err('registrationDeadline')}
        />
      </div>
      {v.mode !== 'offline' && (
        <FormField
          label="Online meeting link"
          type="url"
          value={v.onlineLink}
          onChange={set('onlineLink')}
          error={err('onlineLink')}
        />
      )}
      <FormField
        label="Faculty coordinator (optional)"
        value={v.facultyCoordinator}
        onChange={set('facultyCoordinator')}
      />
      <Button type="submit" disabled={busy}>
        {busy ? 'Saving...' : submitLabel}
      </Button>
    </form>
  );
}
