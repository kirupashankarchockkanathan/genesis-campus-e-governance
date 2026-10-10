# Campus Clubs Portal (genesis-campus-e-governance)

Team **STORMBREAKER**. A unified university portal for club management, event approvals, student registrations, campus notifications and AI-powered assistance. One place where every student can find all campus clubs, register for events, hackathons and recruitments, and where clubs, the OSI and the Events Authority run event approval and hall booking with a visible status at every step.

The full plan is in [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) (also available as `docs/PROJECT_SPEC.docx`). It is the source of truth. This README is the quick start and the live progress checklist.

- Progress log and "where we are": [`docs/CONTEXT.md`](docs/CONTEXT.md)
- Decisions made while building: [`docs/DECISIONS.md`](docs/DECISIONS.md)
- Database diagram: [`docs/ERD.md`](docs/ERD.md)
- Change history: [`CHANGELOG.md`](CHANGELOG.md)
- Rules for Claude: [`CLAUDE.md`](CLAUDE.md)

## Status at a glance

| Phase | Name                                                                     | Status                                                               |
| ----- | ------------------------------------------------------------------------ | -------------------------------------------------------------------- |
| 0     | Foundations                                                              | **Done, pending team review** (branch `feature/phase-0-foundations`) |
| 1     | Core (events, approval, forms, halls, calendar, notifications)           | Not started                                                          |
| 2     | Engagement (recruitment, check-in, discussion, ICS, email, custom roles) | Not started                                                          |
| 3     | Community and assistant (public discussion, chatbot, PWA)                | Not started                                                          |
| 4     | Hardening (accessibility, performance, security, deployment)             | Not started                                                          |

