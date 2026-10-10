import { useId, useRef } from 'react';

/**
 * Accessible tabs. `tabs` is [{ id, label, hidden?, disabled?, hint? }]; hidden tabs are not rendered, disabled
 * ones explain themselves with a tooltip (FR-CW-03). Arrow keys move between tabs.
 */
export function Tabs({ tabs, value, onChange, children }) {
  const uid = useId();
  const refs = useRef({});
  const visible = tabs.filter((t) => !t.hidden);
  const onKey = (e, i) => {
    const dir = { ArrowRight: 1, ArrowLeft: -1 }[e.key];
    if (!dir) return;
    e.preventDefault();
    const next = visible[(i + dir + visible.length) % visible.length];
    if (!next.disabled) {
      onChange(next.id);
      refs.current[next.id]?.focus();
    }
  };
  return (
    <div className="stack">
      <div role="tablist" className="tabs" aria-label="Sections">
        {visible.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => (refs.current[t.id] = el)}
            role="tab"
            id={`${uid}-tab-${t.id}`}
            aria-selected={value === t.id}
            aria-controls={`${uid}-panel-${t.id}`}
            aria-disabled={t.disabled || undefined}
            title={t.disabled ? t.hint : undefined}
            tabIndex={value === t.id ? 0 : -1}
            className="tab"
            onClick={() => !t.disabled && onChange(t.id)}
            onKeyDown={(e) => onKey(e, i)}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${uid}-panel-${value}`} aria-labelledby={`${uid}-tab-${value}`} tabIndex={0}>
        {children}
      </div>
    </div>
  );
}
