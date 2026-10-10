import { Button } from '../components/ui/Button.jsx';
import { EmptyState } from '../components/ui/EmptyState.jsx';

export const NotFound = () => (
  <div className="content">
    <EmptyState title="Page not found">The page you are looking for does not exist.</EmptyState>
    <div className="center">
      <Button to="/">Back to home</Button>
    </div>
  </div>
);
