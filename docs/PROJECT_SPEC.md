# Table of Contents

# Campus Clubs Portal: Project Specification

**Team:** TEAM STORMBREAKER **Version:** 1.0 (draft for build) **Date:**
10 October 2026 **Stack:** React (frontend), Node.js with Express
(backend), own authentication, SQL database (SQLite for local
development and tests, PostgreSQL for hosted use)

------------------------------------------------------------------------

## 0. How to use this document (read this first, Claude Cowork)

This file is the single source of truth for the project. Read all of it
before writing code.

**Legend** - **✅ Decided**: build it this way. - **❓ Assumed**: a
sensible default was chosen because the team has not answered yet. Build
the default, but keep the code easy to change and list it in
`docs/DECISIONS.md`. - IDs: `FR-*` functional requirement, `NFR-*`
non-functional requirement, `TC-*` test case, `D*` decision.

**Working agreements** 1. Work phase by phase (section 17). Finish a
phase, run all tests, then start the next. 2. Write the tests for rules
first when the rule is about security, permissions, approvals,
registrations or hall booking. These are the areas where mistakes are
costly. 3. Never weaken a permission check or a database constraint to
make a test or a screen work. Fix the cause. 4. Every permission check
happens on the server. The frontend only hides buttons for convenience.
5. Keep the permission keys, status values and error codes in
`packages/shared`, and import them in both apps. Do not retype them. 6.
If this document is unclear or two sections disagree, choose the safer
option, write the choice in `docs/DECISIONS.md`, and continue. Do not
stop to ask unless the change is irreversible. 7. Do not invent real
people, real university names or real logos. Use the neutral name
"Campus Clubs Portal". Sample data must be marked as sample. 8. Never
commit secrets. Use `.env` locally and keep `.env.example` up to date.
9. After each completed task, update the checklist in section 17 and add
a line to `CHANGELOG.md`. 10. Keep the interface in the red and white
theme described in section 13.

------------------------------------------------------------------------

## 1. Overview

### 1.1 Problem

Students do not know which clubs exist in the university, what they do,
or when they recruit or hold events. Announcements are scattered across
WhatsApp groups and posters. Event approval and hall booking are slow
and unclear: the club does not know where its request is stuck, and a
hall is often found only after the event is already advertised.

### 1.2 Goals

1.  One place where every student can find all clubs, their aims, their
    work, their announcements, recruitments and events.
2.  Students register for events, hackathons and recruitments in one
    click, using forms built inside the portal.
3.  Clubs manage their own team with **club roles**, so each member can
    do only what their role allows.
4.  Event plans go to the OSI for approval, the poster is circulated
    after approval, and the Events Authority books the hall. Every step
    has a visible status.
5.  Students get timely notifications and a calendar that shows
    everything important on campus.

### 1.3 Non-goals for version 1

- Online payments and paid events.
- Student-initiated creation of new clubs (the OSI creates clubs in
  version 1; see D5).
- Native mobile apps (the web app is responsive; see D6).
- Integration with the university's own ERP or single sign-on (the
  design leaves room for it).

### 1.4 Glossary (use these names everywhere: UI, code, database)

| Term | Meaning |
|:---|:---|
| **Student** | Any signed-up user with a college email. Default role. |
| **Club Member** | A student who is an active member of at least one club. |
| **Club Leader** | The single member of a club holding the Leader club role. The only person who submits an event for OSI approval. |
| **Club Role** | A role inside one club (Leader, Vice Leader, Secretary, Event Coordinator, Media Lead, Member). It decides what the person can do in that club only. |
| **OSI** | The administration office that approves event plans and circulates posters. Expansion of the abbreviation to be confirmed by the team (D1). |
| **Events Authority** | The administration office that owns the halls and books them. |
| **Super Admin** | Technical administrator who creates admin accounts. Not shown to students. |
| **Tentative hold** | A temporary, automatically expiring reservation of a hall made when an event is submitted, so the date cannot be double-booked while registrations are collected. |
| **Final hall request** | The leader's request to the Events Authority, made after registrations close, to confirm (or change) the hall based on the real count. |

------------------------------------------------------------------------

## 2. Decisions and assumptions

| ID | Topic | Decision | Status |
|:---|:---|:---|:---|
| D1 | Name of the approving office | Called "OSI" in the UI and code. Expansion left configurable in `packages/shared/src/constants.js`. | ❓ |
| D2 | Faculty coordinator | Not part of the approval flow in version 1. Each club and event has an optional informational field `faculty_coordinator`. The flow has one extension point for a faculty sign-off step before the OSI. | ❓ |
| D3 | Accounts | One account per person. A person holds one platform role (student, osi_admin, events_admin, super_admin) and any number of club memberships, each with its own club role. | ✅ |
| D4 | Who can sign up | Only students sign up. Admin accounts are created by a Super Admin. Club roles are given by the club (through recruitment or by the Leader) and by the OSI when a club is created. | ✅ |
| D5 | Club creation | The OSI creates clubs and assigns the first Leader. Student-initiated new-club requests are a later extension. | ❓ |
| D6 | Platform | Web app only, responsive down to phone width. Installable app (PWA) later. | ❓ |
| D7 | Payments | Out of scope. Registration is free. | ❓ |
| D8 | Poster circulation | "Circulate" means the event and its poster become visible portal-wide and trigger notifications. Email broadcast is optional later. | ❓ |
| D9 | Sharing | Each approved event has a public, read-only page at `/e/:id` (title, poster, date, venue, club). No personal data. Registering requires login. | ❓ |
| D10 | Language | JavaScript with ES modules in both apps, validated with Zod. TypeScript can be adopted later. | ✅ |
| D11 | Database | SQL. SQLite for local development and automated tests, PostgreSQL for hosted use. One migration set that runs on both (see section 7.2). | ✅ |
| D12 | Hall booking order | Tentative hold at submission, registration limit equal to the held hall's capacity, final hall request after registration closes. | ✅ |
| D13 | Attendance | Proven by QR check-in at the event. "Past participation" shows attended events, and registered-but-absent events are labelled. | ✅ |
| D14 | Recruitment | Clicking Register submits an application. The club reviews it. Accepting creates the membership. Clubs may switch on auto-accept. | ✅ |
| D15 | Notification audience | All students get new events and recruitments. Followed (favourite) clubs and member clubs also send announcements. Everyone can switch categories off in Settings. | ✅ |
| D16 | Time | Store UTC. Show in `Asia/Kolkata` by default, configurable with `APP_TIMEZONE`. | ❓ |
| D17 | Chatbot | Built last (Phase 3). Answers only from portal data. | ✅ |

------------------------------------------------------------------------

## 3. Users, roles and permissions

### 3.1 Platform roles

| Role | Created by | Can do |
|:---|:---|:---|
| `student` | Self sign-up (college email, verified) | Browse, favourite, register, apply, share, use notifications and calendar. May also hold club memberships. |
| `osi_admin` | Super Admin | Create and edit clubs, assign Leaders, review event plans (approve, reject, ask for changes), circulate posters, moderate content, view all calendars. |
| `events_admin` | Super Admin | Manage the hall list and blocked slots, see tentative holds, decide final hall requests (approve, deny, change hall), view hall calendar. |
| `super_admin` | Seed script | Create and suspend admin accounts, view audit logs, change system settings. |

### 3.2 Default club roles

Every club gets these six roles when it is created. They are rows in
`club_roles`, so version 2 can add custom roles without changing code.

| Key | Name | Intended person |
|:---|:---|:---|
| `LEADER` | Leader | One per club. Owns the club workspace. |
| `VICE_LEADER` | Vice Leader | Acts for the Leader. Almost every permission except the ones locked to the Leader. |
| `SECRETARY` | Secretary | Announcements, recruitment, applications, forms, discussion. |
| `EVENT_COORDINATOR` | Event Coordinator | Event plans, forms, registrations, check-in. |
| `MEDIA_LEAD` | Media Lead | Club page, works, posters, announcements. |
| `MEMBER` | Member | Ordinary member. Read access to the workspace and internal discussion. |

### 3.3 Permission catalogue (club-scoped)

These keys are the single list used by the database, the API and the UI.
Define them once in `packages/shared/src/permissions.js`.

| Key | Allows |
|:---|:---|
| `club.profile.edit` | Edit club description, why join, aim, contact, meeting info, logo and cover. |
| `club.works.manage` | Add, edit and remove entries in "Our work". |
| `announcement.post` | Post announcements to the club channel. |
| `announcement.delete` | Delete or pin announcements. |
| `discussion.moderate` | Remove messages in the public club discussion and handle reports. |
| `recruitment.manage` | Create, open and close recruitment drives and their positions and form. |
| `application.review` | Shortlist, accept or reject applications. |
| `member.manage` | Add or remove members and change their role (except Leader). |
| `leadership.transfer` | Hand the Leader role to another member. |
| `role.manage` | Create custom roles and edit permissions (Phase 2). |
| `event.draft` | Create and edit event drafts and plans. |
| `event.poster.upload` | Upload or replace the event poster. |
| `event.submit` | Submit an event to the OSI and place the tentative hall hold. |
| `form.manage` | Build and edit forms (event registration and recruitment). |
| `registration.publish` | Publish the registration link after OSI approval and close it. |
| `registration.view` | See registrations and download the list. |
| `checkin.run` | Scan QR codes at the event. |
| `hall.request` | Send the final hall request to the Events Authority. |
| `report.view` | See club statistics (members, registrations, attendance). |

**Implicit for every active member of a club (no permission key
needed):** open the club workspace, read event drafts and plans, read
and post in the internal club discussion, see registration counts (never
personal answers).

### 3.4 Default permissions per club role

| Permission | Leader | Vice Leader | Secretary | Event Coordinator | Media Lead | Member |
|:---|:--:|:--:|:--:|:--:|:--:|:--:|
| `club.profile.edit` | Yes | Yes | No | No | Yes | No |
| `club.works.manage` | Yes | Yes | No | No | Yes | No |
| `announcement.post` | Yes | Yes | Yes | No | Yes | No |
| `announcement.delete` | Yes | Yes | Yes | No | No | No |
| `discussion.moderate` | Yes | Yes | Yes | No | No | No |
| `recruitment.manage` | Yes | Yes | Yes | No | No | No |
| `application.review` | Yes | Yes | Yes | No | No | No |
| `member.manage` | Yes | Yes | No | No | No | No |
| `leadership.transfer` | Yes | No | No | No | No | No |
| `role.manage` | Yes | No | No | No | No | No |
| `event.draft` | Yes | Yes | No | Yes | No | No |
| `event.poster.upload` | Yes | Yes | No | Yes | Yes | No |
| `event.submit` | **Yes** | No | No | No | No | No |
| `form.manage` | Yes | Yes | Yes | Yes | No | No |
| `registration.publish` | Yes | Yes | No | Yes | No | No |
| `registration.view` | Yes | Yes | Yes | Yes | No | No |
| `checkin.run` | Yes | Yes | Yes | Yes | No | No |
| `hall.request` | Yes | Yes | No | No | No | No |
| `report.view` | Yes | Yes | Yes | No | No | No |

### 3.5 Rules for enforcing roles

1.  **Deny by default.** A request with no matching permission is
    rejected with `403 FORBIDDEN`.
2.  **Scope is per club.** Being Leader of Club A gives no power in
    Club B. The check always uses the club that owns the resource (an
    event's `club_id`, an announcement's `club_id`).
3.  **Exactly one active Leader per club.** Enforced in the service
    layer inside a transaction. Leadership changes only through
    `leadership.transfer`, which swaps the two roles atomically.
4.  **Locked permissions.** In version 1, `event.submit`,
    `leadership.transfer` and `role.manage` cannot be given to other
    roles, even when custom roles arrive.
5.  **Immediate effect.** Permissions are read from the database on
    every request (or from a cache that is cleared on any role change).
    Removing a member or changing a role takes effect at once.
6.  **The** `/me` **endpoint** returns the user's platform role and, for
    each club membership, the club role and the list of permission keys.
    The frontend uses this only to show or hide controls.
7.  **Admin permissions are by platform role, not club role.** An
    `osi_admin` cannot book halls. An `events_admin` cannot approve
    events.
8.  **Audit.** Role changes, approvals, rejections, hall decisions and
    suspensions are written to `audit_logs`.

### 3.6 Platform permissions

| Action | student | osi_admin | events_admin | super_admin |
|:---|:--:|:--:|:--:|:--:|
| Browse clubs and approved events | Yes | Yes | Yes | Yes |
| Create and edit clubs, assign Leader | No | Yes | No | No |
| Review event plans, circulate poster | No | Yes | No | No |
| Manage halls and blocked slots | No | No | Yes | No |
| Decide final hall requests | No | No | Yes | No |
| Create or suspend admin accounts | No | No | No | Yes |
| View audit logs | No | No | No | Yes |

------------------------------------------------------------------------

## 4. Functional requirements

### 4.1 Authentication and accounts (AUTH)

- **FR-AUTH-01** A student signs up with full name, college email,
  username, roll number, department, year and password. The email domain
  must match `ALLOWED_EMAIL_DOMAINS`.
- **FR-AUTH-02** The account is usable only after the email is verified
  through a link. In development a flag `AUTO_VERIFY_EMAIL=true` skips
  this.
- **FR-AUTH-03** Login works with username or email plus password.
- **FR-AUTH-04** Logout ends the session on the server.
- **FR-AUTH-05** Forgot password sends a reset link to the college
  email. The response is the same whether or not the email exists.
- **FR-AUTH-06** A logged-in user can change the password after entering
  the current one.
