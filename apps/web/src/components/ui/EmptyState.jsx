export const EmptyState = ({ title, children }) => (
  <div className="empty card" role="status">
    <h2>{title}</h2>
    {children && <p>{children}</p>}
  </div>
);
