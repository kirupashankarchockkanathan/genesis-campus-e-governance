# Campus Clubs Portal (genesis-campus-e-governance)

Team **STORMBREAKER**. A unified university portal for club management, event approvals, student registrations, campus notifications and AI-powered assistance. One place where every student finds all clubs and events, clubs run their team with roles, and event plans go through the OSI and hall booking with a visible status at every step.

The plan is [`docs/PROJECT_SPEC.md`](docs/PROJECT_SPEC.md) (also `docs/PROJECT_SPEC.docx`). It is the source of truth.

| Document                                   | What it is                                          |
| ------------------------------------------ | --------------------------------------------------- |
| [`docs/CONTEXT.md`](docs/CONTEXT.md)       | What was done, how much, what is next               |
| [`docs/USER_GUIDE.md`](docs/USER_GUIDE.md) | Guide for students, club members and administrators |
| [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) | Hosting, environment, backups, monitoring           |
| [`docs/DECISIONS.md`](docs/DECISIONS.md)   | Decisions made while building                       |
| [`docs/ERD.md`](docs/ERD.md)               | Database diagram                                    |
| [`CHANGELOG.md`](CHANGELOG.md)             | Change history                                      |

## What you get

The web app is the supplied **GENESIS Campus Connect** UI, in the **Amrita brand theme** (AM Maroon `#A4123F`, black, Open Sans; see decision D51), wired to the real API and database. Three entry paths on the first screen: **Student**, **Club Authority** and **Administrator** (Office of Student Affairs, or Events Section).

- **Students**: dashboard, explore events, event details with live seat counts, one-click registration (checked by the server), calendar, registrations and history, clubs directory and favourites, notifications, Campus Assistant, profile, settings.
- **Club Authority**: overview, club profile (own club only), members, event requests (new, edit, resubmit after corrections, with poster and documents), request tracker and feedback, promotions, our events.
- **Events Section**: online review, hard-copy letter verification, publish and notify students, promotion review, club applications (view and AI duplicate check), clubs, reports.
- **OSA**: everything the Events Section does plus the **final approval** of events and the **approve or reject** decision on club applications.
- **Server-enforced rules**: sign-in per portal, role checks on every action, club scoping, the approval order (online review, hard copy, OSA approval, publish) and what each portal may see.
- **Chat for every role**: a small floating chat (bottom right) for students, club authorities and administrators. It sees only what that role may see (a club its own requests, administrators the queue) and keeps the conversation. With `ANTHROPIC_API_KEY` it also answers general questions; without a key it answers portal questions and small talk with built-in rules.
- **Sign out** is in every sidebar and in the profile menu.
- **Campus Assistant**: answers from published events, clubs and the process notes. With `ANTHROPIC_API_KEY` set it uses Claude on the server; without a key it answers with built-in rules.

The earlier API modules (events with hall holds, forms, recruitment, discussions, custom roles, notifications stream) are still in `apps/api` and tested, but this UI does not use them. See decision D40.

## Stack

React 18 + Vite (`apps/web`), Node 20+ with Express (`apps/api`), shared Zod schemas, permissions and constants (`packages/shared`), Knex on SQLite (local, tests) and PostgreSQL (hosted). Own authentication (bcrypt, 15-minute JWT access token, rotating opaque refresh token in an httpOnly cookie). Plain JavaScript with ES modules. Chatbot through the official `@anthropic-ai/sdk`.

## Run it locally

Prerequisites: Node 20 or newer, npm 10 or newer, Git.

```bash
npm install
cp .env.example .env
```

Edit `.env`: set a long random `JWT_SECRET` and keep `AUTO_VERIFY_EMAIL=true`. **Do not put `#` in a value** (it starts a comment in `.env`), or wrap the value in quotes. Then:

```bash
npm run db:reset
npm run dev
```

- Web: http://localhost:5173 (choose Student, Club Authority or Administrator)
- API health: http://localhost:4000/api/v1/health

Demo accounts (created because `SEED_DEMO_PORTAL=true`, never in production; the sign-in screen has a **Fill** button):

| Role                   | Path               | User ID      | Password     |
| ---------------------- | ------------------ | ------------ | ------------ |
| Student                | Student            | `STU2026001` | `student123` |
| Club Authority         | Club Authority     | `CLUB001`    | `club123`    |
| Club Authority (other) | Club Authority     | `CLUB002`    | `club123`    |
| OSA                    | Administrator, OSA | `OSA001`     | `osa123`     |
| Events Section         | Administrator      | `EVT001`     | `events123`  |

The database is seeded with the sample clubs, events, requests in every workflow state, promotions and club applications. "Today" is fixed at 10 October 2026 so the sample dates stay meaningful (decision D43).

### Turn on the AI assistant

Add your key to `.env` (server side only, it never reaches the browser):

