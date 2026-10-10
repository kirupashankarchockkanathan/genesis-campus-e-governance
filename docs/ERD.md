# Entity diagram

Kept in sync with `apps/api/src/db/migrations`. Tables marked **(built)** exist today; the rest are scheduled in later phases (spec section 17).

```mermaid
erDiagram
  USERS ||--o{ CLUB_MEMBERS : has
  CLUBS ||--o{ CLUB_MEMBERS : has
  CLUBS ||--o{ CLUB_ROLES : defines
  CLUB_ROLES ||--o{ CLUB_ROLE_PERMISSIONS : grants
  CLUB_ROLES ||--o{ CLUB_MEMBERS : assigned
  USERS ||--o{ AUTH_TOKENS : owns
  USERS ||--o{ REFRESH_TOKENS : owns
  USERS ||--o{ FAVORITE_CLUBS : marks
  CLUBS ||--o{ FAVORITE_CLUBS : marked
  USERS ||--o{ AUDIT_LOGS : acts
  HALLS
```

Built in Phase 0: `users`, `auth_tokens`, `refresh_tokens`, `clubs`, `club_roles`, `club_role_permissions`, `club_members`, `favorite_clubs`, `audit_logs`, `halls`.

Planned: `club_works`, `announcements`, `discussions`, `discussion_messages`, `events`, `event_reviews`, `forms`, `form_responses`, `registrations`, `recruitments`, `recruitment_positions`, `applications`, `hall_blocked_slots`, `hall_bookings`, `notifications`, `notification_preferences`, `chat_messages`. The full target diagram is in section 9.1 of the spec.
