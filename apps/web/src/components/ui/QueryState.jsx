import { EmptyState } from './EmptyState.jsx';
import { ErrorState } from './ErrorState.jsx';
import { Skeleton } from './Skeleton.jsx';

/**
 * Every list screen has loading, empty and error states (spec 13.4, TC-UI-12).
 * `query` is a TanStack Query result; children render with the data once it is there and not empty.
 */
export function QueryState({
  query,
  emptyTitle = 'Nothing here yet',
  emptyText,
  isEmpty,
  skeleton = 3,
  children,
}) {
  if (query.isLoading) return <Skeleton count={skeleton} />;
  if (query.isError) return <ErrorState error={query.error} onRetry={query.refetch} />;
  const empty = isEmpty ? isEmpty(query.data) : Array.isArray(query.data) && query.data.length === 0;
  if (empty) return <EmptyState title={emptyTitle}>{emptyText}</EmptyState>;
  return children(query.data);
}

/** Inline mutation error. */
export const MutationError = ({ mutation }) =>
  mutation.isError ? (
    <div className="notice notice-bad" role="alert">
      <p>{mutation.error.message}</p>
      {Array.isArray(mutation.error.details) && mutation.error.details.length > 0 && (
        <ul>
          {mutation.error.details.map((d, i) => (
            <li key={i}>{d.message ?? JSON.stringify(d)}</li>
          ))}
        </ul>
      )}
    </div>
  ) : null;