```
ANTHROPIC_API_KEY=your-key
LLM_MODEL=            # optional, defaults to claude-opus-5-5
```

The Campus Assistant (student portal) answers only from published events, clubs and the process notes. It never sees registrations, requests, applications or any personal data, treats that text as untrusted data, and falls back to the built-in rules if the model fails. The administrators' duplicate-club check uses a similarity rule on the server (no model needed).

## Commands

| Command                                                       | What it does                                                                         |
| ------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `npm run dev`                                                 | API (4000) and web (5173) together                                                   |
| `npm test`                                                    | Shared, API (database, unit, integration) and web tests on SQLite                    |
| `npm run test:pg`                                             | Database and API tests against PostgreSQL (`DATABASE_URL`, see `docker-compose.yml`) |
| `npm run test:e2e`                                            | Playwright journeys against a seeded test stack (uses your installed Chrome)         |
| `npm run lint`                                                | ESLint and Prettier check (also runs as a pre-commit hook)                           |
| `npm run db:migrate` / `db:rollback` / `db:seed` / `db:reset` | Database commands                                                                    |

## Repository layout

```
apps/api/            Express API: modules, middleware, db (migrations, seeds), jobs, tests
apps/web/            React SPA: app (router, guards), auth, components, features, pages, styles
packages/shared/     Permission keys and role matrix, statuses, error codes, Zod schemas, form rules
e2e/                 Playwright journeys E2E-01 to 09 and the test-stack starter
docs/                Spec, decisions, ERD, context, user guide, deployment, FAQ for the assistant
.github/workflows/   CI: lint and tests on SQLite, database and API tests on PostgreSQL, end-to-end
```

## Test status

| Suite                                                                                                             | Tests | Result |
| ----------------------------------------------------------------------------------------------------------------- | ----- | ------ |
| Shared package (constants, schemas, the approval workflow engine)                                                 | 25    | pass   |
| API (database, auth, RBAC, earlier modules, **governance: portals, views, approvals, seats, uploads, assistant**) | 203   | pass   |
| Web screens against an in-memory API running the real engine (portals, guards, approval flow, forms, route sweep) | 14    | pass   |
| End-to-end in Chrome against the real API and database, journeys E2E-01 to 06                                     | 16    | pass   |