- **FR-AUTH-07** After login the landing page depends on the user:
  students go to Clubs, club members go to their club workspace (the
  last used club), OSI to Approvals, Events Authority to Hall requests,
  Super Admin to Users.
- **FR-AUTH-08** Admin accounts are created only by a Super Admin and
  must change the first password at first login.

### 4.2 Clubs (CLUB)

- **FR-CLUB-01** Every logged-in user sees a list of all active clubs
  with name, category, short description, member count and a
  "Recruiting" badge when a recruitment is open. The list has search and
  a category filter.
- **FR-CLUB-02** The club page has tabs: **About** (description, why
  join, aim, coordinator, meeting info, contact), **Our work** (past
  projects and achievements), **Announcements**, **Discussion**,
  **Events**, **Recruitment**.
- **FR-CLUB-03** A student can mark a club as a favourite (and remove
  it) from the list and from the club page.
- **FR-CLUB-04** The OSI creates a club with name, category, description
  and first Leader. Default club roles are created with it.
- **FR-CLUB-05** Members with `club.profile.edit` edit the About tab.
  Members with `club.works.manage` manage Our work.

### 4.3 Announcements and discussion (ANN, DISC)

- **FR-ANN-01** Each club has its own announcement channel. Members with
  `announcement.post` post text with an optional image. Everyone reads.
  Students cannot post in the channel.
- **FR-ANN-02** Announcements show newest first. Pinned ones stay on
  top. Members with `announcement.delete` can delete or pin.
- **FR-DISC-01** Each club has an **internal discussion** for active
  members only. Any member can post. (Phase 2)
- **FR-DISC-02** Each club has a **public discussion** under the club
  page where students can ask questions. A club can switch it off.
  Members with `discussion.moderate` can remove messages. Any user can
  report a message. (Phase 3)

### 4.4 Recruitment (REC)

- **FR-REC-01** A member with `recruitment.manage` creates a recruitment
  with title, description, positions (title, description, number of
  openings), deadline and an application form.
- **FR-REC-02** While a recruitment is open and before its deadline, the
  club page shows a Recruitment tab with the positions and a
  **Register** button. Outside that period the tab shows "No open
  recruitment".
- **FR-REC-03** A student applies once per recruitment. The application
  is stored with the form answers.
- **FR-REC-04** Members with `application.review` see applications and
  set the status: shortlisted, accepted, rejected. The student is
  notified of each change.
- **FR-REC-05** Accepting an application creates a club membership with
  the `MEMBER` role (or the role chosen by the reviewer) and shows the
  club under **My Clubs**.
- **FR-REC-06** The student can withdraw an application before it is
  decided.

### 4.5 Events and approval (EVT)

- **FR-EVT-01** Members with `event.draft` create an event with: title,
  type (workshop, hackathon, talk, cultural, competition, exhibition,
  recruitment drive, other), summary, full description, objectives,
  schedule/agenda, date and time (start and end), mode (offline, online,
  hybrid), registration deadline, expected participants, and optional
  faculty coordinator. Members with `event.poster.upload` attach the
  poster (image or PDF, up to 5 MB).
- **FR-EVT-02** Drafts can be edited freely by permitted members. Other
  members can read them.
- **FR-EVT-03** The Leader submits the event to the OSI. The submission
  fails with a clear message unless every required field and the poster
  are present. On submission the Leader also picks the preferred hall;
  the system places a **tentative hold** (section 5.3).
- **FR-EVT-04** A submitted event is locked for editing.
- **FR-EVT-05** The OSI sees a queue of submitted events with the full
  plan, poster, club, date, expected participants and the held hall. The
  OSI chooses **Approve and circulate**, **Request changes** (a note is
  required) or **Reject** (a note is required).
- **FR-EVT-06** After "Request changes" the event reopens for editing
  and the Leader can resubmit. After "Reject" the hold is released.
- **FR-EVT-07** After approval the event appears in the public Events
  list, in every student's calendar, and in notifications (D15). The
  poster is shown on the event page.
- **FR-EVT-08** The Leader (or a member with `event.draft`) can cancel
  an event. Registered students are notified and the hall booking is
  released.
- **FR-EVT-09** An event whose end time has passed is shown as
  completed.
- **FR-EVT-10** Students see only approved events. Club members also see
  their own club's drafts, submitted and rejected events in the
  workspace.

### 4.6 Forms and registration (FORM, REG)

- **FR-FORM-01** Members with `form.manage` build forms inside the
  portal. Field types: short text, long text, number, email, phone,
  single choice, dropdown, multiple choice, date, consent checkbox. File
  upload and team fields come in Phase 2.
- **FR-FORM-02** Each field has a label, help text, required flag and,
  where relevant, options and simple limits (min, max, length).
- **FR-FORM-03** Fields can be reordered, edited and removed while the
  form is a draft. A form can be duplicated from an older event.
- **FR-FORM-04** Name, college email, roll number, department and year
  are filled from the student's profile and shown read-only.
- **FR-FORM-05** A form belongs to one event (registration form) or one
  recruitment (application form).
- **FR-FORM-06** The registration link can be published only after the
  event is approved (`registration.publish`). Publishing sets the seat
  limit (default: capacity of the held hall) and the closing time
  (default: the registration deadline).
- **FR-REG-01** A student registers from the event page. The form is
  validated on the client and the server.
- **FR-REG-02** One registration per student per event. A second attempt
  shows the existing registration.
- **FR-REG-03** When the seat limit is reached the button shows "Full".
  (Waitlist in Phase 2.)
- **FR-REG-04** Registration closes automatically at the closing time or
  manually by `registration.publish` holders.
- **FR-REG-05** A student can cancel a registration until the event
  starts, which frees the seat.
- **FR-REG-06** Each registration produces a QR ticket shown on the
  event page and under Activities.
- **FR-REG-07** Members with `registration.view` see the registration
  list with answers and download it as CSV. Other members see only
  counts.
- **FR-REG-08** Hackathon team registration (team name, members by
  college email) in Phase 2.

### 4.7 Halls and booking (HALL)

- **FR-HALL-01** The Events Authority maintains the hall list: name,
  building, floor, capacity, facilities, active flag.
- **FR-HALL-02** The Events Authority can add blocked slots (class
  timetable, maintenance, exams) to a hall.
- **FR-HALL-03** Leaders can check hall availability for a date and time
  range, filtered by minimum capacity, before submitting the event.
- **FR-HALL-04** On submission the chosen hall gets a **tentative hold**
  for the event's date and time. A hold blocks the same hall and time
  for everyone else. Holds expire automatically (section 5.3). A club
  can have at most two active holds (configurable).
- **FR-HALL-05** After registration closes, a member with `hall.request`
  sends the **final hall request** with the registered count. The Leader
  can keep the held hall or choose another that fits.
- **FR-HALL-06** The Events Authority sees all final requests with the
  club, event, date, registered count, expected count and requested
  hall. They choose **Approve** (optionally changing the hall), or
  **Deny** with a note.
- **FR-HALL-07** On approval the hall is confirmed on the event, the
  held slot is converted to a confirmed booking and the club and
  registered students are notified of the venue. On denial the club is
  notified and may request again.
- **FR-HALL-08** A hall can never have two overlapping holds or
  bookings. Adjacent times (one ends when the next starts) are allowed.

### 4.8 Calendar (CAL)

- **FR-CAL-01** A calendar icon at the top right of every screen opens
  the calendar.
- **FR-CAL-02** Every student sees all approved events of **every
  club**, whether or not they are a member of it. Registration deadlines
  and recruitment deadlines also appear.
- **FR-CAL-03** Items the student registered for are marked clearly.
  Items from favourite clubs are marked. Marking uses shape and text as
  well as colour.
- **FR-CAL-04** Filters: All, My registrations, Favourite clubs, My
  clubs.
- **FR-CAL-05** Club members also see their own club's pending and draft
  items, marked as private. The OSI sees events waiting for approval.
  The Events Authority sees holds and final requests.
- **FR-CAL-06** Month grid on large screens, agenda list on phones.
  Clicking an item opens its detail page.
- **FR-CAL-07** Export to a calendar file (ICS) in Phase 2.

### 4.9 Notifications (NOTIF)

- **FR-NOTIF-01** A bell icon at the top right shows the number of
  unread notifications.
- **FR-NOTIF-02** When a notification arrives while the user is on the
  site, a small card appears at the top right with the title and the
  first part of the text. After a few seconds it shrinks and moves into
  the bell icon, and the count goes up. With reduced-motion preferences,
  it simply fades.
- **FR-NOTIF-03** Clicking the bell shows a list of the latest
  notifications (unread highlighted). Clicking one marks it read and
  opens the related page.
- **FR-NOTIF-04** The full trigger and audience list is in section 12.
- **FR-NOTIF-05** Settings let the user switch each category on or off
  for in-app and (later) email.

### 4.10 Student pages (ACT, FAV, PROF, SET, SHARE)

- **FR-ACT-01** **Activities** page with tabs: **Current** (upcoming
  registered events, open applications), **Past** (attended events,
  events registered but missed, decided applications), and **All
  registrations**.
- **FR-FAV-01** **Favourites** page lists the student's favourite clubs
  with their latest announcements, upcoming events, open recruitments
  and recent work. It is separate from **My Clubs**, which lists clubs
  the student is a member of.
- **FR-PROF-01** **Profile** shows: full name, username, college email,
  roll number, department, year, programme, clubs joined with club
  roles, and participation counts. Name, roll number, department, year
  and phone can be edited by the student. Username and email cannot be
  edited.
- **FR-SET-01** **Settings** has: change password, notification
  preferences, theme (light, dark, system).
- **FR-SHARE-01** Every event page has a **Share** button: the device
  share sheet where available, plus copy link and a WhatsApp link. The
  link opens the public event page (D9).
- **FR-CHECK-01** Members with `checkin.run` open a check-in screen,
  scan a student's QR ticket (camera) or type the code, and the
  registration becomes **attended**. Scanning twice shows "already
  checked in". (Phase 2)

### 4.11 Club workspace (CW)

For a member of a club the sidebar contains: **My Clubs** (switcher),
**Events**, **Add an event**, **Discussion**, **Profile**, **Settings**.
Further items appear only when the role allows: Announcements,
Recruitment, Members and roles, Registrations, Reports. A member can
switch to the **Student view** at any time with the same account. -
**FR-CW-01** The dashboard of a club shows upcoming events, event
statuses, open recruitment, latest announcements and pending tasks for
this member. - **FR-CW-02** **Members and roles** lists members with
their club role. Members with `member.manage` change roles or remove
members. The Leader can transfer leadership. - **FR-CW-03** Event page
for members has tabs: **Plan**, **Poster**, **Form**, **Registrations**,
**Hall**, **History**. Tabs and buttons that the role cannot use are
hidden or disabled with a tooltip explaining why.

### 4.12 OSI, Events Authority and Super Admin pages (ADMIN)

- **FR-ADMIN-01** **OSI:** Approvals queue, event review page, Clubs
  (create, edit, assign Leader, deactivate), calendar, content reports.
- **FR-ADMIN-02** **Events Authority:** Hall requests, Holds, Halls
  (CRUD), Blocked slots, Availability, calendar.
- **FR-ADMIN-03** **Super Admin:** Users (create admin, suspend), Audit
  log, Settings.

### 4.13 Chatbot (CHAT, Phase 3)

- **FR-CHAT-01** A chat panel for logged-in users answers questions
  about a particular club or general portal questions, using only portal
  data (section 14).

### 4.14 Non-functional requirements (NFR)

- **NFR-01** Pages load in under 2 seconds on a typical campus
  connection for lists of up to 200 items.
- **NFR-02** Works on current Chrome, Edge, Firefox and Safari, and from
  360 px wide screens up.
- **NFR-03** Accessible: keyboard use, visible focus, labels on all
  inputs, colour contrast of at least 4.5:1, status never shown by
  colour alone.
- **NFR-04** Passwords are hashed, tokens are never logged, personal
  answers are visible only to permitted members.
- **NFR-05** All timestamps stored in UTC and shown in the configured
  time zone.
- **NFR-06** Every API error has a stable code (section 10.2).
- **NFR-07** The same automated test suite passes on SQLite and on
  PostgreSQL.

------------------------------------------------------------------------

## 5. Workflows and state machines

### 5.1 Event lifecycle

    stateDiagram-v2
      [*] --> draft
      draft --> submitted: Leader submits and tentative hold is placed
      submitted --> changes_requested: OSI asks for changes
      submitted --> rejected: OSI rejects (hold released)
      submitted --> approved: OSI approves and circulates
      changes_requested --> submitted: Leader resubmits
      approved --> completed: end time passes
      draft --> cancelled
      changes_requested --> cancelled
      submitted --> cancelled
      approved --> cancelled
      rejected --> [*]
      completed --> [*]
      cancelled --> [*]

`events.status` holds: `draft`, `submitted`, `changes_requested`,
`rejected`, `approved`, `completed`, `cancelled`. Registration status
lives on the form (`draft`, `published`, `closed`). Hall status lives on
the hall booking (`tentative`, `requested`, `confirmed`, `denied`,
`released`, `expired`). Keeping these as three small state machines
avoids one huge one. Any transition not in the diagram returns
`409 INVALID_STATE`.

### 5.2 End-to-end event flow

1.  Event Coordinator or Leader creates the **draft** with plan and
    poster. Other members may draft forms.
2.  Leader checks hall availability and **submits**. A **tentative
    hold** is created and the OSI is notified.
