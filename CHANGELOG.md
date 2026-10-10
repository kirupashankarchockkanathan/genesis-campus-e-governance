# Changelog

All notable changes, newest first. One line per completed task (spec section 0, rule 9).

## 1.0.0 (all phases of the spec)

### Phases 1 to 4

- Start screen with three logins: Student, Club Member, Administrator.
- Bigger club cards and club hero page; event cards with media, date badge and seat bar; event hero with fact tiles.
- Events, OSI approvals, tentative holds, final hall requests, forms and registration, QR tickets and check-in, waitlist, team and file fields, calendar and ICS feed, notifications with SSE and email copies, announcements, recruitment, discussions, custom roles, reports, Super Admin tools.
- Chatbot grounded in portal data with the official Anthropic SDK, with extractive fallback.
- PWA, lazy routes, error boundary, purpose-bound tokens, security and performance tests, axe and contrast tests.
- Playwright journeys E2E-01 to 09, Husky pre-commit hook, user guide, deployment guide, demo data.
- Tests: shared 10, API 175, web 46, end-to-end 10.

## Phase 0 (foundations)

### Phase 0: Foundations

- Seed the team's club directory (26 clubs) with default roles; sample Leader/Vice/Secretary/Coordinator/Media/Member accounts in Hut Labs.
- Web: red and white design tokens (light and dark), `AppShell`, sidebar per role, bottom tab bar on phones, route guards, `AuthContext`, API client with refresh, login, signup, verify, forgot, reset and forced change-password screens, clubs list page, My Clubs, club dashboard, members page, profile.
- Web tests TC-UI-01 to 04 (16 tests).
- API: auth module (sign-up, verification, login with brute-force limit, refresh rotation with reuse detection, logout, forgot/reset, change password, `/me`, profile edit).
- API: RBAC middleware (`requireAuth`, `requirePlatformRole`, `requireClubPermission`), deny by default, permissions read from the database on every request.
- API: clubs (list, detail, OSI create with default roles and Leader), members (add, change role, remove/leave, atomic leadership transfer, one active Leader).
- API: token clean-up job, health check, helmet, strict CORS, request id, stable error codes.
- Database: migrations for users, auth tokens, refresh tokens, clubs, club roles, role permissions, club members, favourites, audit logs, halls; idempotent seeds for halls, clubs, admins and sample data.
- Tests: API 55 (17 database, 21 auth, 17 RBAC and clubs), shared 10, web 16 = 81 passing on SQLite.
- Shared package: permissions and role matrix, statuses with event transitions, error codes, constants, Zod auth schemas.
- Repository scaffold: npm workspaces, ESLint, Prettier, `.env.example`, `CLAUDE.md`, CI workflow, optional PostgreSQL compose file, project spec in `docs/`.
