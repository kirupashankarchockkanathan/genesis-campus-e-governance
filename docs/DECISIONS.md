# Decisions log

Decisions D1 to D17 come from section 2 of `PROJECT_SPEC.md`. Rows marked ❓ are defaults chosen because the team has not answered yet. Decisions D18 onwards were made while building.

| ID  | Topic                    | Decision                                                                         | Status |
| --- | ------------------------ | -------------------------------------------------------------------------------- | ------ |
| D1  | Name of approving office | Called "OSI". Expansion configurable in `packages/shared/src/constants.js`.      | ❓     |
| D2  | Faculty coordinator      | Informational field only; one extension point for a future sign-off step.        | ❓     |
| D3  | Accounts                 | One account per person: one platform role plus any number of club memberships.   | ✅     |
| D4  | Who can sign up          | Only students. Admin accounts are created by a Super Admin.                      | ✅     |
| D5  | Club creation            | OSI creates clubs and assigns the first Leader.                                  | ❓     |
| D6  | Platform                 | Web only, responsive down to phone width.                                        | ❓     |
| D7  | Payments                 | Out of scope.                                                                    | ❓     |
| D8  | Poster circulation       | In-portal visibility plus notifications.                                         | ❓     |
| D9  | Sharing                  | Public read-only page at `/e/:id`.                                               | ❓     |
| D10 | Language                 | JavaScript (ES modules) with Zod.                                                | ✅     |
| D11 | Database                 | SQL: SQLite locally, PostgreSQL hosted, one migration set.                       | ✅     |
| D12 | Hall booking order       | Tentative hold, seat limit = hall capacity, final hall request.                  | ✅     |
| D13 | Attendance               | QR check-in.                                                                     | ✅     |
| D14 | Recruitment              | Register submits an application; club reviews.                                   | ✅     |
| D15 | Notification audience    | All students: events and recruitments. Followed and member clubs: announcements. | ✅     |
| D16 | Time                     | UTC in the database, `Asia/Kolkata` in the UI.                                   | ❓     |
| D17 | Chatbot                  | Phase 3, answers only from portal data.                                          | ✅     |

## Decisions made while building

| ID  | Topic                       | Decision and reason                                                                                                                                                                                                                                                         |
| --- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D18 | Club directory              | The team supplied a real club list; it replaces the eight sample clubs of Appendix A as seed data (`apps/api/src/db/seeding/clubsData.js`). The product name stays the neutral "Campus Clubs Portal" (spec rule 7). Categories were mapped onto the existing category list. |
| D19 | Sample club                 | The sample Leader, Vice Leader, Secretary, Event Coordinator, Media Lead and Member accounts live in **Hut Labs** (the robotics club), standing in for the spec's "Robotics Club".                                                                                          |
| D20 | Case-insensitive uniqueness | In addition to storing lower-case values, `CHECK (email = lower(email))` and the same for `username` enforce it in the database, so TC-DB-03 holds even for raw inserts.                                                                                                    |
| D21 | Timestamps                  | Stored as UTC ISO-8601 text (`string(30)`) on both databases, not native timestamp columns. Guarantees identical round trips (TC-DB-13) and lexical ordering.                                                                                                               |
| D22 | Logout                      | `POST /auth/logout` works from the refresh cookie alone (not `auth`), so an expired access token cannot keep a session alive. Always returns 200.                                                                                                                           |
| D23 | Change password             | The refresh cookie is scoped to `/api/v1/auth`, so `/me/change-password` cannot see the current session family. It revokes **all** sessions and returns a fresh access token and refresh cookie for the caller.                                                             |
| D24 | Forced password change      | While `must_change_password` is set, only `POST /me/change-password` works (even `/me` returns 403 `PASSWORD_CHANGE_REQUIRED`). The login response carries the flag so the web app can redirect.                                                                            |
| D25 | Brute-force limiter         | In-memory per account+IP store (5 failures / 15 min). Correct for one API instance; move to the database or Redis before running several instances.                                                                                                                         |
| D26 | Styling                     | Plain CSS files built on the design tokens instead of CSS modules, to keep Phase 0 small. Components never contain raw colours. Can be migrated to CSS modules later.                                                                                                       |
| D27 | Component tests             | `fetch` is stubbed with a small helper instead of MSW in Phase 0. MSW can replace it when screens multiply.                                                                                                                                                                 |
| D28 | Husky                       | Not installed yet (the folder is not a git repository on the author's machine until now). Add `husky` with a pre-commit running `npm run lint` before the team pushes.                                                                                                      |
| D29 | Bcrypt cost in tests        | `BCRYPT_COST` env var (default 12, tests use 4) so the suite stays fast. Production must keep 12 or higher.                                                                                                                                                                 |
| D30 | Club ids in the web app     | Workspace routes use the club's UUID (`/club/:clubId`); the API accepts either id or slug for club paths.                                                                                                                                                                   |