3.  OSI **approves and circulates**. The event is public. Students are
    notified (D15).
4.  A member with `registration.publish` **publishes the registration
    form**. The seat limit equals the held hall's capacity. The club
    posts the link in its announcements (a button "Post to
    announcements" pre-fills it).
5.  Students **register**. QR tickets are issued.
6.  Registration **closes** at the deadline.
7.  Leader (or Vice Leader) sends the **final hall request** with the
    real count. If the count is much larger or smaller than the held
    hall allows, they pick a better hall from the free list.
8.  Events Authority **approves** (or changes) the hall. The venue is
    confirmed to the club and to every registered student.
9.  On the day, members **check in** students by QR.
10. After the end time the event is **completed**. Attendance appears in
    students' Activities.

### 5.3 Hall hold and booking rules

1.  A hold is placed in the same transaction as the submission. If the
    hall is not free for that time, or is smaller than the expected
    participants, submission fails with `HALL_UNAVAILABLE` and the free
    options are returned.
2.  A hold (`tentative`) blocks the hall exactly like a confirmed
    booking.
3.  A hold expires automatically when: the event is rejected or
    cancelled (released at once); the event is not approved within
    `HOLD_EXPIRY_DAYS` (default 14); or the event start time passes
    without a final request.
4.  The seat limit of the registration form defaults to the held hall's
    capacity. The Leader may lower it, but may only raise it by changing
    to a bigger hall.
5.  When the final request changes the hall, the old booking is
    `released` and a new one is created, both inside one transaction,
    with the overlap check repeated.
6.  Overlap rule: two bookings for the same hall conflict when
    `A.starts_at < B.ends_at AND B.starts_at < A.ends_at` and both
    statuses are in (`tentative`, `requested`, `confirmed`). Blocked
    slots use the same rule.
7.  Concurrency: the check and the insert run in one transaction. On
    PostgreSQL an exclusion constraint is added as a second line of
    defence (section 9.4).
8.  The registered count is not the attendance. The UI shows both
    numbers and an optional "expected turnout %" (set by the club) as a
    hint when choosing the hall. The system never assumes a turnout
    figure.

### 5.4 Recruitment flow

`draft` then `open` then `closed`. While `open` and before the deadline,
students can apply. Applications go `submitted`, then `shortlisted`,
`accepted` or `rejected`, or `withdrawn` by the student. Accepting
creates the membership in the same transaction as the status change.
Closing a recruitment does not change existing applications.

### 5.5 Registration flow

`registered`, then `attended` or `no_show` (set automatically after the
event for registered students not checked in), or `cancelled` by the
student before the event starts. Waitlist (`waitlisted`) is Phase 2.

### 5.6 Who is notified (summary)

See section 12 for the complete trigger table.

------------------------------------------------------------------------

## 6. Screens and navigation

Common to every role: top bar with **calendar icon**, **notification
bell**, and the sidebar. On phones the sidebar becomes a bottom tab bar
(section 13).

### 6.1 Student

Sidebar: **Clubs**, **Events**, **Favourites**, **My Clubs** (shown only
if the student is a member), **Activities**, **Profile**, **Settings**.
Chatbot button (Phase 3).

| Route | Screen |
|:---|:---|
| `/login`, `/signup`, `/verify-email`, `/forgot-password`, `/reset-password` | Public auth screens |
| `/clubs` | All clubs (search, category filter, favourite star, recruiting badge) |
| `/clubs/:slug` | Club page with tabs About, Our work, Announcements, Discussion, Events, Recruitment |
| `/events` | All approved events (filters: club, type, date, registered) |
| `/events/:id` | Event detail, poster, Register, Share, ticket (QR) after registering |
| `/favourites` | Favourite clubs and their updates |
| `/my-clubs` | Clubs the student is a member of, with role and "Open workspace" |
| `/activities` | Tabs: Current, Past, All registrations |
| `/calendar` | Full calendar |
| `/profile` | Academic profile and participation |
| `/settings` | Password, notification preferences, theme |
| `/e/:id` | Public share page (no login) |

### 6.2 Club member (club workspace)

Sidebar: **My Clubs** (club switcher), **Events**, **Add an event**,
**Discussion**, **Profile**, **Settings**, plus items shown by
permission: **Announcements**, **Recruitment**, **Members and roles**,
**Registrations**, **Reports**, and **Student view**.

| Route | Screen | Needs |
|:---|:---|:---|
| `/club/:clubId` | Dashboard | membership |
| `/club/:clubId/events` | Club events with status chips | membership |
| `/club/:clubId/events/new` | Add an event | `event.draft` |
| `/club/:clubId/events/:id` | Event workspace tabs: Plan, Poster, Form, Registrations, Hall, History | varies by tab |
| `/club/:clubId/announcements` | Post and manage announcements | `announcement.post` |
| `/club/:clubId/recruitment` | Recruitments and applications | `recruitment.manage` / `application.review` |
| `/club/:clubId/members` | Members and roles | membership (edit needs `member.manage`) |
| `/club/:clubId/discussion` | Internal discussion | membership |
| `/club/:clubId/profile` | Edit club page | `club.profile.edit` |
| `/club/:clubId/reports` | Statistics | `report.view` |

### 6.3 OSI

Sidebar: **Approvals**, **Clubs**, **Calendar**, **Reports**,
**Profile**, **Settings**. Routes: `/osi/approvals`,
`/osi/approvals/:eventId`, `/osi/clubs`, `/osi/clubs/new`,
`/osi/clubs/:id`.

### 6.4 Events Authority

Sidebar: **Hall requests**, **Holds**, **Halls**, **Availability**,
**Calendar**, **Profile**, **Settings**. Routes:
`/events-admin/requests`, `/events-admin/requests/:id`,
`/events-admin/holds`, `/events-admin/halls`,
`/events-admin/availability`.

### 6.5 Super Admin

Sidebar: **Users**, **Audit log**, **Settings**. Routes: `/admin/users`,
`/admin/audit`, `/admin/settings`.

### 6.6 Route guards

`<RequireAuth>` redirects to `/login`.
`<RequirePlatformRole roles={[...]}>` and
`<RequireClubPermission permission="...">` show a "You do not have
access" page (not a blank page). Guards are for experience only; the
server decides.

------------------------------------------------------------------------

## 7. Architecture and technology

### 7.1 Overview

    Browser (React SPA)  --HTTPS/JSON-->  Express API  --Knex-->  SQLite (dev/test) or PostgreSQL (hosted)
            ^                                  |
            |---- Server-Sent Events ----------+--> file storage (local disk in dev, object storage when hosted)
                                               +--> email (SMTP) and scheduled jobs (node-cron)

- **Frontend:** a single-page app. Server data is cached with TanStack
  Query.
- **Backend:** a layered Express app: routes, controllers, services,
  repositories. Business rules live in services only.
- **Real-time:** Server-Sent Events for notifications (simpler than
  WebSockets). A polling fallback checks the unread count every 30
  seconds.
- **Jobs:** hold expiry, 24-hour event reminders, marking no-shows,
  token clean-up.

### 7.2 Database decision (SQLite, PostgreSQL or MongoDB)

**Chosen:** one SQL schema, written with **Knex migrations**, run on
**SQLite** (zero set-up, used for local work and fast automated tests)
and on **PostgreSQL** (used when the portal is hosted, for example on a
free hosted Postgres service). MongoDB was considered and not chosen.

Why SQL: - The data is relational: users, clubs, memberships, roles,
events, registrations, halls, bookings. Most screens are joins ("events
of my favourite clubs that I have not registered for"). - Hall booking
needs transactions and constraints so two clubs can never hold the same
hall and time. - Reports (registrations per event, attendance per club)
are simple in SQL. - Unique constraints (one registration per student
per event) are enforced by the database, not only by code.

Why not MongoDB for this project: the same rules would have to be
rebuilt in application code, joins become manual, and hall
double-booking is harder to guarantee. If the team still prefers
MongoDB, the repository layer is the only place that touches the
database, so a Mongo implementation can be written later, but the
transaction and constraint tests in section 15 would have to be
rewritten.

**Rules to keep both databases working (apply in every migration):** 1.
No database-specific enum types. Use `text` columns with
`CHECK (... IN (...))` created with Knex `.checkIn([...])`. 2. Primary
keys are UUID strings generated in the application
(`crypto.randomUUID()`). 3. Store JSON as text columns named `*_json`
and parse in the repository. Do not use PostgreSQL-only JSON operators
in queries. 4. Store timestamps in UTC through one helper (`toDb(date)`
and `fromDb(value)`) so SQLite and PostgreSQL return identical values.
Test the round trip (TC-DB-13). 5. Booleans are written and read through
the repository helper (SQLite stores 0 or 1). 6. Case-insensitive
uniqueness for email and username: store the lower-cased value in the
column and compare lower-cased input. 7. Do not rely on `RETURNING`
behaviour that differs; use Knex's cross-dialect options. 8. Any
PostgreSQL-only extra (for example the hall exclusion constraint) goes
in a separate migration guarded by
`if (knex.client.config.client === 'pg')`.

### 7.3 Technology choices

| Area | Choice | Reason |
|:---|:---|:---|
| Runtime | Node.js 20 LTS or newer | Current long-term support |
| Package manager | npm workspaces | One install, shared package |
| Frontend | React 18, Vite, React Router, TanStack Query | Fast to build, widely known |
| Forms | React Hook Form with Zod resolvers | Shared validation with the API |
| Dates | date-fns and date-fns-tz | Time zone handling |
| Styling | Plain CSS with design tokens (CSS custom properties) and CSS modules | No heavy dependency, easy theming |
| QR | `qrcode` (API) and `qrcode.react` (web), camera scan with `html5-qrcode` | Tickets and check-in |
| Backend | Express 4 or 5, `helmet`, `cors`, `cookie-parser`, `express-rate-limit`, `pino` | Standard, small |
| Validation | Zod (schemas in `packages/shared`) | One definition, two apps |
| Database access | Knex with `better-sqlite3` and `pg` | Same code on both databases |
| Auth | Own implementation: `bcryptjs`, `jsonwebtoken`, opaque refresh tokens | Required by the team (section 11) |
| Uploads | `multer` plus file type check | Posters, logos |
| Email | `nodemailer` (Ethereal or console in development, SMTP when hosted) | Verification and reset links |
| Jobs | `node-cron` | Hold expiry, reminders |
| Tests | Vitest, Supertest, React Testing Library, MSW, Playwright | Section 15 |
| Quality | ESLint, Prettier, Husky pre-commit | Consistency |
| CI | GitHub Actions | Runs tests on SQLite and PostgreSQL |

### 7.4 Hosting plan (free or low-cost tiers are enough to start)

Frontend on a static host, API on a small Node host, PostgreSQL on a
hosted free tier, uploaded files on object storage (a disk on a free
host may be wiped, so do not store posters only on the API's disk when
hosted). Keep every connection detail in environment variables.

------------------------------------------------------------------------

## 8. Repository and folder structure

A single repository ("monorepo"):

    campus-clubs-portal/
    ├─ CLAUDE.md                     # short rules for Claude (see Appendix B)
    ├─ README.md                     # how to run
    ├─ CHANGELOG.md
    ├─ package.json                  # npm workspaces: apps/*, packages/*
    ├─ .env.example
    ├─ .gitignore
    ├─ docker-compose.yml            # optional local PostgreSQL
    ├─ .github/workflows/ci.yml      # lint, unit, API tests on sqlite + postgres, e2e
    ├─ docs/
    │  ├─ PROJECT_SPEC.md            # this document
    │  ├─ DECISIONS.md               # log of choices made while building
    │  ├─ ERD.md                     # entity diagram (kept in sync with migrations)
    │  └─ faq/                       # markdown facts used by the chatbot (Phase 3)
    ├─ packages/
    │  └─ shared/                    # imported by api and web
    │     └─ src/
    │        ├─ permissions.js       # permission keys, default role matrix
    │        ├─ roles.js             # platform roles, club role keys
    │        ├─ statuses.js          # event, booking, registration, application statuses
    │        ├─ errors.js            # error codes
    │        ├─ constants.js         # OSI label, limits, categories, event types
    │        └─ schemas/             # Zod: auth, club, event, form, registration, hall ...
    ├─ apps/
    │  ├─ api/
    │  │  ├─ package.json
    │  │  ├─ knexfile.js
    │  │  ├─ src/
    │  │  │  ├─ server.js           # starts the app and the jobs
    │  │  │  ├─ app.js              # builds Express app (used by tests)
    │  │  │  ├─ config/             # env loading and validation
    │  │  │  ├─ db/
    │  │  │  │  ├─ knex.js
    │  │  │  │  ├─ migrations/      # 001_users.js, 002_auth_tokens.js, ...
    │  │  │  │  ├─ seeds/           # 01_halls.js, 02_clubs.js, 03_admins.js, 04_sample.js
    │  │  │  │  └─ helpers.js       # toDb, fromDb, boolean helpers
    │  │  │  ├─ middleware/         # requireAuth, requirePlatformRole, requireClubPermission,
    │  │  │  │                      # validate, rateLimit, upload, errorHandler, requestId
    │  │  │  ├─ modules/            # one folder per feature: routes, controller, service, repo, tests
    │  │  │  │  ├─ auth/
    │  │  │  │  ├─ users/           # profile, me, change password
    │  │  │  │  ├─ clubs/
    │  │  │  │  ├─ members/         # memberships, roles, leadership transfer
    │  │  │  │  ├─ announcements/
    │  │  │  │  ├─ discussions/
    │  │  │  │  ├─ recruitment/     # recruitments, positions, applications
    │  │  │  │  ├─ events/
    │  │  │  │  ├─ osi/             # review decisions
    │  │  │  │  ├─ forms/
    │  │  │  │  ├─ registrations/   # includes check-in and tickets
    │  │  │  │  ├─ halls/
    │  │  │  │  ├─ bookings/        # holds, final requests, decisions
    │  │  │  │  ├─ calendar/
    │  │  │  │  ├─ notifications/   # service, SSE stream, preferences
    │  │  │  │  ├─ activities/
    │  │  │  │  ├─ favourites/
    │  │  │  │  ├─ share/           # public event page data
    │  │  │  │  ├─ admin/           # admin users, audit log
    │  │  │  │  └─ chat/            # Phase 3
    │  │  │  ├─ jobs/               # holdExpiry.js, reminders.js, noShows.js, tokenCleanup.js
    │  │  │  └─ lib/                # mailer, storage, clock, ids, csv, logger
    │  │  ├─ uploads/               # local files in development (git-ignored)
    │  │  └─ tests/
    │  │     ├─ helpers/            # test app, db reset, auth helpers, fake clock
    │  │     ├─ factories/          # createUser, createClub, createEvent, createHall ...
    │  │     ├─ db/                 # constraint and migration tests
    │  │     ├─ unit/               # services and helpers
    │  │     └─ integration/        # endpoint tests per module
    │  └─ web/
    │     ├─ package.json
    │     ├─ index.html
    │     ├─ vite.config.js
    │     └─ src/
    │        ├─ main.jsx
    │        ├─ app/                # router.jsx, providers.jsx, guards/
    │        ├─ api/                # client.js (fetch + refresh), one hooks file per module
    │        ├─ auth/               # AuthContext, useAuth, usePermissions
    │        ├─ components/
    │        │  ├─ ui/              # Button, Input, Select, Modal, Tabs, Pill, Avatar, Toast ...
    │        │  ├─ layout/          # AppShell, Sidebar, TopBar, BottomTabs, PageBanner
    │        │  ├─ notifications/   # BellButton, NotificationPanel, ToastStack
    │        │  ├─ calendar/        # MonthGrid, AgendaList, CalendarFilters
    │        │  ├─ forms/           # FormBuilder, FormRenderer, FieldEditors
    │        │  └─ halls/           # HallPicker, AvailabilityTimeline
    │        ├─ features/           # student/, club/, osi/, events-admin/, admin/ (screens by role)
    │        ├─ pages/              # public pages: Login, Signup, PublicEvent, NotFound
    │        ├─ styles/             # tokens.css, base.css, utilities.css
    │        ├─ utils/              # dates, formatters, permissions helpers
    │        └─ test/               # setup, MSW handlers, render helpers
    └─ e2e/
       ├─ playwright.config.js
       └─ tests/                    # end-to-end journeys

Naming: files in `kebab-case` or `camelCase` consistently per folder
(modules `camelCase.js`), React components `PascalCase.jsx`, database
tables and columns `snake_case`, API paths `kebab-case`.

------------------------------------------------------------------------

## 9. Database design

### 9.1 Entity overview

    erDiagram
      USERS ||--o{ CLUB_MEMBERS : has
      CLUBS ||--o{ CLUB_MEMBERS : has
      CLUBS ||--o{ CLUB_ROLES : defines
      CLUB_ROLES ||--o{ CLUB_ROLE_PERMISSIONS : grants
      CLUB_ROLES ||--o{ CLUB_MEMBERS : assigned
      CLUBS ||--o{ CLUB_WORKS : shows
      CLUBS ||--o{ ANNOUNCEMENTS : posts
      CLUBS ||--o{ DISCUSSIONS : hosts
      DISCUSSIONS ||--o{ DISCUSSION_MESSAGES : contains
      CLUBS ||--o{ EVENTS : hosts
      EVENTS ||--o{ EVENT_REVIEWS : reviewed_by_osi
      EVENTS ||--o| FORMS : registration_form
      FORMS ||--o{ FORM_RESPONSES : receives
      EVENTS ||--o{ REGISTRATIONS : has
      USERS ||--o{ REGISTRATIONS : makes
      HALLS ||--o{ HALL_BOOKINGS : booked
      HALLS ||--o{ HALL_BLOCKED_SLOTS : blocked
      EVENTS ||--o{ HALL_BOOKINGS : needs
      CLUBS ||--o{ RECRUITMENTS : opens
      RECRUITMENTS ||--o{ RECRUITMENT_POSITIONS : lists
      RECRUITMENTS ||--o{ APPLICATIONS : receives
      USERS ||--o{ APPLICATIONS : submits
      USERS ||--o{ FAVORITE_CLUBS : marks
      CLUBS ||--o{ FAVORITE_CLUBS : marked
      USERS ||--o{ NOTIFICATIONS : receives

### 9.2 Tables

Common columns on most tables: `id` (text UUID, primary key),
`created_at`, `updated_at` (UTC). "FK" means foreign key. Status columns
use `CHECK ... IN (...)`.

**users** `id`, `username` (unique, lower-case), `email` (unique,
lower-case), `password_hash`, `full_name`, `platform_role`
(`student|osi_admin|events_admin|super_admin`, default `student`),
`roll_number`, `department`, `year_of_study` (1 to 6), `programme`,
`phone`, `avatar_url`, `email_verified_at`, `must_change_password`
(bool), `status` (`active|suspended`), `last_login_at`, timestamps.
Indexes: unique on `username`, unique on `email`.

**auth_tokens** (email verification and password reset) `id`, `user_id`
FK, `type` (`verify_email|reset_password`), `token_hash`, `expires_at`,
`used_at`, `created_at`. Index on `token_hash`.

**refresh_tokens** `id`, `user_id` FK, `token_hash`, `family_id`,
`expires_at`, `revoked_at`, `replaced_by_id`, `user_agent`, `ip`,
`created_at`. Index on `token_hash`, `family_id`.

**clubs** `id`, `slug` (unique), `name` (unique), `category`, `tagline`,
`description`, `why_join`, `aim`, `faculty_coordinator`, `founded_year`,
`meeting_info`, `contact_email`, `logo_url`, `cover_url`,
`public_discussion_enabled` (bool), `status` (`active|inactive`),
`created_by` FK users, timestamps.

**club_works** `id`, `club_id` FK, `title`, `description`, `link_url`,
`image_url`, `happened_on` (date), `created_by`, timestamps.

**club_roles** `id`, `club_id` FK, `key`
(`LEADER|VICE_LEADER|SECRETARY|EVENT_COORDINATOR|MEDIA_LEAD|MEMBER` or
custom key later), `name`, `is_system` (bool), timestamps. Unique
(`club_id`, `key`).

**club_role_permissions** `club_role_id` FK, `permission` (text, must be
a key from `permissions.js`). Primary key (`club_role_id`,
`permission`).

**club_members** `id`, `club_id` FK, `user_id` FK, `club_role_id` FK,
`status` (`active|left|removed`), `joined_at`, `left_at`, `added_via`
(`recruitment|direct|osi`), timestamps. Unique (`club_id`, `user_id`).
Indexes on `user_id`, `club_id`. The one-active-Leader rule is enforced
in the service layer.

**favorite_clubs** `user_id` FK, `club_id` FK, `created_at`. Primary key
(`user_id`, `club_id`).

**announcements** `id`, `club_id` FK, `author_id` FK, `title`, `body`,
`image_url`, `is_pinned` (bool), `deleted_at`, timestamps. Index
(`club_id`, `created_at`).

**discussions** `id`, `club_id` FK, `scope` (`internal|public`),
`title`, `created_by`, timestamps. Unique (`club_id`, `scope`) for the
single default channel per scope in version 1.

**discussion_messages** `id`, `discussion_id` FK, `user_id` FK, `body`,
`deleted_at`, `deleted_by`, `reported_count`, `created_at`. Index
(`discussion_id`, `created_at`).

**events** `id`, `club_id` FK, `title`, `type`
(`workshop|hackathon|talk|cultural|competition|exhibition|recruitment_drive|other`),
`summary`, `description`, `objectives`, `agenda_json`,
`faculty_coordinator`, `mode` (`offline|online|hybrid`), `online_link`,
`starts_at`, `ends_at`, `registration_deadline`,
`expected_participants`, `max_seats`, `poster_url`, `status` (section
5.1), `submitted_by`, `submitted_at`, `circulated_at`, `hall_id`
(nullable FK, set when confirmed), `cancelled_reason`, `created_by`,
timestamps. Checks: `ends_at > starts_at`;
`registration_deadline <= starts_at`; `expected_participants >= 1`.
Indexes: (`status`, `starts_at`), (`club_id`, `starts_at`).

**event_reviews** (OSI decision history) `id`, `event_id` FK,
`reviewer_id` FK, `decision` (`approved|rejected|changes_requested`),
`note`, `created_at`.

**forms** `id`, `club_id` FK, `event_id` (nullable FK), `recruitment_id`
(nullable FK), `purpose` (`event_registration|recruitment`), `title`,
`description`, `fields_json`, `status` (`draft|published|closed`),
`opens_at`, `closes_at`, `published_at`, `created_by`, timestamps.
Check: exactly one of `event_id`, `recruitment_id` is set. Unique on
`event_id` and on `recruitment_id` (one form each).

`fields_json` is an array of
`{ id, type, label, help, required, options?, min?, max?, maxLength? }`.
Types: `short_text`, `long_text`, `number`, `email`, `phone`,
`single_choice`, `dropdown`, `multi_choice`, `date`, `consent`. The Zod
schema for it lives in `packages/shared`.

**form_responses** `id`, `form_id` FK, `user_id` FK, `answers_json`,
`submitted_at`. Unique (`form_id`, `user_id`).

**registrations** `id`, `event_id` FK, `user_id` FK, `form_response_id`
FK, `status` (`registered|cancelled|attended|no_show|waitlisted`),
`qr_token` (unique), `checked_in_at`, `checked_in_by`, `cancelled_at`,
timestamps. Unique (`event_id`, `user_id`). Indexes on `event_id`,
`user_id`.

**recruitments** `id`, `club_id` FK, `title`, `description`, `deadline`,
`status` (`draft|open|closed`), `auto_accept` (bool), `created_by`,
timestamps.

**recruitment_positions** `id`, `recruitment_id` FK, `title`,
`description`, `openings` (\>= 1).

**applications** `id`, `recruitment_id` FK, `position_id` (nullable FK),
`user_id` FK, `form_response_id` FK, `status`
(`submitted|shortlisted|accepted|rejected|withdrawn`), `reviewed_by`,
`reviewed_at`, `note`, timestamps. Unique (`recruitment_id`, `user_id`).

**halls** `id`, `name` (unique), `building`, `floor`, `capacity` (\> 0),
`facilities_json`, `is_active` (bool), timestamps.

**hall_blocked_slots** `id`, `hall_id` FK, `starts_at`, `ends_at`,
`reason`, `created_by`, `created_at`. Check `ends_at > starts_at`. Index
(`hall_id`, `starts_at`).

**hall_bookings** `id`, `hall_id` FK, `event_id` FK, `club_id` FK,
`status` (`tentative|requested|confirmed|denied|released|expired`),
`starts_at`, `ends_at`, `expected_count`, `registered_count`,
`requested_by`, `requested_at`, `decided_by`, `decided_at`,
`decision_note`, `expires_at`, timestamps. Index (`hall_id`,
`starts_at`, `ends_at`), (`event_id`), (`status`). Rule: one active
booking (`tentative`, `requested`, `confirmed`) per event, enforced in
the service.

**notifications** `id`, `user_id` FK, `category`
(`events|recruitment|club_updates|my_activity|approvals|system`), `type`
(section 12), `title`, `body`, `data_json` (for example
`{ "route": "/events/ID" }`), `dedupe_key` (nullable), `read_at`,
`created_at`. Unique (`user_id`, `dedupe_key`) when not null. Index
(`user_id`, `read_at`, `created_at`).

**notification_preferences** `user_id` FK, `category`, `in_app` (bool),
`email` (bool). Primary key (`user_id`, `category`).

**audit_logs** `id`, `actor_id` (nullable FK), `action`, `entity_type`,
`entity_id`, `meta_json`, `ip`, `created_at`. Index (`entity_type`,
`entity_id`), (`actor_id`, `created_at`).

**chat_messages** (Phase 3) `id`, `user_id` FK, `club_id` (nullable),
`role` (`user|assistant`), `content`, `sources_json`, `created_at`.

### 9.3 Delete rules

- Users and clubs are never hard-deleted. Use `status` (`suspended`,
  `inactive`).
- Deleting a club role or club cascades to `club_role_permissions` only.
- Tokens and notifications cascade when a user is removed in tests or by
  a data-retention job.
- Announcements and discussion messages use `deleted_at` (soft delete)
  and are excluded from every list query by default.
- Events are cancelled, not deleted, once submitted. Drafts may be
  hard-deleted.

### 9.4 Constraints that must exist in the database (not only in code)

Unique email and username; unique registration per (event, user); unique
form response per (form, user); unique membership per (club, user);
status `CHECK`s; `ends_at > starts_at`; `capacity > 0`; foreign keys on.
On SQLite enable `PRAGMA foreign_keys = ON` for every connection
(`pool.afterCreate`). On PostgreSQL also add the exclusion constraint on
`hall_bookings` using a `tstzrange` of the time window for rows whose
status is in (`tentative`, `requested`, `confirmed`), in a separate
PostgreSQL-only migration.

### 9.5 Seed data

- `01_halls`: the six sample halls from Appendix A.
- `02_clubs`: eight sample clubs with default roles and permissions
  created from `packages/shared/src/permissions.js`.
- `03_admins`: one `super_admin`, one `osi_admin`, one `events_admin`.
  Passwords come from environment variables and the accounts require a
  password change at first login.
- `04_sample`: sample students, memberships (one member per club role in
  the first club), events in each status, announcements, a recruitment.
  Run only when `SEED_SAMPLE=true`.
- All seeds are **idempotent**: running them twice creates no duplicates
  (TC-DB-16).

------------------------------------------------------------------------

## 10. API design

Base path `/api/v1`. JSON in and out. Dates are ISO 8601 in UTC
(`2026-11-03T09:30:00.000Z`).

### 10.1 Conventions

- **Success:**
  `{ "data": ..., "meta": { "page": 1, "pageSize": 20, "total": 134 } }`
  (`meta` only on lists).
- **Error:**
  `{ "error": { "code": "FORBIDDEN", "message": "You do not have permission to do this.", "details": [...] } }`.
- **Pagination:** `?page=1&pageSize=20` (maximum 100). **Sorting:**
  `?sort=starts_at` or `?sort=-starts_at`.
- **Auth:** `Authorization: Bearer <access token>`. Refresh token is an
  httpOnly cookie.
- **Validation:** every body, query and path parameter is validated with
  a Zod schema from `packages/shared`.
- **Access column below:** `public`, `auth` (any logged-in user),
  `student`, `member` (active member of the club), a permission key, or
  an admin role.

### 10.2 Error codes

`VALIDATION_ERROR` (400), `UNAUTHENTICATED` (401), `FORBIDDEN` (403),
`NOT_FOUND` (404), `CONFLICT` (409), `INVALID_STATE` (409),
`HALL_UNAVAILABLE` (409), `REGISTRATION_CLOSED` (409), `SEATS_FULL`
(409), `ALREADY_REGISTERED` (409), `RATE_LIMITED` (429),
`PAYLOAD_TOO_LARGE` (413), `UNSUPPORTED_FILE` (415), `INTERNAL` (500).

### 10.3 Endpoints

**Auth and account**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `POST /auth/signup` | public | Create student account, send verification email |
| `POST /auth/verify-email` | public | Body `{ token }` |
| `POST /auth/resend-verification` | public | Always returns 200 |
| `POST /auth/login` | public | Returns access token and user, sets refresh cookie |
| `POST /auth/refresh` | cookie | Rotates refresh token, returns new access token |
| `POST /auth/logout` | auth | Revokes the refresh token family |
| `POST /auth/forgot-password` | public | Always returns 200 |
| `POST /auth/reset-password` | public | Body `{ token, password }` |
| `GET /me` | auth | User, platform role, memberships with club role and permission keys |
| `PATCH /me/profile` | auth | Edit allowed profile fields |
| `POST /me/change-password` | auth | Body `{ currentPassword, newPassword }` |
| `GET /me/notification-preferences`, `PUT ...` | auth | Read and save preferences |

**Clubs, favourites, members**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /clubs` | auth | List with `q`, `category`, `recruiting` |
| `GET /clubs/:idOrSlug` | auth | Club detail |
| `POST /clubs` | osi_admin | Create club and default roles, assign Leader |
| `PATCH /clubs/:id` | `club.profile.edit` or osi_admin | Edit club |
| `GET /clubs/:id/works`, `POST`, `PATCH /:workId`, `DELETE /:workId` | read: auth, write: `club.works.manage` | Our work |
| `POST /clubs/:id/favourite`, `DELETE /clubs/:id/favourite` | student | Favourite toggle |
| `GET /me/favourites` | auth | Favourite clubs with latest updates |
| `GET /me/clubs` | auth | Clubs I belong to, with role |
| `GET /clubs/:id/members` | member | Members with roles |
| `POST /clubs/:id/members` | `member.manage` | Add a member directly (by college email) |
| `PATCH /clubs/:id/members/:userId` | `member.manage` | Change club role (not Leader) |
| `DELETE /clubs/:id/members/:userId` | `member.manage` or self | Remove or leave |
| `POST /clubs/:id/leadership-transfer` | `leadership.transfer` | Body `{ toUserId }` |
| `GET /clubs/:id/roles` | member | Roles and permission keys |
| `POST/PATCH/DELETE /clubs/:id/roles...` | `role.manage` | Custom roles (Phase 2) |

**Announcements and discussion**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /clubs/:id/announcements` | auth | Newest first, pinned on top |
| `POST /clubs/:id/announcements` | `announcement.post` | Create |
| `PATCH/DELETE /announcements/:id` | `announcement.post` (own) or `announcement.delete` | Edit, delete, pin |
| `GET /clubs/:id/discussions/:scope/messages` | `internal`: member, `public`: auth | List messages (Phase 2/3) |
| `POST /clubs/:id/discussions/:scope/messages` | `internal`: member, `public`: student if enabled | Post |
| `DELETE /discussion-messages/:id` | `discussion.moderate` or author | Remove |
| `POST /discussion-messages/:id/report` | auth | Report |

**Recruitment**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /clubs/:id/recruitments` | auth | Open one for students; all for members |
| `POST /clubs/:id/recruitments` | `recruitment.manage` | Create with positions |
| `PATCH /recruitments/:id` | `recruitment.manage` | Edit |
| `POST /recruitments/:id/open`, `/close` | `recruitment.manage` | Change status |
| `POST /recruitments/:id/apply` | student | Submit application (form answers) |
| `DELETE /recruitments/:id/apply` | student | Withdraw |
| `GET /recruitments/:id/applications` | `application.review` | Applications with answers |
| `PATCH /applications/:id` | `application.review` | Set status, optional club role |

**Events and OSI**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /events` | auth | Approved events; filters `club`, `type`, `from`, `to`, `registered` |
| `GET /events/:id` | auth | Detail (non-approved only for members of the club, OSI) |
| `GET /clubs/:id/events` | member | All statuses for the club |
| `POST /clubs/:id/events` | `event.draft` | Create draft |
| `PATCH /events/:id` | `event.draft` | Edit when `draft` or `changes_requested` |
| `DELETE /events/:id` | `event.draft` | Delete a draft |
| `POST /events/:id/poster` | `event.poster.upload` | Multipart upload |
| `POST /events/:id/submit` | `event.submit` | Body `{ hallId }`; validates and places hold |
| `POST /events/:id/cancel` | `event.draft` | Body `{ reason }` |
| `GET /osi/events?status=submitted` | osi_admin | Approval queue |
| `POST /osi/events/:id/decision` | osi_admin | Body `{ decision, note, circulate }` |
| `GET /public/events/:id` | public | Limited fields for the share page |

**Forms, registration, check-in**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /events/:id/form` | auth (published) or `form.manage` (draft) | Form definition |
| `PUT /events/:id/form` | `form.manage` | Create or replace draft form |
| `POST /events/:id/form/publish` | `registration.publish` | Needs event `approved`. Sets seats and closing time |
| `POST /events/:id/form/close` | `registration.publish` | Close registration |
| `POST /events/:id/register` | student | Submit registration |
| `DELETE /events/:id/register` | student | Cancel registration |
| `GET /events/:id/registrations` | `registration.view` | List with answers; counts for other members |
| `GET /events/:id/registrations/export` | `registration.view` | CSV |
| `GET /me/registrations/:eventId/ticket` | student | QR data |
| `POST /events/:id/checkin` | `checkin.run` | Body `{ qrToken }` (Phase 2) |
| `GET /me/activities?scope=current or past` | auth | Activities |

**Halls and booking**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /halls` | auth | Hall list |
| `GET /halls/availability?from=&to=&minCapacity=` | `event.draft`, `event.submit`, `hall.request`, events_admin | Free halls and busy blocks |
| `POST /halls`, `PATCH /halls/:id` | events_admin | Manage halls |
| `POST /halls/:id/blocked-slots`, `DELETE /blocked-slots/:id` | events_admin | Block times |
| `DELETE /events/:id/hall-hold` | `event.submit` | Release my hold |
| `POST /events/:id/hall-request` | `hall.request` | Final request `{ hallId, registeredCount }` |
| `GET /events-admin/hall-requests?status=` | events_admin | Queue and holds |
| `POST /events-admin/hall-requests/:id/decision` | events_admin | `{ decision: approve or deny, hallId?, note }` |

**Calendar, notifications, admin, chat**

| Method and path | Access | Purpose |
|:---|:---|:---|
| `GET /calendar?from=&to=&filter=` | auth | Items for the range (section 4.8) |
| `GET /calendar.ics` | auth | Personal ICS feed (Phase 2) |
| `GET /notifications?page=` | auth | List |
| `GET /notifications/unread-count` | auth | Count |
| `POST /notifications/:id/read`, `POST /notifications/read-all` | auth | Mark read |
| `POST /notifications/stream-token` | auth | Short-lived token for the stream |
| `GET /notifications/stream?token=` | token | Server-Sent Events |
| `GET /admin/users`, `POST /admin/users`, `PATCH /admin/users/:id` | super_admin | Manage admin accounts, suspend |
| `GET /admin/audit-logs` | super_admin | Filter by entity, actor, date |
| `POST /chat` | auth | Phase 3 |
| `GET /health` | public | Liveness and database check |

### 10.4 Example payloads

Submit an event:

    POST /api/v1/events/9f1c.../submit
    { "hallId": "b7d2..." }

Success returns the event with `status: "submitted"` and the booking
`{ status: "tentative", expiresAt: "..." }`. Failure when the hall is
busy:

    { "error": { "code": "HALL_UNAVAILABLE", "message": "Seminar Hall A is booked from 14:00 to 16:00 on that day.",
      "details": { "alternatives": [ { "hallId": "...", "name": "Seminar Hall B", "capacity": 120 } ] } } }

Register for an event:

    POST /api/v1/events/9f1c.../register
    { "answers": { "f_team_pref": "Solo", "f_laptop": "Yes", "f_consent": true } }

------------------------------------------------------------------------

## 11. Authentication and security (own implementation)

### 11.1 Sign-up and verification

1.  Validate the body (Zod). Reject emails outside
    `ALLOWED_EMAIL_DOMAINS`. Lower-case the email and username.
2.  Hash the password with `bcryptjs` (cost 12). Minimum 8 characters,
    rejected if it appears in a list of very common passwords or
    contains the username.
3.  Create the user with `email_verified_at = null`. Create a
    verification token: 32 random bytes, stored only as a SHA-256 hash,
    valid for 24 hours, single use.
4.  Send the link `${WEB_URL}/verify-email?token=...` (in development
    the mailer prints it to the console).

### 11.2 Login and tokens

- Access token: JWT signed with `JWT_SECRET`, 15 minutes, contains `sub`
  (user id) and `platformRole` only. Memberships and permissions are not
  put in the token; they are read from the database.
- Refresh token: 32 random bytes, stored as a hash in `refresh_tokens`,
  14 days, sent as an `httpOnly`, `Secure` (outside development),
  `SameSite=Lax` cookie with path `/api/v1/auth`.
- **Rotation:** each refresh issues a new refresh token and marks the
  old one replaced. If an already-replaced token is used again, the
  whole family is revoked (theft signal).
- Logout revokes the family and clears the cookie.
- The web app keeps the access token in memory only. On page load it
  calls `/auth/refresh` to get a new one.
- Login errors are generic ("Incorrect username or password"). Suspended
  or unverified accounts get a clear but safe message.
- **Brute force:** at most 5 failed attempts per account and IP in 15
  minutes, then 429 with a retry time. Sign-up and forgot-password are
  rate limited per IP.

### 11.3 Password reset and change

- Forgot password creates a reset token (hash stored, valid 1 hour,
  single use) and always returns the same response.
- Reset sets the new password, marks the token used and revokes every
  refresh token of the user.
- Change password requires the current password and revokes other
  sessions.
- Admin accounts created by the Super Admin have
  `must_change_password = true`. Until changed, only the change-password
  endpoint works.

### 11.4 Authorization middleware

- `requireAuth` verifies the access token and loads the user (rejects
  suspended users).
- `requirePlatformRole(...roles)`.
- `requireClubPermission(permission, resolveClubId)` finds the club
  (from the path, or from the event, announcement or recruitment) and
  checks the active membership and its role permissions.
- Services receive an `actor` object and never trust ids from the body
  to decide scope.

### 11.5 Other protections

- `helmet` headers, strict CORS to `WEB_URL`, JSON body limit, request
  id in logs.
- Parameterised queries only (Knex). No string-built SQL.
- Output is escaped by React. User text (announcements, discussion, form
  answers) is stored as plain text; if links are made clickable, do it
  with a safe renderer.
- Uploads: allow png, jpg, webp and pdf only, check the real file
  signature, maximum 5 MB, random file names, served with
  `X-Content-Type-Options: nosniff`.
- Personal form answers are returned only to members with
  `registration.view` or `application.review` of that club and to the
  student who wrote them.
- QR tokens are random and unguessable. Tickets are valid for one event
  only.
- Logs never contain passwords, tokens or full answers.
- Audit log for: logins that fail repeatedly, role changes, approvals,
  hall decisions, admin user changes.
- Data retention: configurable job to remove expired tokens and read
  notifications older than 180 days.

------------------------------------------------------------------------

## 12. Notifications

### 12.1 Triggers

| Type | When | Recipients | Category | Opens |
|:---|:---|:---|:---|:---|
| `event.published` | OSI approves and circulates | All students | `events` | `/events/:id` |
| `recruitment.opened` | Recruitment set to open | All students | `recruitment` | `/clubs/:slug` |
| `announcement.posted` | Announcement posted | Favourite followers and members of that club | `club_updates` | `/clubs/:slug` |
| `registration.confirmed` | Student registers | That student | `my_activity` | `/events/:id` |
| `event.reminder_24h` | 24 hours before start (job) | Registered students | `events` | `/events/:id` |
| `event.updated` | Date, time or venue changes | Registered students | `events` | `/events/:id` |
| `event.cancelled` | Event cancelled | Registered students and club members | `events` | `/events/:id` |
| `event.venue_confirmed` | Hall confirmed | Registered students and club members | `events` | `/events/:id` |
| `application.status` | Application status changes | The applicant | `my_activity` | `/activities` |
| `membership.added` | Student becomes member | That student | `my_activity` | `/my-clubs` |
| `role.changed` | Club role changes | That member | `my_activity` | `/club/:id/members` |
| `event.submitted` | Leader submits | All OSI admins | `approvals` | `/osi/approvals/:id` |
| `event.decision` | OSI decides | Leader and members with `event.draft` | `approvals` | `/club/:id/events/:eventId` |
| `hall.requested` | Final hall request | All Events Authority admins | `approvals` | `/events-admin/requests/:id` |
| `hall.decision` | Hall approved or denied | Leader and members with `hall.request` | `approvals` | `/club/:id/events/:eventId` |
| `hold.expiring` | 2 days before a hold expires | Leader | `approvals` | `/club/:id/events/:eventId` |
| `admin.account_created` | Admin account created | That admin | `system` | `/settings` |

Rules: a preference set to off for the category skips the in-app (or
email) copy. `my_activity` and `approvals` and `system` cannot be fully
switched off for in-app. Reminders use
`dedupe_key = event.reminder_24h:<eventId>` so the job can run
repeatedly without duplicates.

### 12.2 Delivery

- Notifications are saved in the database first, then pushed to the
  user's open streams.
- The web app opens `GET /notifications/stream?token=...` with
  `EventSource`. The short-lived stream token is requested from
  `POST /notifications/stream-token` (EventSource cannot send the
  Authorization header). The server sends a heartbeat comment every 25
  seconds.
- If the stream fails, the app polls `/notifications/unread-count` every
  30 seconds.
- Email copies (Phase 2) use the same triggers and the user's email
  preference.

### 12.3 Interface behaviour

- **Toast:** fixed at the top right, at most three stacked, each with
  title and the first 80 characters of the text. It stays 5 seconds
  (pauses on hover or focus), then runs a 500 ms animation that moves
  and shrinks it toward the bell's position and fades it. The bell badge
  then increases by one with a short pulse. With
  `prefers-reduced-motion`, it fades without moving. The toast is
  announced to screen readers with `role="status"`.
- **Bell:** shows the unread number (99+ above 99). Click opens a panel
  with the latest 20, unread highlighted, "Mark all read" and "See all".
- **Item click:** marks it read, closes the panel, and navigates to
  `data.route`.

------------------------------------------------------------------------

## 13. Frontend design

### 13.1 Look and feel: red and white

Professional, clean, and consistent. A deep-red sidebar (bottom tab bar
on phones), a red banner at the top of each page holding the page title
and key numbers, and white content cards below. A working example of
this look exists as a clickable prototype (the earlier "Campus Clubs
Portal" prototype); reproduce its tokens and structure, not its data.

Copy these tokens into `apps/web/src/styles/tokens.css` and build every
component from them. Never write a raw colour value inside a component.

    :root {
      --brand:#B01227; --brand-hover:color-mix(in srgb,var(--brand),#000 14%); --on-brand:#FFFFFF;
      --accent:#B01227; --banner-a:#C4182F; --banner-b:#8F0C20; --side:#7E0A1B;
      --bg:#FFFFFF; --surface:#FFFFFF; --surface-2:#FFF5F6; --tint:#FDE7EA;
      --ink:#2A1114; --ink-2:#6F5256; --line:#F1DADD; --line-strong:#E4BEC4;
      --ok:#17744A; --ok-bg:#E3F4EB; --warn:#8A5200; --warn-bg:#FFF0D2; --bad:#B3261E; --bad-bg:#FCE8E6;
      --s1:4px; --s2:8px; --s3:12px; --s4:16px; --s5:24px; --s6:32px; --s7:48px;
      --r-sm:6px; --r-md:10px; --r-lg:16px; --r-pill:999px;
      --e1:0 1px 2px rgba(80,15,25,.07); --e2:0 2px 4px rgba(80,15,25,.06),0 8px 24px rgba(80,15,25,.08);
      --font-display:"DM Serif Display",Georgia,serif; --font-body:"DM Sans",system-ui,sans-serif;
      --side-w:252px; --content-w:1080px;
    }
    /* Dark theme: redefine the same tokens (brand #C72C43, accent #FF8E9C, bg #140D0E, surface #1E1416,
       ink #F7ECED, line #38262A, side #3F0A13, banner-a #8E1829, banner-b #5A0F1B) under
       @media (prefers-color-scheme: dark) :root:not([data-theme="light"]) and :root[data-theme="dark"]. */

### 13.2 Layout rules

- Shell: grid with sidebar (252 px) and main. Below 900 px the sidebar
  becomes a fixed bottom tab bar and the top bar becomes red with the
  brand and the two icons.
- Every page uses `PageBanner` (title, short description, optional
  actions) followed by content in cards.
- Status is shown with a pill that has a dot and a text label (Approved,
  Pending, Rejected, Draft, Submitted and so on). Do not rely on colour
  alone.
- Spacing and radius only from the token scales. Use CSS grid or flex
  with `gap` instead of margins between siblings.
- Focus ring visible on every interactive element.

### 13.3 Key components

`AppShell`, `Sidebar`, `TopBar`, `BottomTabs`, `PageBanner`, `Card`,
`Button` (primary, secondary, light, danger), `Pill`, `Avatar` (club
initials), `Tabs`, `Modal`, `ConfirmDialog` (never `window.confirm`),
`EmptyState`, `Skeleton`, `DataTable`, `Pagination`, `FormField`,
`ToastStack`, `BellButton`, `NotificationPanel`, `MonthGrid`,
`AgendaList`, `FormBuilder`, `FormRenderer`, `HallPicker`,
`AvailabilityTimeline`, `QrTicket`, `QrScanner`, `RoleBadge`,
`PermissionGate` (renders children only if the permission is present).

### 13.4 State and data

- `AuthContext`: current user, memberships, permissions,
  `can(permission, clubId)`, `hasPlatformRole(...)`.
- TanStack Query for all server data, keys like `['events', filters]`.
  Mutations invalidate the related keys.
- API client: adds the bearer token, on 401 calls refresh once and
  retries, then logs out.
- Forms: React Hook Form with the Zod schemas from `packages/shared`.
- The last used club is remembered in `localStorage` (wrapped in
  try/catch).
- Every list screen has loading, empty and error states.

### 13.5 The form builder

Left: field palette. Centre: live preview. Right: field settings. Fields
can be added, reordered (keyboard accessible, not drag only),
duplicated, deleted. Validation: unique ids, labels required, choice
fields need at least two options. Preview uses the same `FormRenderer`
that students use.

### 13.6 Calendar component

Month grid with previous, next, today. Items drawn as chips: registered
(solid), others (outline), deadlines (dotted marker), recruitment
(diamond marker), private club items (dashed). Legend always visible. On
phones show an agenda list for the selected day below a compact month.
Filters as chips: All, My registrations, Favourites, My clubs.

------------------------------------------------------------------------

## 14. Chatbot (Phase 3)

- **Purpose:** answer questions about a particular club or about the
  portal for students (and members). Not a general assistant.
- **Endpoint:** `POST /api/v1/chat` with `{ message, clubId? }`. The API
  calls the Claude API from the server. Keys `ANTHROPIC_API_KEY` and
  `LLM_MODEL` come from the environment and never reach the browser.
- **Grounding:** the API first retrieves relevant text from the database
  and `docs/faq/*.md`: club description, aim, works, recent
  announcements (last 90 days), upcoming events, open recruitments.
  Retrieval uses SQLite FTS5 or PostgreSQL full text search. Only that
  text is sent to the model with an instruction to answer from it and to
  say when the answer is not there.
- **Answer format:** short answer, then "Sources" listing club or event
  pages, each a link in the portal.
- **Limits:** no personal data of other students, no registration
  answers, 20 messages per minute per user, a cap on message length, a
  timeout, and a friendly fallback message with the club contact when
  the model fails.
- **Safety:** the system prompt forbids following instructions that
  appear inside retrieved content; retrieved text is delimited and
  treated as data.
- **Tests:** mocked model client; golden questions with expected
  sources; a question with no answer returns the fallback; a
  prompt-injection string inside an announcement does not change
  behaviour.

------------------------------------------------------------------------

## 15. Testing

### 15.1 Strategy

| Level | Tool | What it covers | Where |
|:---|:---|:---|:---|
| Database | Vitest + Knex | Migrations, constraints, repository queries, seeds, booking overlap, concurrency | `apps/api/tests/db` |
| Unit | Vitest | Services, validators, helpers (permission checks, hold logic, form validation, date helpers) | `apps/api/tests/unit`, `packages/shared` |
| API integration | Vitest + Supertest | Every endpoint with a real test database: status codes, bodies, permissions | `apps/api/tests/integration` |
| Component | Vitest + React Testing Library + MSW | Screens, guards, forms, notification toast, calendar | `apps/web/src/**/*.test.jsx` |
| End-to-end | Playwright | Full journeys in a browser against a seeded test server | `e2e/tests` |
| Non-functional | axe, scripted checks | Accessibility, basic security probes, list performance | inside the suites above |

**Rules** 1. **Real database in tests.** API and database tests use
SQLite (`:memory:` or a temp file) with the real migrations. No mocking
of the database layer. 2. **Isolation.** Each test file starts with a
clean migrated database; each test wraps data creation in factories and
cleans tables it touched (or rolls back). 3. **Parity.** The `db` and
`integration` suites run in CI twice: once on SQLite and once on a
PostgreSQL service container. A failure on only one of them is a bug in
a migration or repository, not in the test. 4. **Time.** Use an
injectable clock (`lib/clock.js`) and fake timers for deadlines, hold
expiry, reminders and no-shows. Tests never depend on the real date. 5.
**Email and files.** Tests use a capturing mailer and a temporary upload
folder. 6. **Table-driven permission tests.** One test reads the matrix
from `packages/shared` and checks every role against every
permission-protected endpoint (TC-RBAC-10). Changing the matrix
automatically changes the test. 7. **Coverage targets.** At least 90%
line coverage in `auth`, `members`, `events`, `bookings`,
`registrations` services and the permission middleware; at least 80%
elsewhere in the API; every screen has at least one component test. 8.
**Naming.** Test titles begin with the test case ID, for example
`TC-REG-04 rejects a second registration`. 9. **Definition of done for a
task:** the related test cases exist and pass on both databases, lint
passes, and the checklist in section 17 is updated.

### 15.2 Database test cases

| ID | Test | Expected result |
|:---|:---|:---|
| TC-DB-01 | Run all migrations on an empty database (SQLite and PostgreSQL) | Succeeds; every table and index in section 9 exists |
| TC-DB-02 | Roll back all migrations, then migrate again | Rollback leaves an empty schema; second migration succeeds |
| TC-DB-03 | Insert two users with the same email in different letter case | Second insert fails (unique) |
| TC-DB-04 | Insert two users with the same username | Fails (unique) |
| TC-DB-05 | Insert a user with `platform_role = 'teacher'` | Fails (check) |
| TC-DB-06 | Insert invalid status values into events, forms, registrations, applications, hall_bookings, recruitments, clubs | Each fails (check) |
| TC-DB-07 | Insert a membership for a non-existent user or club | Fails (foreign key enforced on SQLite too) |
| TC-DB-08 | Insert two memberships for the same club and user | Second fails |
| TC-DB-09 | Insert two registrations for the same event and user | Second fails |
| TC-DB-10 | Duplicate form response (form, user) and duplicate application (recruitment, user) | Both fail |
| TC-DB-11 | Favourite the same club twice | Second fails (primary key) |
| TC-DB-12 | Event with `ends_at <= starts_at`, or `registration_deadline > starts_at`, or `expected_participants = 0` | Each fails |
| TC-DB-13 | Write a timestamp with milliseconds, read it back | Identical value on SQLite and PostgreSQL through the helpers |
| TC-DB-14 | Save and read `fields_json`, `answers_json`, `facilities_json`, `agenda_json` with nested data and unicode | Round trip is identical |
| TC-DB-15 | Hall with `capacity = 0`, or duplicate hall name | Fails |
| TC-DB-16 | Run all seeds twice | No duplicate rows, no errors |
| TC-DB-17 | After creating a club, compare its role permissions with the matrix in `packages/shared` | Exact match for all six roles |
| TC-DB-18 | Form with both `event_id` and `recruitment_id`, with neither, or two forms for one event | Each fails |
| TC-DB-19 | Soft-delete an announcement and a discussion message | Default list queries exclude them; admin queries can include them |
| TC-DB-20 | Overlap query on a hall: overlapping, contained, containing, identical, adjacent (end equals start) | Overlapping cases conflict; adjacent does not; `released`, `denied`, `expired` rows are ignored |
| TC-DB-21 | Two parallel booking transactions for the same hall and time | Exactly one succeeds, the other gets `HALL_UNAVAILABLE` |
| TC-DB-22 | PostgreSQL only: insert overlapping active bookings directly with SQL | Rejected by the exclusion constraint |
| TC-DB-23 | Insert two notifications with the same `user_id` and `dedupe_key` | Second fails; rows with null key are unaffected |
| TC-DB-24 | Query plans for the main list queries (events by status and date, notifications by user, registrations by event) | Use the intended index |
| TC-DB-25 | Token clean-up job with expired, revoked and valid tokens | Deletes only expired or revoked ones |
| TC-DB-26 | Delete a club role; try to delete a club that has events | Permissions cascade; club delete is restricted |
| TC-DB-27 | Exactly one active Leader per club | A second active Leader is rejected by the service in a transaction; transfer swaps atomically |
| TC-DB-28 | Seed with `SEED_SAMPLE=false` | No sample students or events are created |

### 15.3 Authentication test cases

| ID | Test | Expected result |
|:---|:---|:---|
| TC-AUTH-01 | Sign up with valid data | 201; user created unverified; verification mail captured; no password in response |
| TC-AUTH-02 | Sign up with a non-college email | 400 `VALIDATION_ERROR` |
| TC-AUTH-03 | Sign up with an existing email or username | 409 `CONFLICT` |
| TC-AUTH-04 | Sign up with a weak or common password | 400 |
| TC-AUTH-05 | Login before email verification | 403 with a clear message |
| TC-AUTH-06 | Verify with a valid token, then with the same token again, then with an expired token | Works once; later attempts fail |
| TC-AUTH-07 | Login with username and with email | Both succeed; access token and refresh cookie issued |
| TC-AUTH-08 | Wrong password and unknown user | Same generic error and similar response |
| TC-AUTH-09 | Six failed logins in 15 minutes | 429 with retry time; correct password also blocked until the window ends |
| TC-AUTH-10 | Refresh with a valid cookie | New access token; old refresh token no longer works |
| TC-AUTH-11 | Reuse an already-rotated refresh token | 401 and the whole token family is revoked |
| TC-AUTH-12 | Logout then refresh | 401 |
| TC-AUTH-13 | Tampered, expired or wrong-signature access token | 401 `UNAUTHENTICATED` |
| TC-AUTH-14 | Forgot password for existing and non-existing emails | Identical 200 response; mail sent only for existing |
| TC-AUTH-15 | Reset with valid token, reuse it, use an expired one | Works once; later attempts fail; all sessions revoked after success |
| TC-AUTH-16 | Change password with wrong and correct current password | Wrong is rejected; correct works and revokes other sessions |
| TC-AUTH-17 | Suspended user logs in or uses an existing token | Blocked |
| TC-AUTH-18 | Admin account with `must_change_password` calls another endpoint | 403 until password changed |
| TC-AUTH-19 | Any response containing a user | Never contains `password_hash` or token hashes |

### 15.4 Role and permission test cases

| ID | Test | Expected result |
|:---|:---|:---|
| TC-RBAC-01 | Call a protected endpoint with no token | 401 |
| TC-RBAC-02 | Student calls club workspace, OSI and Events Authority endpoints | 403 |
| TC-RBAC-03 | OSI tries to book or decide a hall; Events Authority tries to approve an event | 403 |
| TC-RBAC-04 | Member of Club A uses Club B's endpoints | 403 even with the Leader role in Club A |
| TC-RBAC-05 | Unknown permission key in middleware | Denied (deny by default) |
| TC-RBAC-06 | Leader submits an event; Vice Leader, Event Coordinator, Media Lead and Member try | Only Leader succeeds |
| TC-RBAC-07 | Media Lead posts an announcement and uploads a poster; tries to draft an event, build a form, send a hall request | First two succeed; last three 403 |
| TC-RBAC-08 | Secretary opens recruitment and reviews applications; tries to change a member's role | First two succeed; last 403 |
| TC-RBAC-09 | Member removed or role changed | Next request already reflects it |
| TC-RBAC-10 | **Table-driven:** for every club role and every permission-protected endpoint, expect allowed or denied exactly as in section 3.4 | All cells match the matrix |
| TC-RBAC-11 | Leadership transfer | Old Leader becomes Vice Leader (or chosen role), new Leader gets `event.submit`; exactly one Leader remains |
| TC-RBAC-12 | A Vice Leader tries to transfer leadership or remove the Leader | 403 |
| TC-RBAC-13 | `/me` for a user in two clubs with different roles | Returns each club with its own permission list |
| TC-RBAC-14 | Resource owned by another club referenced by id in the body | Scope is taken from the resource, not the body; request denied |
| TC-RBAC-15 | Student reads another student's registration answers or ticket | 403 or 404 |
| TC-RBAC-16 | Member without `registration.view` calls the registrations list | Gets counts only |

### 15.5 Event, approval and hall test cases

| ID | Test | Expected result |
|:---|:---|:---|
| TC-EVT-01 | Create a draft with valid data | 201, status `draft` |
| TC-EVT-02 | Create with end before start, or a deadline after the start | 400 |
| TC-EVT-03 | Edit a `submitted` or `approved` event | 409 `INVALID_STATE` |
| TC-EVT-04 | Submit without a poster or a required field | 400 listing the missing items |
| TC-EVT-05 | Submit with a free hall that fits | 200; status `submitted`; booking `tentative` |
| TC-EVT-06 | Submit with a hall that is booked, blocked, inactive or too small | 409 `HALL_UNAVAILABLE` with alternatives; event stays `draft` |
| TC-EVT-07 | Club already has the maximum number of holds | 409 with a clear message |
| TC-EVT-08 | OSI approves and circulates | Status `approved`; event appears in public list; students notified; review row written; audit row written |
| TC-EVT-09 | OSI rejects or requests changes without a note | 400 |
| TC-EVT-10 | OSI requests changes | Event editable again; Leader notified; resubmit works; hold kept |
| TC-EVT-11 | OSI rejects | Hold released; slot is free for others |
| TC-EVT-12 | Invalid transitions (approve a draft, submit an approved event, approve twice) | 409 `INVALID_STATE` |
| TC-EVT-13 | Cancel an approved event with registrations | Status `cancelled`; hall released; registrants notified |
| TC-EVT-14 | Poster upload with wrong type, fake extension, or over 5 MB | 415 or 413; valid image accepted |
| TC-EVT-15 | Non-approved event requested by a student | 404 |
| TC-EVT-16 | Hold not approved by `HOLD_EXPIRY_DAYS` | Job marks it `expired`; Leader notified two days before |
| TC-EVT-17 | Event end time passes | Status becomes `completed` |
| TC-HALL-01 | Availability for a date with bookings, holds and blocked slots | Returns only free halls with enough capacity |
| TC-HALL-02 | Final hall request before registration has closed | 409 |
| TC-HALL-03 | Final request keeping the same hall | Request created with the registered count |
| TC-HALL-04 | Final request changing the hall | Old booking `released`, new one created, overlap rechecked in one transaction |
| TC-HALL-05 | Events Authority approves | Booking `confirmed`; `events.hall_id` set; Leader and registrants notified |
| TC-HALL-06 | Events Authority denies without a note | 400 |
| TC-HALL-07 | Events Authority denies with a note | Club notified; club can request another hall |
| TC-HALL-08 | Back-to-back events in one hall (one ends when the next starts) | Both allowed |
| TC-HALL-09 | Two clubs submit for the same hall and time at the same moment | One succeeds; the other gets `HALL_UNAVAILABLE` |
| TC-HALL-10 | Events Authority adds a blocked slot over an existing hold | Warning returned; existing booking not silently changed |

### 15.6 Form, registration, recruitment test cases

| ID | Test | Expected result |
|:---|:---|:---|
| TC-FORM-01 | Save a form with each field type | Saved and returned unchanged |
| TC-FORM-02 | Duplicate field ids, empty label, choice field with one option | 400 |
| TC-FORM-03 | Publish before the event is approved | 409 |
| TC-FORM-04 | Publish after approval | Status `published`; seat limit equals held hall capacity |
| TC-FORM-05 | Raise the seat limit above the hall capacity | 400 unless a bigger hall is held |
| TC-REG-01 | Student registers with valid answers | 201; QR token created; confirmation notification |
| TC-REG-02 | Missing required answer, wrong type, number out of range, option not in list | 400 with field errors |
| TC-REG-03 | Register before publish, after close, or after the event started | 409 `REGISTRATION_CLOSED` |
| TC-REG-04 | Second registration by the same student | 409 `ALREADY_REGISTERED` |
| TC-REG-05 | Register when seats are full | 409 `SEATS_FULL` |
| TC-REG-06 | 30 students register at once for 10 seats | Exactly 10 succeed |
| TC-REG-07 | Cancel registration, then register again | Seat freed; new registration allowed if open |
| TC-REG-08 | Deadline passes | Registration closes automatically |
| TC-REG-09 | Registration list for `registration.view` and for another member | Full answers vs counts only |
| TC-REG-10 | CSV export | Correct columns, answers escaped, formula injection neutralised (cells starting with `=`, `+`, `-`, `@` are prefixed) |
| TC-REG-11 | Check-in with a valid, invalid, already-used or another event's QR code | Attended; 404; "already checked in"; 404 |
| TC-REG-12 | After the event, registered students not checked in | Marked `no_show` by the job |
| TC-REC-01 | Create and open a recruitment with positions | Visible to students with a Register button |
| TC-REC-02 | Apply after the deadline or when closed | 409 |
| TC-REC-03 | Apply twice | 409 |
| TC-REC-04 | Accept an application | Membership created in the same transaction with the chosen role; student notified |
| TC-REC-05 | Reject, shortlist, withdraw | Statuses and notifications correct; withdrawn cannot be decided |
| TC-REC-06 | Auto-accept recruitment | Membership created at once |
| TC-REC-07 | Student already a member applies | 409 |

### 15.7 Calendar, notification, student and public page test cases

| ID | Test | Expected result |
|:---|:---|:---|
| TC-CAL-01 | Student calendar for a month | Contains approved events of **all** clubs, including clubs the student is not in |
| TC-CAL-02 | Student calendar | Never contains drafts, submitted or rejected events |
| TC-CAL-03 | Registered and favourite flags | Set correctly on items |
| TC-CAL-04 | Club member calendar | Also contains own club's private items, flagged private |
| TC-CAL-05 | OSI and Events Authority calendars | Contain pending approvals and holds respectively |
| TC-CAL-06 | Event at 00:30 local time and at 23:30 local time | Appear on the correct local day |
| TC-CAL-07 | Registration and recruitment deadlines | Appear as deadline items |
| TC-NOTIF-01 | Each trigger in section 12.1 | Creates notifications for exactly the listed recipients |
| TC-NOTIF-02 | Category switched off | No in-app copy (except categories that cannot be switched off) |
| TC-NOTIF-03 | Unread count, mark read, mark all read | Correct |
| TC-NOTIF-04 | User reads or marks another user's notification | 404 |
| TC-NOTIF-05 | Reminder job run three times | One reminder per registered student |
| TC-NOTIF-06 | Stream token expired or reused | Stream refused |
| TC-NOTIF-07 | Notification created while the stream is open | Delivered in under 2 seconds in tests |
| TC-FAV-01 | Favourite and unfavourite, list favourites | Correct, idempotent |
| TC-ACT-01 | Activities Current and Past | Upcoming registrations and open applications vs attended, missed and decided |
| TC-SHARE-01 | Public event page | Returns title, poster, time, venue, club only; no personal data; 404 for non-approved events |
| TC-PROF-01 | Student edits profile | Allowed fields change; username and email cannot |
| TC-ANN-01 | Post, pin, delete announcements | Permissions as in the matrix; newest first, pinned on top |
| TC-DISC-01 | Internal discussion | Members only; student gets 403 |

### 15.8 Frontend component tests

| ID | Test |
|:---|:---|
| TC-UI-01 | Login and signup forms show field errors and disable submit while sending |
| TC-UI-02 | Route guards redirect logged-out users to login and show an access-denied page for the wrong role |
| TC-UI-03 | Sidebar items match the role (student, member with a given club role, OSI, Events Authority, Super Admin) |
| TC-UI-04 | `PermissionGate` hides controls the club role lacks (for example no "Submit to OSI" for a Media Lead) |
| TC-UI-05 | Notification toast appears, stays 5 seconds, animates into the bell, badge increases (fake timers); reduced-motion variant fades only |
| TC-UI-06 | Bell panel lists items, click marks read and navigates |
| TC-UI-07 | Calendar shows the markers, filters work, phone layout shows the agenda list |
| TC-UI-08 | Form builder: add, reorder with keyboard, delete, validation of options |
| TC-UI-09 | `FormRenderer` validates required and typed fields and prefills profile fields read-only |
| TC-UI-10 | Event page shows Register, Full, Closed, Registered states and the QR ticket |
| TC-UI-11 | Availability timeline marks the free and busy blocks and the selected window |
| TC-UI-12 | Every screen has loading, empty and error states |
| TC-UI-13 | axe finds no serious accessibility violations on the main screens |
| TC-UI-14 | Theme switch changes tokens; all text keeps contrast in both themes |

### 15.9 End-to-end journeys (Playwright)

| ID | Journey |
|:---|:---|
| E2E-01 | Student signs up, verifies (auto-verify in test), logs in, browses clubs, favourites one, opens its page |
| E2E-02 | Leader drafts an event with a poster and form, submits with a hall; OSI approves; student sees it in Events, Calendar and notifications, and registers; ticket shown |
| E2E-03 | Registration closes; Leader sends the final hall request; Events Authority approves; student sees the confirmed venue |
| E2E-04 | Club opens recruitment; student applies; Secretary accepts; student sees the club under My Clubs |
| E2E-05 | Role limits: Media Lead can post an announcement and upload a poster but sees no Submit button; Event Coordinator can build the form but cannot submit |
| E2E-06 | Two Leaders try to hold the same hall and time; the second is told and offered alternatives |
| E2E-07 | Student shares an event link; a logged-out visitor sees the public page and is asked to log in to register |
| E2E-08 | Password reset end to end |
| E2E-09 | Check-in: member scans (or types) a ticket; the event appears under Past in the student's Activities |

### 15.10 Non-functional checks

- **Security probes:** SQL injection strings in search and form answers;
  script tags in announcement text are shown as text; upload of an HTML
  file renamed to `.png` is rejected; rate-limit headers present; CORS
  refuses other origins.
- **Performance smoke:** with seed data of 200 clubs-worth of events and
  5,000 registrations, the events list, calendar month and registration
  list each respond in under 300 ms on a developer machine.
- **Accessibility:** automated axe checks plus a manual keyboard pass
  for the main flows.

------------------------------------------------------------------------

## 16. Development setup, configuration and delivery

### 16.1 Prerequisites

Node.js 20 or newer, npm 10 or newer, Git. Docker is optional (only for
a local PostgreSQL).

### 16.2 Environment variables (`.env.example`)

    # General
    NODE_ENV=development
    PORT=4000
    WEB_URL=http://localhost:5173
    API_URL=http://localhost:4000
    LOG_LEVEL=info
    APP_TIMEZONE=Asia/Kolkata

    # Database: sqlite3 for local work and tests, pg when hosted
    DATABASE_CLIENT=sqlite3
    SQLITE_FILE=./data/dev.sqlite
    DATABASE_URL=postgres://user:password@localhost:5432/clubs

    # Auth
    JWT_SECRET=change-me-to-a-long-random-string
    JWT_ACCESS_TTL=15m
    REFRESH_TTL_DAYS=14
    ALLOWED_EMAIL_DOMAINS=campus.example
    AUTO_VERIFY_EMAIL=true

    # Mail (development prints to the console when SMTP_HOST is empty)
    SMTP_HOST=
    SMTP_PORT=587
    SMTP_USER=
    SMTP_PASS=
    MAIL_FROM="Campus Clubs Portal <no-reply@campus.example>"

    # Files
    STORAGE_DRIVER=local          # local or s3
    UPLOAD_DIR=./uploads
    S3_ENDPOINT=
    S3_BUCKET=
    S3_ACCESS_KEY=
    S3_SECRET_KEY=

    # Rules
    HOLD_EXPIRY_DAYS=14
    MAX_ACTIVE_HOLDS_PER_CLUB=2
    REGISTRATION_DEFAULT_CLOSE_AT_DEADLINE=true

    # Seeds
    SEED_SAMPLE=true
    SEED_SUPER_ADMIN_EMAIL=superadmin@campus.example
    SEED_SUPER_ADMIN_PASSWORD=
    SEED_OSI_EMAIL=osi@campus.example
    SEED_OSI_PASSWORD=
    SEED_EVENTS_EMAIL=events@campus.example
    SEED_EVENTS_PASSWORD=

    # Phase 3 chatbot
    ANTHROPIC_API_KEY=
    LLM_MODEL=

The API validates the environment at start-up with Zod and refuses to
start with a missing or weak `JWT_SECRET` outside development.

### 16.3 Commands (root `package.json` scripts)

| Command | What it does |
|:---|:---|
| `npm install` | Installs all workspaces |
| `npm run dev` | Starts API (port 4000) and web (port 5173) together |
| `npm run db:migrate` | Runs migrations |
| `npm run db:rollback` | Rolls back the last batch |
| `npm run db:seed` | Runs seeds (idempotent) |
| `npm run db:reset` | Drops, migrates and seeds the local database |
| `npm test` | Runs unit, database, API and component tests on SQLite |
| `npm run test:pg` | Runs database and API tests against PostgreSQL (`DATABASE_CLIENT=pg`) |
| `npm run test:e2e` | Starts a seeded test server and runs Playwright |
| `npm run lint` | ESLint and Prettier check |

### 16.4 Continuous integration

On every push and pull request: install, lint, unit and component tests,
`db` and `integration` suites on SQLite, the same on a PostgreSQL
service container, then Playwright on the SQLite build. A failing job
blocks merge. Coverage is reported as a comment.

### 16.5 Deployment checklist

Set production values for every variable, `NODE_ENV=production`,
`DATABASE_CLIENT=pg`, `STORAGE_DRIVER=s3`, a long random `JWT_SECRET`,
SMTP details and the real `ALLOWED_EMAIL_DOMAINS`. Run migrations before
starting the new API version. Enable HTTPS only. Schedule database
backups. Create the Super Admin from the seed script, then change the
password. Disable `SEED_SAMPLE` and `AUTO_VERIFY_EMAIL`.

------------------------------------------------------------------------

## 17. Build plan with checklists

### 17.1 Requirement to phase

| Phase | Requirements |
|:---|:---|
| **0 Foundations** | FR-AUTH-01 to 08, FR-CLUB-04, role and permission model (section 3), database migrations and seeds, CI |
| **1 Core** | FR-CLUB-01, 02, 05, FR-ANN-01, 02, FR-EVT-01 to 10, FR-FORM-01 to 06, FR-REG-01 to 07, FR-HALL-01 to 08, FR-CAL-01 to 06, FR-NOTIF-01 to 05, FR-ACT-01 (current and past by registration), FR-PROF-01, FR-SET-01, FR-CW-01 to 03, FR-ADMIN-01 to 03 |
| **2 Engagement** | FR-REC-01 to 06, FR-FAV-01, FR-CLUB-03, My Clubs page, FR-DISC-01, FR-CHECK-01 (attendance), waitlist (FR-REG-03), team registration (FR-REG-08), file upload field, FR-SHARE-01 with the public page, FR-CAL-07 (ICS), email notifications, custom club roles (`role.manage`), club reports |
| **3 Community and assistant** | FR-DISC-02 public discussion with moderation and reports, FR-CHAT-01 chatbot, PWA install |
| **4 Hardening** | Accessibility audit, performance pass, security review, backups, deployment, user guide, demo data |

### 17.2 Phase 0: Foundations

- [ ] Repository, npm workspaces, `.gitignore`, ESLint, Prettier, Husky,
  `CLAUDE.md`, `CHANGELOG.md`
- [ ] `packages/shared`: permissions, roles, statuses, errors,
  constants, first Zod schemas
- [ ] API skeleton: config validation, `app.js`, logger, request id,
  error handler, validation middleware, health check
- [ ] Knex setup for SQLite and PostgreSQL, helpers (`toDb`, `fromDb`),
  migrations for users, auth tokens, refresh tokens, clubs, club roles,
  role permissions, club members, audit logs
- [ ] Seeds: halls, clubs with default roles, admin accounts
- [ ] Auth module: sign-up, verification, login, refresh rotation,
  logout, forgot and reset, change password, `/me`
- [ ] Middleware: `requireAuth`, `requirePlatformRole`,
  `requireClubPermission`, rate limits
- [ ] Web skeleton: tokens, `AppShell`, router, guards, `AuthContext`,
  API client with refresh, login and signup screens
- [ ] CI pipeline running lint and tests on SQLite and PostgreSQL
- **Exit:** TC-DB-01 to 07, 13, 16, 17, 27; all TC-AUTH; TC-RBAC-01 to
  05, 09, 10, 13; TC-UI-01 to 03; a user can sign up, verify, log in and
  see the right sidebar for their role.

### 17.3 Phase 1: Core

- [ ] Clubs: list and detail pages, About and Our work, OSI create and
  edit club
- [ ] Announcements channel (post, pin, delete) with permissions
- [ ] Events: draft, edit, poster upload, submit with tentative hold,
  cancel, status chips, history
- [ ] OSI approvals queue and decision screen, event review history
- [ ] Forms: builder, renderer, publish and close, seat limit
- [ ] Registration: register, cancel, QR ticket display, registration
  list and CSV export
- [ ] Halls: CRUD, blocked slots, availability timeline, final hall
  request, Events Authority decision
- [ ] Jobs: hold expiry, auto-close registration, reminders, no-shows,
  completed status
- [ ] Notifications: service, SSE stream, preferences, bell, toast
  animation
- [ ] Calendar endpoint and component with filters
- [ ] Student pages: Events, Event detail, Activities, Profile, Settings
- [ ] Club workspace: dashboard, events, add an event, members and roles
  (view and change role), discussion placeholder
- [ ] Super Admin: create admin accounts, audit log
- **Exit:** all TC-EVT, TC-HALL, TC-FORM, TC-REG (except check-in),
  TC-CAL, TC-NOTIF, TC-RBAC, TC-ANN; E2E-01, 02, 03, 05, 06; a full
  event can go from draft to confirmed hall to registrations.

### 17.4 Phase 2: Engagement

- [ ] Recruitment and applications (TC-REC), My Clubs, Favourites page
  and notifications
- [ ] Internal discussion with live updates
- [ ] QR check-in and attendance (TC-REG-11), Past participation by
  attendance
- [ ] Waitlist, team registration, file upload field
- [ ] Share button and public event page, ICS feed
- [ ] Email notifications and preferences
- [ ] Custom club roles and role editor (`role.manage`), club reports
- **Exit:** TC-REC, TC-FAV, TC-SHARE, TC-DISC-01, TC-RBAC-11, 12;
  E2E-04, 07, 08, 09.

### 17.5 Phase 3: Community and assistant

- [ ] Public discussion with report and moderation
- [ ] Chatbot (section 14) with retrieval, sources and limits
- [ ] PWA install
- **Exit:** chatbot golden tests and prompt-injection test pass.

### 17.6 Phase 4: Hardening

- [ ] Accessibility audit and fixes (TC-UI-13, 14)
- [ ] Performance pass against section 15.10
- [ ] Security review against section 11.5 and OWASP top risks
- [ ] Backups, monitoring, error reporting
- [ ] User guide for students, clubs and administrators; demo data

### 17.7 Definition of done (every task)

1.  Code and tests written; related test cases pass on SQLite and
    PostgreSQL.
2.  No permission check skipped; no hard-coded colours; no secrets.
3.  Loading, empty and error states exist for new screens.
4.  Spec section updated if behaviour changed; entry in
    `docs/DECISIONS.md` for any new decision; `CHANGELOG.md` updated.

------------------------------------------------------------------------

## 18. Risks and open questions

### 18.1 Risks

| Risk | Impact | Mitigation |
|:---|:---|:---|
| Scope is large | Delays | Phase plan; Phase 1 is a complete vertical slice |
| Hall double booking | Real-world conflict | Hold at submission, transaction, PostgreSQL exclusion constraint, tests TC-DB-20 to 22, TC-HALL-09 |
| Clubs hoard halls with holds | Halls blocked | Maximum active holds per club, expiry, visible hold list for the Events Authority |
| Registered count differs from attendance | Wrong hall size | Show registered and expected turnout, let the club choose the hall with free alternatives |
| Spam or abuse in announcements and discussion | Poor experience | Permissions, moderation, reports, rate limits |
| Personal data in registrations | Privacy | Strict visibility rules, audit, retention job |
| SQLite and PostgreSQL behave differently | Surprise bugs in hosting | Parity rules (7.2), tests run on both |
| Free hosting loses files or sleeps | Missing posters, slow first load | Object storage for files, health check, document cold start |
| Email not delivered | Users cannot verify | Resend flow, clear message, SMTP provider with good reputation |
| Role changes not applied at once | Security gap | Read permissions per request, TC-RBAC-09 |

### 18.2 Open questions for the team (defaults are already built in; change the decision log if the answer differs)

1.  What does "OSI" stand for, and is it one office for all approvals?
    (D1)
2.  Is there a faculty coordinator sign-off before the OSI? (D2)
3.  Should students be able to propose new clubs in a later phase? (D5)
4.  Are paid events needed later? (D7)
5.  Besides the portal, should the OSI circulate posters by email or
    notice boards? (D8)
6.  Should the public event page be visible without login? (D9)
7.  Is there a university single sign-on that should replace the own
    sign-up later? (section 11)
8.  Which hosting is available to the team for the API, database and
    file storage? (section 7.4)

------------------------------------------------------------------------

## Appendix A: Sample data (all names are made up)

**Halls:** Main Auditorium (800), Mini Auditorium (350), Seminar Hall A
(200), Seminar Hall B (120), Open Air Theatre (1000), Innovation Lab
(60).

**Clubs:** Robotics Club (Technology), Code Forge (Technology), Music
Club (Cultural), Lens Photography Club (Arts), Entrepreneurship Cell
(Business), Literary Society (Literature), Rhythm Dance Club (Cultural),
Green Campus Club (Social impact). Each with a short description, why
join, aim, meeting information and contact `<club>@campus.example`.

**Sample accounts (development only, passwords from** `.env`**):**
`superadmin@campus.example`, `osi@campus.example`,
`events@campus.example`, a sample student, and in the Robotics Club one
member for each club role (leader, vice leader, secretary, event
coordinator, media lead, member).

**Sample events:** one in each status (draft, submitted, changes
requested, approved, rejected, completed, cancelled) so every screen has
data.

------------------------------------------------------------------------

## Appendix B: Suggested `CLAUDE.md` for the repository root

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