Tests passing today: **81** (API 55, shared 10, web 16), all on SQLite. PostgreSQL parity has **not been run yet** (see [Known gaps](#known-gaps)).

## Stack

React 18 + Vite (`apps/web`), Node 20+ with Express (`apps/api`), shared Zod schemas and constants (`packages/shared`), Knex on SQLite (local and tests) and PostgreSQL (hosted). Own authentication (bcrypt, short-lived JWT access token, rotating opaque refresh token in an httpOnly cookie). Plain JavaScript with ES modules.

Theme: **red and white**, with a deep-red sidebar, a red banner on every page and white cards. All colours are design tokens in [`apps/web/src/styles/tokens.css`](apps/web/src/styles/tokens.css) (light and dark). Components never contain raw colour values.

## Run it locally

Prerequisites: Node 20 or newer, npm 10 or newer, Git. Docker is optional (only for a local PostgreSQL).

```bash
npm install
```

Create your local environment file and fill in the blank password values with your own throwaway values (never commit `.env`):

```bash
cp .env.example .env
```

Set at least `JWT_SECRET` (a long random string), `SEED_SAMPLE_PASSWORD` and the three `SEED_*_PASSWORD` values, and keep `AUTO_VERIFY_EMAIL=true` for development. Then create and seed the database and start both apps:

```bash
npm run db:reset
npm run dev
```

- Web: http://localhost:5173
- API: http://localhost:4000/api/v1/health

Seeded accounts (development only, passwords come from your `.env`): `superadmin@campus.example`, `osi@campus.example`, `events@campus.example` (all three must change their password at first login), and sample students `sample_leader`, `sample_vice`, `sample_secretary`, `sample_coordinator`, `sample_media`, `sample_member` (members of **Hut Labs**, one per club role) and `sample_student` (no club). Sample names are marked "(sample)".

## Commands

| Command                                          | What it does                                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| `npm run dev`                                    | Starts API (4000) and web (5173) together                                                  |
| `npm test`                                       | Shared, API (database, unit, integration) and web component tests on SQLite                |
| `npm run test:pg`                                | Database and API tests against PostgreSQL (needs `DATABASE_URL`, see `docker-compose.yml`) |
| `npm run lint`                                   | ESLint and Prettier check                                                                  |
| `npm run db:migrate` / `db:rollback` / `db:seed` | Migrations and idempotent seeds                                                            |
| `npm run db:reset`                               | Drops, migrates and seeds the local SQLite database                                        |
| `npm run test:e2e`                               | Placeholder until Playwright journeys are added (Phase 1)                                  |

## Repository layout

```
apps/api/            Express API: modules (auth, users, clubs, members), middleware, db (migrations, seeds), jobs, tests
apps/web/            React SPA: app (router, guards), auth, components, features, pages, styles
packages/shared/     Permission keys and role matrix, statuses, error codes, constants, Zod schemas
docs/                Spec, decisions, ERD, context
.github/workflows/   CI (lint + tests on SQLite, DB and API tests on PostgreSQL)
```

## Roles in one minute

Platform roles: `student`, `osi_admin`, `events_admin`, `super_admin`. Inside each club a member holds one of six club roles (Leader, Vice Leader, Secretary, Event Coordinator, Media Lead, Member), each with the permission set in spec section 3.4, defined once in `packages/shared/src/permissions.js`. Every permission check happens on the server and is read from the database on each request; the UI only hides buttons.

## Build checklist

Legend: [x] done and tested, [~] partly done (see note), [ ] not started. This list follows section 17 of the spec.

### Phase 0: Foundations

- [x] Repository, npm workspaces, `.gitignore`, ESLint, Prettier, `CLAUDE.md`, `CHANGELOG.md`
- [ ] Husky pre-commit hook (D28: add before the team starts pushing)
- [x] `packages/shared`: permissions, roles, statuses, errors, constants, first Zod schemas
- [x] API skeleton: config validation, `app.js`, logger, request id, error handler, validation middleware, health check
- [x] Knex for SQLite and PostgreSQL, helpers (`toDb`, `fromDb`), migrations for users, auth tokens, refresh tokens, clubs, club roles, role permissions, club members, audit logs (plus favourites and halls)
- [x] Seeds: halls, clubs with default roles (the team's 26-club directory), admin accounts, sample data
- [x] Auth module: sign-up, verification, login, refresh rotation, logout, forgot and reset, change password, `/me`
- [x] Middleware: `requireAuth`, `requirePlatformRole`, `requireClubPermission`, rate limits
- [x] Web skeleton: tokens (red and white, light and dark), `AppShell`, router, guards, `AuthContext`, API client with refresh, login and signup screens
- [~] CI pipeline running lint and tests on SQLite and PostgreSQL: workflow written in `.github/workflows/ci.yml`, **not yet run** because the repo has no remote yet

Exit tests for Phase 0:

- [x] TC-DB-01 to 07, 13, 16, 17, 27 (also 08, 11, 14, 15, 25, 26, 28)
- [x] TC-AUTH-01 to 19
- [x] TC-RBAC-01 to 05, 09, 10, 13 (also 06, 07, 08, 11, 12)
- [x] TC-UI-01 to 03 (also 04)
- [x] A user can sign up, verify, log in and see the right sidebar for their role (checked in the browser on the local build)

### Phase 1: Core

Already started as part of Phase 0 groundwork:

- [~] Clubs: list page and API with search and category filter, OSI create-club API. Still to do: club detail page with About and Our work tabs, edit club, OSI create/edit screens
- [~] Club workspace: dashboard shell and read-only members page. Still to do: change roles, transfer leadership screens

Not started:

- [ ] Announcements channel (post, pin, delete) with permissions
- [ ] Events: draft, edit, poster upload, submit with tentative hold, cancel, status chips, history
- [ ] OSI approvals queue and decision screen, event review history
- [ ] Forms: builder, renderer, publish and close, seat limit
- [ ] Registration: register, cancel, QR ticket display, registration list and CSV export
- [ ] Halls: CRUD, blocked slots, availability timeline, final hall request, Events Authority decision
- [ ] Jobs: hold expiry, auto-close registration, reminders, no-shows, completed status
- [ ] Notifications: service, SSE stream, preferences, bell, toast animation
- [ ] Calendar endpoint and component with filters
- [ ] Student pages: Events, Event detail, Activities, Profile (edit), Settings
- [ ] Club workspace: add an event, discussion placeholder
- [ ] Super Admin: create admin accounts, audit log

Exit: all TC-EVT, TC-HALL, TC-FORM, TC-REG (except check-in), TC-CAL, TC-NOTIF, TC-RBAC, TC-ANN; E2E-01, 02, 03, 05, 06.

### Phase 2: Engagement

- [ ] Recruitment and applications (TC-REC), My Clubs, Favourites page and notifications
- [ ] Internal discussion with live updates
- [ ] QR check-in and attendance (TC-REG-11), Past participation by attendance
- [ ] Waitlist, team registration, file upload field
- [ ] Share button and public event page, ICS feed
- [ ] Email notifications and preferences
- [ ] Custom club roles and role editor (`role.manage`), club reports

### Phase 3: Community and assistant

- [ ] Public discussion with report and moderation
- [ ] Chatbot (section 14) with retrieval, sources and limits
- [ ] PWA install

### Phase 4: Hardening

- [ ] Accessibility audit and fixes (TC-UI-13, 14)
- [ ] Performance pass against section 15.10
- [ ] Security review against section 11.5 and OWASP top risks
- [ ] Backups, monitoring, error reporting
- [ ] User guide for students, clubs and administrators; demo data

## Known gaps

- **PostgreSQL parity is untested.** The migrations and tests are written to be database-neutral and CI has a PostgreSQL job, but nothing has run against PostgreSQL yet. The PostgreSQL-only hall exclusion constraint arrives with `hall_bookings` in Phase 1.
- **CI has not run** (no remote repository yet).
- **Email** is printed to the API console in development; SMTP is wired but untested.
- The OSI name expansion, faculty sign-off and other open questions in spec section 18.2 still use the defaults in `docs/DECISIONS.md`.

## Workflow for the team

1. Branch from `main` (`feature/<topic>`), never commit straight to `main`.
2. Write the tests first for auth, roles, approvals, registrations and hall booking.
3. Run `npm test` and `npm run lint` before every commit.
4. After each task: tick the box above, add a line to `CHANGELOG.md`, record new decisions in `docs/DECISIONS.md`, and update `docs/CONTEXT.md`.
