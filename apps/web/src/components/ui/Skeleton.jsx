export const Skeleton = ({ count = 3 }) => (
  <div className="grid-cards" aria-busy="true" aria-label="Loading">
    {Array.from({ length: count }, (_, i) => (
      <div key={i} className="skeleton" />
    ))}
  </div>
);
