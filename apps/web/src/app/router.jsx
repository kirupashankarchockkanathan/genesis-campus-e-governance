import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import { PERMISSIONS, PLATFORM_ROLES } from '@ccp/shared';
import { useAuth } from '../auth/AuthContext.jsx';
import { landingPath } from '../utils/navigation.js';
import { RequireAuth, RequireClubPermission, RequirePlatformRole } from './guards/guards.jsx';
import { Skeleton } from '../components/ui/Skeleton.jsx';
import { AppShell } from '../components/layout/AppShell.jsx';
import { LoginPage } from '../pages/LoginPage.jsx';
import { SignupPage } from '../pages/SignupPage.jsx';
import { VerifyEmailPage } from '../pages/VerifyEmailPage.jsx';
import { ForgotPasswordPage } from '../pages/ForgotPasswordPage.jsx';
import { ResetPasswordPage } from '../pages/ResetPasswordPage.jsx';
import { ChangePasswordPage } from '../pages/ChangePasswordPage.jsx';
import { NotFound } from '../pages/NotFound.jsx';

// Screens load on demand so the first page stays small (Phase 4 performance pass).
const ClubsPage = lazy(() =>
  import('../features/student/ClubsPage.jsx').then((m) => ({ default: m.ClubsPage })),
);
const ClubPage = lazy(() =>
  import('../features/student/ClubPage.jsx').then((m) => ({ default: m.ClubPage })),
);
const EventsPage = lazy(() =>
  import('../features/student/EventsPage.jsx').then((m) => ({ default: m.EventsPage })),
);
const EventDetailPage = lazy(() =>
  import('../features/student/EventDetailPage.jsx').then((m) => ({ default: m.EventDetailPage })),
);
const ActivitiesPage = lazy(() =>
  import('../features/student/StudentPages.jsx').then((m) => ({ default: m.ActivitiesPage })),
);
const FavouritesPage = lazy(() =>
  import('../features/student/StudentPages.jsx').then((m) => ({ default: m.FavouritesPage })),
);
const MyClubsPage = lazy(() =>
  import('../features/student/MyClubsPage.jsx').then((m) => ({ default: m.MyClubsPage })),
);
const ClubDashboard = lazy(() =>
  import('../features/club/ClubDashboard.jsx').then((m) => ({ default: m.ClubDashboard })),
);
const ClubEventsPage = lazy(() =>
  import('../features/club/ClubEventsPages.jsx').then((m) => ({ default: m.ClubEventsPage })),
);
const ClubRegistrationsPage = lazy(() =>
  import('../features/club/ClubEventsPages.jsx').then((m) => ({ default: m.ClubRegistrationsPage })),
);
const NewEventPage = lazy(() =>
  import('../features/club/ClubEventsPages.jsx').then((m) => ({ default: m.NewEventPage })),
);
const EventWorkspace = lazy(() =>
  import('../features/club/EventWorkspace.jsx').then((m) => ({ default: m.EventWorkspace })),
);
const ClubAnnouncementsPage = lazy(() =>
  import('../features/club/ClubContentPages.jsx').then((m) => ({ default: m.ClubAnnouncementsPage })),
);
const ClubDiscussionPage = lazy(() =>
  import('../features/club/ClubContentPages.jsx').then((m) => ({ default: m.ClubDiscussionPage })),
);
const ClubProfilePage = lazy(() =>
  import('../features/club/ClubContentPages.jsx').then((m) => ({ default: m.ClubProfilePage })),
);
const ClubReportsPage = lazy(() =>
  import('../features/club/ClubContentPages.jsx').then((m) => ({ default: m.ClubReportsPage })),
);
const ClubRecruitmentPage = lazy(() =>
  import('../features/club/ClubRecruitmentPage.jsx').then((m) => ({ default: m.ClubRecruitmentPage })),
);
const MembersPage = lazy(() =>
  import('../features/club/MembersPage.jsx').then((m) => ({ default: m.MembersPage })),
);
const ApprovalReviewPage = lazy(() =>
  import('../features/osi/OsiPages.jsx').then((m) => ({ default: m.ApprovalReviewPage })),
);
const ApprovalsPage = lazy(() =>
  import('../features/osi/OsiPages.jsx').then((m) => ({ default: m.ApprovalsPage })),
);
const OsiClubsPage = lazy(() =>
  import('../features/osi/OsiPages.jsx').then((m) => ({ default: m.OsiClubsPage })),
);
const OsiReportsPage = lazy(() =>
  import('../features/osi/OsiPages.jsx').then((m) => ({ default: m.OsiReportsPage })),
);
const AvailabilityPage = lazy(() =>
  import('../features/events-admin/HallAdminPages.jsx').then((m) => ({ default: m.AvailabilityPage })),
);
const HallRequestsPage = lazy(() =>
  import('../features/events-admin/HallAdminPages.jsx').then((m) => ({ default: m.HallRequestsPage })),
);
const HallsPage = lazy(() =>
  import('../features/events-admin/HallAdminPages.jsx').then((m) => ({ default: m.HallsPage })),
);
const HoldsPage = lazy(() =>
  import('../features/events-admin/HallAdminPages.jsx').then((m) => ({ default: m.HoldsPage })),
);
const AuditPage = lazy(() =>
  import('../features/admin/AdminPages.jsx').then((m) => ({ default: m.AuditPage })),
);
const SystemSettingsPage = lazy(() =>
  import('../features/admin/AdminPages.jsx').then((m) => ({ default: m.SystemSettingsPage })),
);
const UsersPage = lazy(() =>
  import('../features/admin/AdminPages.jsx').then((m) => ({ default: m.UsersPage })),
);
const ProfilePage = lazy(() =>
  import('../features/shared/ProfilePage.jsx').then((m) => ({ default: m.ProfilePage })),
);
const SettingsPage = lazy(() =>
  import('../features/shared/SettingsPage.jsx').then((m) => ({ default: m.SettingsPage })),
);
const CalendarPage = lazy(() =>
  import('../features/shared/CalendarPage.jsx').then((m) => ({ default: m.CalendarPage })),
);
const NotificationsPage = lazy(() =>
  import('../features/shared/NotificationsPage.jsx').then((m) => ({ default: m.NotificationsPage })),
);
const PublicEventPage = lazy(() =>
  import('../pages/PublicEventPage.jsx').then((m) => ({ default: m.PublicEventPage })),
);

