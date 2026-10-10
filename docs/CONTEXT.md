# Project context and progress

Last updated: 11 October 2026 (Amrita UI integration, branch `feature/amrita-frontend`). Read this first to see what is done, what is next and what to be careful about.

## What this is

Campus Clubs Portal, built to `docs/PROJECT_SPEC.md` (version 1.0). React + Vite, Express, Knex (SQLite local, PostgreSQL hosted), own authentication, red and white theme, Claude-powered assistant.

## Latest change: Amrita UI on the real backend

The team's supplied GENESIS Campus Connect frontend now runs in `apps/web`, unchanged in design, on a new server-authoritative `gov` module (see decisions D40 to D50 and the README checklist "Amrita UI integration"). Tests: shared 25, API 203, web 14, end-to-end 16, lint clean. Not verified: PostgreSQL, GitHub Actions, live Claude, real email.

## Git state

| Branch                        | Content                                                                |
| ----------------------------- | ---------------------------------------------------------------------- |
| `main`                        | The whole project (all phases), merged from the feature branches.      |
| `feature/phase-0-foundations` | Phase 0 history.                                                       |
| `feature/phase-1-core`        | Phases 1 to 4 history (events, engagement, assistant, hardening, e2e). |

Remote: https://github.com/shreesanth-78/genesis-campus-e-governance

## How much was done

**All five phases of the spec's build plan (section 17)**, with the caveats listed under "Not verified".

- Phase 0: foundations, auth, roles and permissions, seeds, CI file.
- Phase 1: clubs, announcements, events, OSI approval, tentative hall holds, forms and registration, QR tickets, halls and final requests, jobs, notifications (SSE, toast into the bell), calendar, student pages, club workspace, Super Admin.
- Phase 2: recruitment, favourites, internal discussion with live updates, QR check-in, waitlist, team and file fields, share page, ICS feed, email copies, custom roles, club reports.
- Phase 3: public discussion with reports and moderation, chatbot (Claude via the official SDK, grounded in portal data), PWA.
- Phase 4: accessibility tests, contrast checks, lazy routes, performance and security tests, error boundary, user guide, deployment guide, demo data.
- Start screen with exactly three logins (Student, Club Member, Administrator); bigger club and event screens.

## Test results (all on SQLite)

| Suite                             | Tests | Result |
| --------------------------------- | ----- | ------ |
| Shared                            | 10    | pass   |
| API                               | 175   | pass   |
| Web                               | 46    | pass   |
| End-to-end (Chrome, E2E-01 to 09) | 10    | pass   |

Lint (ESLint and Prettier) is clean. Every role's screens were also walked in a real browser during development.

## Not verified (be honest with the team)

- PostgreSQL parity (CI job written, never run; the hall exclusion constraint migration is untested).
- GitHub Actions has not run.
- Live Claude API (needs `ANTHROPIC_API_KEY`) and real SMTP.
- S3 storage driver is not implemented.
- Manual keyboard and screen-reader accessibility pass.

## Next steps

1. Run CI on GitHub and fix anything that only shows on PostgreSQL.
2. Add the S3 driver and an error-reporting service before hosting.
3. Add `ANTHROPIC_API_KEY` and try the assistant on real questions.
4. Answer the open questions in spec section 18.2 and update `docs/DECISIONS.md`.

## Things to remember

- Permission keys, statuses and error codes come from `@ccp/shared`; never retype them.
- Never weaken a constraint or a permission check to make a test pass.
- Colours only from `apps/web/src/styles/tokens.css`.
- Local `.env` holds throwaway secrets and is never committed; do not put `#` in values.
