import { useId, useState } from 'react';
import { PROFILE_FIELDS, validateAnswers } from '@ccp/shared';
import { apiUpload } from '../../api/client.js';
import { Button } from '../ui/Button.jsx';

function Field({ field, value, error, onChange, disabled }) {
  const id = useId();
  const describedBy = [field.help && `${id}-h`, error && `${id}-e`].filter(Boolean).join(' ') || undefined;
  const common = {
    id,
    disabled,
    'aria-invalid': error ? 'true' : undefined,
    'aria-describedby': describedBy,
  };
  const label = (
    <label htmlFor={id}>
      {field.label}
      {field.required && <span aria-hidden="true"> *</span>}
      {field.required && <span className="visually-hidden"> (required)</span>}
    </label>
  );
  let control;
  switch (field.type) {
    case 'long_text':
      control = (
        <textarea
          className="input textarea"
          rows={4}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
      break;
    case 'number':
      control = (
        <input
          className="input"
          type="number"
          min={field.min}
          max={field.max}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
      break;
    case 'email':
    case 'phone':
      control = (
        <input
          className="input"
          type={field.type === 'email' ? 'email' : 'tel'}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
      break;
    case 'date':
      control = (
        <input
          className="input"
          type="date"
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          {...common}
        />
      );
      break;
    case 'dropdown':
      control = (
        <select className="select" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common}>
          <option value="">Select</option>
          {field.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      );
      break;
    case 'single_choice':
      return (
        <fieldset className="field" aria-describedby={describedBy} disabled={disabled}>
          <legend>
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
          </legend>
          {field.options.map((o) => (
            <label key={o} className="check">
              <input type="radio" name={id} checked={value === o} onChange={() => onChange(o)} /> {o}
            </label>
          ))}
          <Help id={id} field={field} error={error} />
        </fieldset>
      );
    case 'multi_choice':
      return (
        <fieldset className="field" aria-describedby={describedBy} disabled={disabled}>
          <legend>
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
          </legend>
          {field.options.map((o) => (
            <label key={o} className="check">
              <input
                type="checkbox"
                checked={(value ?? []).includes(o)}
                onChange={(e) =>
                  onChange(e.target.checked ? [...(value ?? []), o] : (value ?? []).filter((x) => x !== o))
                }
              />{' '}
              {o}
            </label>
          ))}
          <Help id={id} field={field} error={error} />
        </fieldset>
      );
    case 'consent':
      return (
        <div className="field">
          <label className="check">
            <input
              type="checkbox"
              checked={Boolean(value)}
              onChange={(e) => onChange(e.target.checked)}
              {...common}
            />{' '}
            {field.label}
            {field.required && <span aria-hidden="true"> *</span>}
          </label>
          <Help id={id} field={field} error={error} />
        </div>
      );
    case 'file_upload':
      control = <FileField field={field} value={value} onChange={onChange} common={common} />;
      break;
    case 'team':
      control = <TeamField field={field} value={value} onChange={onChange} common={common} />;
      break;
    default:
      control = (
        <input className="input" value={value ?? ''} onChange={(e) => onChange(e.target.value)} {...common} />
      );
  }
  return (
    <div className="field">
      {label}
      {control}
      <Help id={id} field={field} error={error} />
    </div>
  );
}

const Help = ({ id, field, error }) => (
  <>
    {field.help && (
      <span id={`${id}-h`} className="help">
        {field.help}
      </span>
    )}
    {error && (
      <span id={`${id}-e`} className="error" role="alert">
        {error}
      </span>
    )}
  </>
);

function FileField({ value, onChange, common }) {
  const [state, setState] = useState({ busy: false, error: '' });
  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setState({ busy: true, error: '' });
    try {
      const fd = new FormData();
      fd.append('file', file);
      const r = await apiUpload('/uploads/form-file', fd);
      onChange(r.url);
      setState({ busy: false, error: '' });
    } catch (err) {
      setState({ busy: false, error: err.message });
    }
  };
  return (
    <div className="stack-sm">
      <input type="file" accept=".png,.jpg,.jpeg,.webp,.pdf" onChange={pick} {...common} />
      {state.busy && <span role="status">Uploading...</span>}
      {value && <span className="small">Uploaded: {value.split('/').pop()}</span>}
      {state.error && (
        <span className="error" role="alert">
          {state.error}
        </span>
      )}
    </div>
  );
}

function TeamField({ field, value, onChange, common }) {
  const v = value ?? { teamName: '', members: [] };
  const size = field.max ?? 4;
  return (
    <div className="stack-sm">
      <input
        className="input"
        placeholder="Team name"
        value={v.teamName}
        onChange={(e) => onChange({ ...v, teamName: e.target.value })}
        {...common}
      />
      <textarea
        className="input textarea"
        rows={3}
        placeholder={`Teammates' college emails, one per line (up to ${size - 1})`}
        value={v.members.join('\n')}
        onChange={(e) => onChange({ ...v, members: e.target.value.split('\n') })}
        aria-label="Team member emails"
      />
    </div>
  );
}

/**
 * Renders a form definition and validates it with the same shared rules as the API (FR-REG-01).
 * Profile fields (name, email, roll number, department, year) are filled from the profile, read-only (FR-FORM-04).
 * With `preview` the form is shown but cannot be submitted.
 */
export function FormRenderer({
  fields,
  profile,
  onSubmit,
  submitLabel = 'Submit',
  busy = false,
  serverErrors = {},
  preview = false,
}) {
  const [answers, setAnswers] = useState({});
  const [errors, setErrors] = useState({});
  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }));
  const shown = { ...errors, ...serverErrors };

  const submit = (e) => {
    e.preventDefault();
    if (preview) return;
    const r = validateAnswers(fields, answers);
    setErrors(r.errors);
    if (r.ok) onSubmit(answers);
  };

  return (
    <form className="stack" onSubmit={submit} noValidate aria-label="Form">
      {profile && (
        <fieldset className="profile-block">
          <legend>From your profile</legend>
          <dl className="profile-grid">
            {PROFILE_FIELDS.map((p) => (
              <div key={p.key}>
                <dt className="muted small">{p.label}</dt>
                <dd>{profile[p.key] ?? '-'}</dd>
              </div>
            ))}
          </dl>
        </fieldset>
      )}
      {fields.map((f) => (
        <Field
          key={f.id}
          field={f}
          value={answers[f.id]}
          error={shown[f.id]}
          onChange={(v) => set(f.id, v)}
          disabled={busy}
        />
      ))}
      {!preview && (
        <Button type="submit" disabled={busy}>
          {busy ? 'Sending...' : submitLabel}
        </Button>
      )}
    </form>
  );
}