function Home() {
  const { platformRole, memberships } = useAuth();
  return <Navigate to={landingPath({ platformRole, memberships })} replace />;
}

export function AppRoutes() {
  return (
    <Suspense
      fallback={
        <div className="content">
          <Skeleton />
        </div>
      }
    >
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/e/:id" element={<PublicEventPage />} />
        <Route path="/change-password" element={<RequireAuth />}>
          <Route index element={<ChangePasswordPage />} />
        </Route>

        <Route element={<RequireAuth />}>
          <Route element={<AppShell />}>
            <Route index element={<Home />} />
            {/* Student */}
            <Route path="clubs" element={<ClubsPage />} />
            <Route path="clubs/:slug" element={<ClubPage />} />
            <Route path="events" element={<EventsPage />} />
            <Route path="events/:id" element={<EventDetailPage />} />
            <Route path="favourites" element={<FavouritesPage />} />
            <Route path="my-clubs" element={<MyClubsPage />} />
            <Route path="activities" element={<ActivitiesPage />} />
            <Route path="calendar" element={<CalendarPage />} />
            <Route path="notifications" element={<NotificationsPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="settings" element={<SettingsPage />} />

            {/* Club workspace: membership required, then per-screen permission */}
            <Route path="club/:clubId" element={<RequireClubPermission />}>
              <Route index element={<ClubDashboard />} />
              <Route path="events" element={<ClubEventsPage />} />
              <Route element={<RequireClubPermission permission={PERMISSIONS.EVENT_DRAFT} />}>
                <Route path="events/new" element={<NewEventPage />} />
              </Route>
              <Route path="events/:eventId" element={<EventWorkspace />} />
              <Route element={<RequireClubPermission permission={PERMISSIONS.ANNOUNCEMENT_POST} />}>
                <Route path="announcements" element={<ClubAnnouncementsPage />} />
              </Route>
              <Route path="recruitment" element={<ClubRecruitmentPage />} />
              <Route path="members" element={<MembersPage />} />
              <Route element={<RequireClubPermission permission={PERMISSIONS.REGISTRATION_VIEW} />}>
                <Route path="registrations" element={<ClubRegistrationsPage />} />
              </Route>
              <Route element={<RequireClubPermission permission={PERMISSIONS.REPORT_VIEW} />}>
                <Route path="reports" element={<ClubReportsPage />} />
              </Route>
              <Route path="discussion" element={<ClubDiscussionPage />} />
              <Route path="profile" element={<ClubProfilePage />} />
            </Route>

            {/* OSI */}
            <Route path="osi" element={<RequirePlatformRole roles={[PLATFORM_ROLES.OSI_ADMIN]} />}>
              <Route path="approvals" element={<ApprovalsPage />} />
              <Route path="approvals/:eventId" element={<ApprovalReviewPage />} />
              <Route path="clubs" element={<OsiClubsPage />} />
              <Route path="reports" element={<OsiReportsPage />} />
            </Route>

            {/* Events Authority */}
            <Route
              path="events-admin"
              element={<RequirePlatformRole roles={[PLATFORM_ROLES.EVENTS_ADMIN]} />}
            >
              <Route path="requests" element={<HallRequestsPage />} />
              <Route path="requests/:id" element={<HallRequestsPage />} />
              <Route path="holds" element={<HoldsPage />} />
              <Route path="halls" element={<HallsPage />} />
              <Route path="availability" element={<AvailabilityPage />} />
            </Route>

            {/* Super Admin */}
            <Route path="admin" element={<RequirePlatformRole roles={[PLATFORM_ROLES.SUPER_ADMIN]} />}>
              <Route path="users" element={<UsersPage />} />
              <Route path="audit" element={<AuditPage />} />
              <Route path="settings" element={<SystemSettingsPage />} />
            </Route>
          </Route>
        </Route>

        <Route path="*" element={<NotFound />} />
      </Routes>
    </Suspense>
  );
}
