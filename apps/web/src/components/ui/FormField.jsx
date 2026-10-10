import { forwardRef, useId } from 'react';

/** Label + input + help + error, wired for screen readers. Forwards the ref so react-hook-form's register() works. */
export const FormField = forwardRef(function FormField(
  { label, help, error, as = 'input', children, ...inputProps },
  ref,
) {
  const id = useId();
  const helpId = help ? `${id}-help` : undefined;
  const errId = error ? `${id}-err` : undefined;
  const describedBy = [helpId, errId].filter(Boolean).join(' ') || undefined;
  const common = { id, ref, 'aria-invalid': error ? 'true' : undefined, 'aria-describedby': describedBy };
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {as === 'select' ? (
        <select className="select" {...common} {...inputProps}>
          {children}
        </select>
      ) : (
        <input className="input" {...common} {...inputProps} />
      )}
      {help && (
        <span id={helpId} className="help">
          {help}
        </span>
      )}
      {error && (
        <span id={errId} className="error" role="alert">
          {error}
        </span>
      )}
    </div>
  );
});