All on SQLite. See [Known gaps](#known-gaps) for what has not been run.

## Build checklist

All five phases of section 17 of the spec. `[x]` means built and covered by tests; `[~]` means built with a caveat noted.

### Phase 0: Foundations

- [x] Repository, npm workspaces, `.gitignore`, ESLint, Prettier, Husky pre-commit, `CLAUDE.md`, `CHANGELOG.md`
- [x] `packages/shared`: permissions, roles, statuses, errors, constants, Zod schemas
- [x] API skeleton: config validation, `app.js`, logger, request id, error handler, validation middleware, health check
- [x] Knex for SQLite and PostgreSQL, helpers, migrations
- [x] Seeds: halls, clubs with default roles, admin accounts, sample data (idempotent)
- [x] Auth: sign-up, verification, login, refresh rotation, logout, forgot and reset, change password, `/me`
- [x] Middleware: `requireAuth`, `requirePlatformRole`, `requireClubPermission`, rate limits
- [x] Web skeleton: tokens, `AppShell`, router, guards, `AuthContext`, API client with refresh, auth screens
- [~] CI pipeline (lint and tests on SQLite and PostgreSQL, plus end-to-end): written, **not yet run on GitHub**
- [x] Exit tests: TC-DB-01 to 07, 13, 16, 17, 27; all TC-AUTH; TC-RBAC-01 to 05, 09, 10, 13; TC-UI-01 to 03

### Phase 1: Core

- [x] Clubs: list, detail, About, Our work, OSI create and edit
- [x] Announcements channel (post, pin, delete) with permissions
- [x] Events: draft, edit, poster upload, submit with tentative hold, cancel, status chips, history
- [x] OSI approvals queue, decision screen, review history
- [x] Forms: builder, renderer, publish, close, seat limit
- [x] Registration: register, cancel, QR ticket, registration list, CSV export
- [x] Halls: CRUD, blocked slots, availability timeline, final hall request, Events Authority decision
- [x] Jobs: hold expiry and warning, auto-close registration, reminders, no-shows, completed status
- [x] Notifications: service, SSE stream with polling fallback, preferences, bell, toast animation
- [x] Calendar endpoint and component with filters
- [x] Student pages: Events, Event detail, Activities, Profile (edit), Settings
- [x] Club workspace: dashboard, events, add an event, members and roles
- [x] Super Admin: create admin accounts, audit log
- [x] Exit tests: TC-EVT, TC-HALL, TC-FORM, TC-REG, TC-CAL, TC-NOTIF, TC-RBAC, TC-ANN; E2E-01, 02, 03, 05, 06

### Phase 2: Engagement

- [x] Recruitment and applications (TC-REC), My Clubs, Favourites page and notifications
- [x] Internal discussion with live updates
- [x] QR check-in (camera and typed code) and attendance, Past participation by attendance
- [x] Waitlist, team registration, file upload field
- [x] Share button and public event page, ICS feed
- [~] Email notifications and preferences: built and tested with a captured mailer; **SMTP delivery not tried against a real provider**
- [x] Custom club roles and role editor, club reports
- [x] Exit tests: TC-REC, TC-FAV, TC-SHARE, TC-DISC-01, TC-RBAC-11, 12; E2E-04, 07, 08, 09

### Phase 3: Community and assistant

- [x] Public discussion with report and moderation (club moderators and OSI)
- [~] Chatbot with retrieval, sources and limits: built and tested with a mocked model; **not yet run against the live Claude API** (needs your `ANTHROPIC_API_KEY`)
- [x] PWA install (manifest, icon, service worker)
- [x] Exit tests: chatbot golden questions, no-answer fallback, prompt-injection test

### Phase 4: Hardening

- [x] Accessibility: axe checks on the main screens, keyboard-operable tabs, builder and dialogs, visible focus, skip link, contrast of every text pair checked from the tokens in both themes (TC-UI-13, 14). A manual keyboard and screen-reader pass is still recommended before launch.
- [x] Performance pass: lazy-loaded routes (first bundle 850 kB to 378 kB), list queries under 300 ms with 200 clubs and 5,000 registrations, index use checked (TC-DB-24)
- [x] Security review against section 11.5: probes for SQL injection, stored scripts, privilege escalation through bodies, token misuse (purpose-bound tokens), path traversal, CORS, headers, oversized bodies; findings fixed
- [~] Backups, monitoring, error reporting: documented in `docs/DEPLOYMENT.md`; structured logs and a health endpoint exist; **no external error-reporting service is wired in**
- [x] User guide for students, clubs and administrators; demo data

### Amrita UI integration

- [x] Supplied frontend copied into `apps/web` with its design, pages and components unchanged (only data wiring and wording that said "simulated sign-in" or "stored in this browser" changed)
- [x] Workflow engine, permissions, selectors and seed moved to `packages/shared/src/gov` and used by both the browser and the API
- [x] Server-authoritative state in the database (`gov_docs`, `gov_meta`), one transaction per action, row lock on PostgreSQL
- [x] Real sign-in per portal (`POST /auth/login` with `portal`), session restored from the refresh cookie after a reload
- [x] Per-portal views of the state: students see only published events; a club sees its own requests in full and other clubs only as a time slot
- [x] Actions refused by the server when the portal is wrong, the role is wrong or the club is not yours (tested, including bypassing the screen)
- [x] Posters stored as real files; documents keep name and size only
- [x] Student registrations in the database with a seat limit that holds under a race; favourites, bookmarks, notifications and preferences per account
- [x] Campus Assistant and duplicate-club check served by the API
- [x] Screens refresh every few seconds and on focus, so an approval shows up for others without a reload
- [~] Documents (permission letter, proposal, venue form) are not stored as files, only their names and sizes, as in the supplied UI
- [~] Club member rosters are generated sample data, as in the supplied UI

## Known gaps

- **The supplied UI does not use the earlier hall, form and recruitment modules.** They remain in the API with their tests; the screens for them belonged to the replaced web app (decision D40).
- **One browser profile holds one session.** The refresh cookie is shared by every tab of a browser profile, so two different people cannot be signed in side by side in the same profile (use separate profiles or private windows).

- **PostgreSQL has not been run.** Migrations and tests are database-neutral and CI has a PostgreSQL job, but nothing was executed against PostgreSQL yet. The PostgreSQL-only hall exclusion constraint (migration 013) is written to the spec and untested.
- **CI has not run on GitHub yet.**
- **Object storage (`STORAGE_DRIVER=s3`) is not implemented.** Uploads use the local disk. Add an S3 driver in `apps/api/src/lib/storage.js` before hosting somewhere the disk is wiped.
- **Live Claude API and real SMTP are untested** (no key or mail account was available).
- In-memory pieces assume **one API instance**: the login limiter, the notification stream hub and the posting limits (decisions D25, D31).
- Open questions in spec section 18.2 (OSI expansion, faculty sign-off and others) still use the defaults in `docs/DECISIONS.md`.

## Working agreements

1. Branch from `main`, open a pull request, never push untested code.
2. Tests first for auth, roles, approvals, registrations and hall booking.
3. `npm test` and `npm run lint` before every commit (the hook runs lint).
4. After each task: tick the box above, add a line to `CHANGELOG.md`, record decisions in `docs/DECISIONS.md`, update `docs/CONTEXT.md`.
5. Permission keys, statuses and error codes come from `packages/shared`; no raw colours outside `tokens.css`; no secrets in git.
