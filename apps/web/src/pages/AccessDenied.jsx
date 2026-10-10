import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export const AccessDenied = () => (
  <div className="content">
    <EmptyState title="You do not have access">
      This page is not available for your account or club role.
    </EmptyState>
    <div className="center">
      <Button to="/">Go to my home page</Button>
    </div>
  </div>
);
