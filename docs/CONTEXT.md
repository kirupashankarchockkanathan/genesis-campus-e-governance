# Project context and progress

Last updated: 10 October 2026. Read this first to see what is done, what is next and what to be careful about.

## What this project is

Campus Clubs Portal, built to `docs/PROJECT_SPEC.md` (version 1.0). Stack: React + Vite, Express, Knex (SQLite local, PostgreSQL hosted), own authentication, red and white theme.

## Git state

| Branch                        | Purpose                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `main`                        | Baseline only: the project spec (`docs/PROJECT_SPEC.docx` and `.md`). Untouched since.     |
| `feature/phase-0-foundations` | All Phase 0 work. Open a pull request into `main` when the team leader is ready to review. |

No remote is configured yet. The team leader's GitHub repository URL was not available when the work was done. To connect it:

```bash
git remote add origin <repo-url>
git push -u origin main
git push -u origin feature/phase-0-foundations
```

(If the leader's repository already has a `main`, fetch it first and rebase or merge the baseline commit.)

## What was done (Phase 0, complete)

How much: **all nine Phase 0 tasks and every Phase 0 exit test**, except the Husky hook (deferred, D28) and a real CI run (workflow is written but the repo has no remote).

- Spec converted to Markdown and stored in `docs/`.
- Monorepo with npm workspaces, ESLint, Prettier, `.env.example`, `CLAUDE.md`, CI workflow, optional PostgreSQL compose file.
- `packages/shared`: 19 permission keys, default role matrix, locked permissions, status lists and event transitions, error codes with HTTP statuses, constants, Zod auth schemas.
- API: config validated with Zod (refuses weak `JWT_SECRET` in production), layered modules, stable error format, helmet, strict CORS, request id, health check.
- Database: 10 tables, DB-level checks (status values, lower-case email and username, capacity, year range), foreign keys on for SQLite, idempotent seeds.
- Auth: sign-up with college-domain check, email verification tokens, login by username or email, brute-force limit, rotating refresh tokens with reuse detection, forgot and reset, change password, forced change for admins, `/me` with per-club permissions.
- RBAC: deny by default, per-club scope taken from the resource, permissions re-read each request.
- Clubs and members: list, detail, OSI create with the six default roles and a Leader, add and remove members, change role, atomic leadership transfer with exactly one Leader.
- Seeds: 6 sample halls, **26 clubs from the team's club list** (see D18), 3 admin accounts, 7 sample students with the six club roles in Hut Labs.
- Web: red and white tokens in light and dark, responsive shell (sidebar becomes bottom tabs under 900px), role-based sidebars, guards, API client with silent refresh, auth screens, clubs list, My Clubs, club dashboard, members page, profile, theme toggle.

## Test results

| Suite                                                | Count  | Result                |
| ---------------------------------------------------- | ------ | --------------------- |
| `packages/shared`                                    | 10     | pass                  |
| `apps/api` (database 17, auth 21, RBAC and clubs 17) | 55     | pass                  |
| `apps/web` (components)                              | 16     | pass                  |
| **Total**                                            | **81** | **pass, SQLite only** |

Lint (ESLint and Prettier) is clean. The login, sign-up and clubs flow was also checked by hand in a browser on desktop and phone widths.

## Not done yet, and why

- PostgreSQL runs: no PostgreSQL available locally; CI job is ready.
- CI run: needs the remote repository.
- Husky: deferred (D28).
- Everything in Phases 1 to 4 (see the checklist in `README.md`).
- Phase 1 pieces already begun: clubs list and OSI create-club API, club dashboard and members page (read-only).

## Next steps (Phase 1, in this order)

1. Connect the remote, push both branches, confirm CI is green on SQLite and PostgreSQL.
2. Club detail page (About, Our work) and announcements with permissions.
3. Events: draft, poster upload, submit with tentative hold (write the hold and overlap tests first: TC-DB-20 to 22, TC-HALL-09), OSI approvals.
4. Forms, registration with QR ticket, halls and final hall request, jobs, notifications, calendar.

## Things to remember

- Never retype permission keys, statuses or error codes; import from `@ccp/shared`.
- Never weaken a permission check or constraint to make a test pass.
- Keep colours in `tokens.css` only.
- Do not commit `.env`. Local passwords are throwaway values.
- Open questions for the team are in spec section 18.2; defaults are in `docs/DECISIONS.md`.
