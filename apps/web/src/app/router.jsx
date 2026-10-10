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
import { PublicEventPage } from '../pages/PublicEventPage.jsx';
import { NotFound } from '../pages/NotFound.jsx';
import { ClubsPage } from '../features/student/ClubsPage.jsx';
import { ClubPage } from '../features/student/ClubPage.jsx';
import { EventsPage } from '../features/student/EventsPage.jsx';
import { EventDetailPage } from '../features/student/EventDetailPage.jsx';
import { ActivitiesPage, FavouritesPage } from '../features/student/StudentPages.jsx';
import { MyClubsPage } from '../features/student/MyClubsPage.jsx';
import { ClubDashboard } from '../features/club/ClubDashboard.jsx';
import { ClubEventsPage, ClubRegistrationsPage, NewEventPage } from '../features/club/ClubEventsPages.jsx';
import { EventWorkspace } from '../features/club/EventWorkspace.jsx';
import {
  ClubAnnouncementsPage,
  ClubDiscussionPage,
  ClubProfilePage,
  ClubReportsPage,
} from '../features/club/ClubContentPages.jsx';
import { ClubRecruitmentPage } from '../features/club/ClubRecruitmentPage.jsx';
import { MembersPage } from '../features/club/MembersPage.jsx';
import {
  ApprovalReviewPage,
  ApprovalsPage,
  OsiClubsPage,
  OsiReportsPage,
} from '../features/osi/OsiPages.jsx';
import {
  AvailabilityPage,
  HallRequestsPage,
  HallsPage,
  HoldsPage,
} from '../features/events-admin/HallAdminPages.jsx';
import { AuditPage, SystemSettingsPage, UsersPage } from '../features/admin/AdminPages.jsx';
import { ProfilePage } from '../features/shared/ProfilePage.jsx';
import { SettingsPage } from '../features/shared/SettingsPage.jsx';
import { CalendarPage } from '../features/shared/CalendarPage.jsx';
import { NotificationsPage } from '../features/shared/NotificationsPage.jsx';

function Home() {
  const { platformRole, memberships } = useAuth();
  return <Navigate to={landingPath({ platformRole, memberships })} replace />;
}

export function AppRoutes() {
  return (
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
          <Route path="events-admin" element={<RequirePlatformRole roles={[PLATFORM_ROLES.EVENTS_ADMIN]} />}>
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
  );
}
