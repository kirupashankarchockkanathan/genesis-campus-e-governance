import { useMemo, useState } from 'react';
import { CHOICE_TYPES, FIELD_TYPES, FIELD_TYPE_LABELS, formFieldsSchema } from '@ccp/shared';
import { Button } from '../ui/Button.jsx';
import { FormField } from '../ui/FormField.jsx';
import { FormRenderer } from './FormRenderer.jsx';

const newId = (fields) => {
  let i = fields.length + 1;
  while (fields.some((f) => f.id === `f${i}`)) i += 1;
  return `f${i}`;
};
const blank = (type, fields) => ({
  id: newId(fields),
  type,
  label: FIELD_TYPE_LABELS[type],
  help: '',
  required: false,
  ...(CHOICE_TYPES.includes(type) && { options: ['Option 1', 'Option 2'] }),
});

/** Reorder is button based so it is keyboard accessible, not drag only (spec 13.5). */
export function validateFields(fields) {
  const r = formFieldsSchema.safeParse(fields);
  if (r.success) return [];
  return r.error.issues.map((i) => ({ index: i.path[0], message: i.message }));
}

/**
 * Left: field palette. Centre: live preview with the same FormRenderer students use. Right: field settings.
 * `fields` and `onChange` are controlled by the parent, which owns saving.
 */
export function FormBuilder({ fields, onChange }) {
  const [selected, setSelected] = useState(fields[0]?.id ?? null);
  const issues = useMemo(() => validateFields(fields), [fields]);
  const current = fields.find((f) => f.id === selected);
  const update = (id, patch) => onChange(fields.map((f) => (f.id === id ? { ...f, ...patch } : f)));
  const move = (i, dir) => {
    const next = [...fields];
    const j = i + dir;
    if (j < 0 || j >= next.length) return;
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next);
  };
  const add = (type) => {
    const f = blank(type, fields);
    onChange([...fields, f]);
    setSelected(f.id);
  };
  const duplicate = (i) => {
    const copy = { ...fields[i], id: newId(fields), label: `${fields[i].label} (copy)` };
    const next = [...fields];
    next.splice(i + 1, 0, copy);
    onChange(next);
    setSelected(copy.id);
  };
  const remove = (i) => {
    const next = fields.filter((_, k) => k !== i);
    onChange(next);
    setSelected(next[Math.min(i, next.length - 1)]?.id ?? null);
  };

  return (
    <div className="builder">
      <section className="builder-col" aria-label="Field types">
        <h3>Add a field</h3>
        <div className="stack-sm">
          {FIELD_TYPES.map((t) => (
            <button key={t} type="button" className="btn btn-secondary" onClick={() => add(t)}>
              + {FIELD_TYPE_LABELS[t]}
            </button>
          ))}
        </div>
      </section>

      <section className="builder-col builder-preview" aria-label="Preview">
        <h3>Preview</h3>
        <ol className="field-list">
          {fields.map((f, i) => (
            <li key={f.id} className={`field-row ${selected === f.id ? 'selected' : ''}`}>
              <button
                type="button"
                className="field-pick"
                onClick={() => setSelected(f.id)}
                aria-pressed={selected === f.id}
              >
                <strong>{f.label || '(no label)'}</strong>
                <span className="muted small">
                  {FIELD_TYPE_LABELS[f.type]}
                  {f.required ? ', required' : ''}
                </span>
              </button>
              <div className="row" role="group" aria-label={`Actions for ${f.label}`}>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  aria-label={`Move ${f.label} up`}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => move(i, 1)}
                  disabled={i === fields.length - 1}
                  aria-label={`Move ${f.label} down`}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => duplicate(i)}
                  aria-label={`Duplicate ${f.label}`}
                >
                  ⧉
                </button>
                <button
                  type="button"
                  className="icon-btn"
                  onClick={() => remove(i)}
                  aria-label={`Delete ${f.label}`}
                >
                  🗑
                </button>
              </div>
            </li>
          ))}
        </ol>
        {fields.length === 0 && (
          <p className="muted">No custom questions yet. Students only fill the profile fields.</p>
        )}
        <div className="preview-box">
          <FormRenderer
            fields={fields.filter((f) => !validateFields([f]).length)}
            profile={{}}
            onSubmit={() => {}}
            preview
          />
        </div>
      </section>

      <section className="builder-col" aria-label="Field settings">
        <h3>Settings</h3>
        {issues.length > 0 && (
          <ul className="notice notice-bad" role="alert">
            {issues.map((i, k) => (
              <li key={k}>
                {typeof i.index === 'number' ? `${fields[i.index]?.label || `Field ${i.index + 1}`}: ` : ''}
                {i.message}
              </li>
            ))}
          </ul>
        )}
        {current ? (
          <div className="stack">
            <FormField
              label="Label"
              value={current.label}
              onChange={(e) => update(current.id, { label: e.target.value })}
            />
            <FormField
              label="Help text"
              value={current.help ?? ''}
              onChange={(e) => update(current.id, { help: e.target.value })}
            />
            <label className="check">
              <input
                type="checkbox"
                checked={current.required}
                onChange={(e) => update(current.id, { required: e.target.checked })}
              />{' '}
              Required
            </label>
            {CHOICE_TYPES.includes(current.type) && (
              <div className="field">
                <label htmlFor="opts">Options (one per line, at least two)</label>
                <textarea
                  id="opts"
                  className="input textarea"
                  rows={4}
                  value={(current.options ?? []).join('\n')}
                  onChange={(e) => update(current.id, { options: e.target.value.split('\n') })}
                />
              </div>
            )}
            {current.type === 'number' && (
              <div className="row">
                <FormField
                  label="Minimum"
                  type="number"
                  value={current.min ?? ''}
                  onChange={(e) =>
                    update(current.id, { min: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                />
                <FormField
                  label="Maximum"
                  type="number"
                  value={current.max ?? ''}
                  onChange={(e) =>
                    update(current.id, { max: e.target.value === '' ? undefined : Number(e.target.value) })
                  }
                />
              </div>
            )}
            {current.type === 'team' && (
              <FormField
                label="Team size (including the registrant)"
                type="number"
                value={current.max ?? 4}
                onChange={(e) => update(current.id, { max: Number(e.target.value) || 4 })}
              />
            )}
            {['short_text', 'long_text'].includes(current.type) && (
              <FormField
                label="Maximum length"
                type="number"
                value={current.maxLength ?? ''}
                onChange={(e) =>
                  update(current.id, {
                    maxLength: e.target.value === '' ? undefined : Number(e.target.value),
                  })
                }
              />
            )}
            <Button variant="secondary" onClick={() => setSelected(null)}>
              Done
            </Button>
          </div>
        ) : (
          <p className="muted">Select a field to edit it.</p>
        )}
      </section>
    </div>
  );
}
