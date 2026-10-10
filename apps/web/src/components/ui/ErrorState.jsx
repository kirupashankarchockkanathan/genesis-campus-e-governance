export const ErrorState = ({ error, onRetry }) => (
  <div className="notice notice-bad" role="alert">
    <p>{error?.message ?? 'Something went wrong.'}</p>
    {onRetry && (
      <button className="btn btn-link" onClick={onRetry}>
        Try again
      </button>
    )}
  </div>
);
