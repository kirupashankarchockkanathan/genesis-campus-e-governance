# Campus Clubs Portal: instructions for Claude

Read docs/PROJECT_SPEC.md before any change. It is the source of truth.

## Stack
React 18 + Vite (apps/web), Node 20 + Express (apps/api), shared Zod schemas and constants
(packages/shared), Knex on SQLite (dev/tests) and PostgreSQL (hosted). Plain JavaScript (ES modules).

## Rules
- Permission keys, statuses and error codes come from packages/shared. Never retype them.
- Check permissions on the server in middleware or services. The UI only hides controls.
- Migrations must run on SQLite and PostgreSQL: no enums, JSON as text, UUID text ids, UTC timestamps via helpers.
- Write tests first for auth, roles, approvals, registrations and hall booking.
- Never weaken a constraint or a check to make a test pass.
- Use design tokens from apps/web/src/styles/tokens.css. No raw colours in components.
- Do not use alert, confirm or prompt. Use the ConfirmDialog component.
- No secrets in the repository. Update .env.example when adding a variable.
- Record any decision not in the spec in docs/DECISIONS.md. Update CHANGELOG.md after each task.

## Commands
npm run dev | npm test | npm run test:pg | npm run test:e2e | npm run lint | npm run db:reset

## Order of work
Follow section 17 of the spec, phase by phase. Do not start a phase until the previous exit tests pass.
