import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from '../auth/AuthContext.jsx';

export const makeQueryClient = () =>
  new QueryClient({
    defaultOptions: { queries: { retry: false, refetchOnWindowFocus: false, staleTime: 30_000 } },
  });

const routerFuture = { v7_startTransition: true, v7_relativeSplatPath: true };
const DefaultRouter = ({ children }) => <BrowserRouter future={routerFuture}>{children}</BrowserRouter>;

export function Providers({ children, router: Router = DefaultRouter, client = makeQueryClient() }) {
  return (
    <QueryClientProvider client={client}>
      <Router>
        <AuthProvider>{children}</AuthProvider>
      </Router>
    </QueryClientProvider>
  );
}
