/** Club initials avatar. */
export function Avatar({ name }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');
  return (
    <span className="avatar" aria-hidden="true">
      {initials}
    </span>
  );
}
