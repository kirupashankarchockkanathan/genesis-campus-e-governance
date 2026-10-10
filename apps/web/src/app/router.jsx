import { Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS, PLATFORM_ROLES } from '@ccp/shared';
import { useAuth } from '../auth/AuthContext.jsx';
import { landingPath } from '../utils/navigation.js';
import { RequireAuth, RequireClubPermission, RequirePlatformRole } from './guards/guards.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SignupPage } from '../pages/SignupPage.jsx';
import { VerifyEmailPage } from '../pages/VerifyEmailPage.jsx';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.jsx';
import { ChangePasswordPage } from '../pages/ChangePasswordPage.jsx';
import { NotFound } from '../pages/NotFound.jsx';
import { ClubsPage } from '../features/student/ClubsPage.jsx';
import { MyClubsPage } from '../features/student/MyClubsPage.jsx';
import { ClubDashboard } from '../features/club/ClubDashboard.jsx';
import { MembersPage } from '../features/club/MembersPage.jsx';
import { ProfilePage } from '../features/shared/ProfilePage.jsx';
import { ComingSoon } from '../features/shared/ComingSoon.jsx';

function Home() {
  const { platformRole, memberships } = useAuth();
  return <Navigate to={landingPath({ platformRole, memberships })} replace />;
}

const soon = (title, description, phase) => (
  <ComingSoon title={title} description={description} phase={phase} />
);

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/verify-email" element={<VerifyEmailPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/reset-password" element={<ResetPasswordPage />} />
      <Route path="/change-password" element={<RequireAuth />}>
        <Route index element={<ChangePasswordPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<Home />} />
          {/* Student */}
          <Route path="clubs" element={<ClubsPage />} />
          <Route path="events" element={soon('Events', 'All approved events across campus.')} />
          <Route
            path="favourites"
            element={soon('Favourites', 'Your favourite clubs and their latest updates.', 'Phase 2')}
          />
          <Route path="my-clubs" element={<MyClubsPage />} />
          <Route path="activities" element={soon('Activities', 'Your registrations and applications.')} />
          <Route
            path="calendar"
            element={soon('Calendar', 'Every approved event, deadline and recruitment.')}
          />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={soon('Settings', 'Password, notifications and theme.')} />

          {/* Club workspace: membership required, then per-screen permission */}
          <Route path="club/:clubId" element={<RequireClubPermission />}>
            <Route index element={<ClubDashboard />} />
            <Route path="events" element={soon('Club events', 'Your club events and their status.')} />
            <Route element={<RequireClubPermission permission={PERMISSIONS.EVENT_DRAFT} />}>
              <Route path="events/new" element={soon('Add an event', 'Draft a new event plan.')} />
            </Route>
            <Route element={<RequireClubPermission permission={PERMISSIONS.ANNOUNCEMENT_POST} />}>
              <Route
                path="announcements"
                element={soon('Announcements', 'Post and manage club announcements.')}
              />
            </Route>
            <Route
              path="recruitment"
              element={soon('Recruitment', 'Open recruitments and review applications.', 'Phase 2')}
            />
            <Route path="members" element={<MembersPage />} />
            <Route element={<RequireClubPermission permission={PERMISSIONS.REGISTRATION_VIEW} />}>
              <Route
                path="registrations"
                element={soon('Registrations', 'Registration lists and CSV export.')}
              />
            </Route>
            <Route element={<RequireClubPermission permission={PERMISSIONS.REPORT_VIEW} />}>
              <Route path="reports" element={soon('Reports', 'Club statistics.', 'Phase 2')} />
            </Route>
            <Route path="discussion" element={soon('Discussion', 'Internal member discussion.', 'Phase 2')} />
            <Route path="profile" element={soon('Club profile', 'Edit the club page.')} />
          </Route>

          {/* OSI */}
          <Route path="osi" element={<RequirePlatformRole roles={[PLATFORM_ROLES.OSI_ADMIN]} />}>
            <Route path="approvals" element={soon('Approvals', 'Event plans waiting for a decision.')} />
            <Route path="clubs" element={soon('Clubs', 'Create and manage clubs.')} />
            <Route path="reports" element={soon('Reports', 'Content reports.', 'Phase 3')} />
          </Route>

          {/* Events Authority */}
          <Route path="events-admin" element={<RequirePlatformRole roles={[PLATFORM_ROLES.EVENTS_ADMIN]} />}>
            <Route
              path="requests"
              element={soon('Hall requests', 'Final hall requests waiting for a decision.')}
            />
            <Route path="holds" element={soon('Holds', 'Tentative hall holds.')} />
            <Route path="halls" element={soon('Halls', 'Manage halls and blocked slots.')} />
            <Route path="availability" element={soon('Availability', 'Hall availability timeline.')} />
          </Route>

          {/* Super Admin */}
          <Route path="admin" element={<RequirePlatformRole roles={[PLATFORM_ROLES.SUPER_ADMIN]} />}>
            <Route path="users" element={soon('Users', 'Create and suspend admin accounts.')} />
            <Route path="audit" element={soon('Audit log', 'Role changes, approvals and hall decisions.')} />
            <Route path="settings" element={soon('System settings', 'System-wide settings.')} />
          </Route>
        </Route>
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
