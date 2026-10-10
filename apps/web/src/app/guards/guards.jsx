import { Navigate, Outlet, useLocation, useParams } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext.jsx';
import { Skeleton } from '../../components/ui/Skeleton.jsx';
import { AccessDenied } from '../../pages/AccessDenied.jsx';

/** Guards are for experience only; the server decides (spec 6.6). */
export function RequireAuth() {
  const { status, mustChangePassword } = useAuth();
  const location = useLocation();
  if (status === 'loading')
    return (
      <div className="content">
        <Skeleton />
      </div>
    );
  if (status !== 'authenticated') return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  if (mustChangePassword && location.pathname !== '/change-password')
    return <Navigate to="/change-password" replace />;
  return <Outlet />;
}

export function RequirePlatformRole({ roles }) {
  const { hasPlatformRole } = useAuth();
  return hasPlatformRole(...roles) ? <Outlet /> : <AccessDenied />;
}

/** Needs an active membership of :clubId, and optionally a permission in that club. */
export function RequireClubPermission({ permission }) {
  const { clubId } = useParams();
  const { membershipFor, can } = useAuth();
  if (!membershipFor(clubId)) return <AccessDenied />;
  if (permission && !can(permission, clubId)) return <AccessDenied />;
  return <Outlet />;
}

/** Hides children when the current club role lacks the permission (spec 13.3). */
export function PermissionGate({ permission, clubId, fallback = null, children }) {
  const { can } = useAuth();
  return can(permission, clubId) ? children : fallback;
}
