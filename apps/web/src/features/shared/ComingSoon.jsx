import { PageBanner } from '../../components/layout/PageBanner.jsx';
import { EmptyState } from '../../components/ui/EmptyState.jsx';

/** Placeholder for screens scheduled in a later phase of the build plan (spec section 17). */
export function ComingSoon({ title, description, phase = 'Phase 1' }) {
  return (
    <>
      <PageBanner title={title} description={description} />
      <EmptyState title="Coming soon">This screen is planned for {phase} of the build plan.</EmptyState>
    </>
  );
}
