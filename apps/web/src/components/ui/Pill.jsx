const TONES = {
  approved: 'ok',
  active: 'ok',
  open: 'ok',
  confirmed: 'ok',
  registered: 'ok',
  pending: 'warn',
  submitted: 'warn',
  draft: '',
  changes_requested: 'warn',
  tentative: 'warn',
  rejected: 'bad',
  cancelled: 'bad',
  denied: 'bad',
  suspended: 'bad',
};

/** Status pill: coloured dot AND a text label, so status is never shown by colour alone (NFR-03). */
export function Pill({ status, children }) {
  const tone = TONES[status] ?? '';
  const label = children ?? status.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase());
  return <span className={`pill ${tone ? `pill-${tone}` : ''}`.trim()}>{label}</span>;
}
