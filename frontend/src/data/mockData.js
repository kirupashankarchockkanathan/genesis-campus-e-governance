// Presentation constants for the GENESIS Campus Connect UI (labels, tones, sample copy).
// Clubs, events, registrations and notifications now come from the API (see src/utils/api.js).

export { TODAY } from '@gcc/shared/gov/demoClock';

/* ------------------------------------------------------------------ */
/* Demo accounts (frontend-only authentication, NOT real security)     */
/* ------------------------------------------------------------------ */
export { DEMO_USERS } from '@gcc/shared/gov/demoUsers';

export const ROLES = [
  {
    id: 'student',
    title: 'Student',
    desc: 'Explore approved events, register, follow clubs and stay in the loop.',
    icon: 'GraduationCap',
  },
  {
    id: 'club',
    title: 'Club Authority',
    desc: 'Propose events, manage your club page and track member interest.',
    icon: 'Users',
  },
  {
    id: 'admin',
    title: 'Administrator',
    desc: 'Review service requests, approve events and oversee campus governance.',
    icon: 'ShieldCheck',
  },
];

export const ADMIN_TYPES = [
  {
    id: 'osa',
    title: 'Office of Student Affairs',
    short: 'OSA',
    desc: 'Approve clubs, review student service requests and handle governance.',
    icon: 'Landmark',
  },
  {
    id: 'events',
    title: 'Events Section',
    short: 'Events',
    desc: 'Schedule venues, manage event logistics and publish approved events.',
    icon: 'CalendarCog',
  },
];

/* ------------------------------------------------------------------ */
/* Clubs                                                               */
export const CLUB_TONES = {
  peach: { bg: 'bg-[#f3e3d6]', letter: 'text-[#e3b79a]', icon: 'text-[#c6563a]' },
  mint: { bg: 'bg-[#d6ebe6]', letter: 'text-[#a7cfc5]', icon: 'text-brand-700' },
  sky: { bg: 'bg-[#dde5f1]', letter: 'text-[#b4c3dc]', icon: 'text-[#3b64b8]' },
  lilac: { bg: 'bg-[#e9e0f0]', letter: 'text-[#cdbbdc]', icon: 'text-[#7a4ea0]' },
  sage: { bg: 'bg-[#e1ecd8]', letter: 'text-[#bcd1ad]', icon: 'text-[#4b7a3a]' },
  sand: { bg: 'bg-[#f1e6d2]', letter: 'text-[#dcc79c]', icon: 'text-[#a8761f]' },
};


/* ------------------------------------------------------------------ */
/* Events (approved, student-facing)                                   */
/* status: open | closing | full | closed                              */
export const EVENT_TONES = {
  emerald: 'from-brand-900 to-brand-500',
  olive: 'from-[#33463f] to-[#7a6a3a]',
  green: 'from-[#2c4a3b] to-[#5e8a6a]',
  teal: 'from-[#0e4a47] to-[#2a8f84]',
  rust: 'from-[#5a3126] to-[#a8613f]',
  plum: 'from-[#4b2f4d] to-[#8a5d86]',
};

export const STATUS_META = {
  open: { label: 'Registration open', cls: 'bg-ok-50 text-ok-700', dot: 'bg-ok-500' },
  closing: { label: 'Closing soon', cls: 'bg-amber-soft text-amber-ink', dot: 'bg-[#e3a02c]' },
  full: { label: 'Fully booked', cls: 'bg-rose-soft text-rose-ink', dot: 'bg-[#e06052]' },
  closed: { label: 'Closed', cls: 'bg-[#f1eeee] text-ink-soft', dot: 'bg-ink-mute' },
};

export const CATEGORY_STYLES = {
  Workshop: { chip: 'bg-brand-500', event: 'bg-[#e2f0e4] text-[#2f6b3b] border-l-[#3a8a4b]' },
  Hackathon: { chip: 'bg-[#d9902b]', event: 'bg-[#fdf1da] text-[#8a5a10] border-l-[#d9902b]' },
  Technical: { chip: 'bg-[#4a73c4]', event: 'bg-[#e4ecf9] text-[#35589f] border-l-[#4a73c4]' },
  Cultural: { chip: 'bg-[#8a5bb0]', event: 'bg-[#efe6f6] text-[#6c3f92] border-l-[#8a5bb0]' },
  Sports: { chip: 'bg-[#2a9d7f]', event: 'bg-[#dff3ec] text-[#1d7a61] border-l-[#2a9d7f]' },
  'Social Impact': { chip: 'bg-[#8f9b3a]', event: 'bg-[#eef1d8] text-[#667018] border-l-[#8f9b3a]' },
};

/* ------------------------------------------------------------------ */
/* Registrations                                                       */
/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* Dashboard "Recent updates" (short list) */
export const DASH_UPDATES = [
  { id: 'd1', icon: 'Bell', tone: 'mint', title: 'A new campus event is live', body: 'GENESIS Innovation Sprint is open for registration.', time: '18 min ago' },
  { id: 'd2', icon: 'Bell', tone: 'amber', title: 'Your place is confirmed', body: "You're registered for Design & Build Workshop.", time: 'Yesterday' },
  { id: 'd3', icon: 'Bell', tone: 'sky', title: 'New from Kalakriti', body: "A workshop has been added to this week's calendar.", time: 'Yesterday' },
];

/* ------------------------------------------------------------------ */
/* Campus AI (small, local reference set)                              */
/* ------------------------------------------------------------------ */
export const AI_SUGGESTIONS = [
  'What is GDSC for?',
  'I like music, which clubs suit me?',
  'Which clubs are there for AI and robotics?',
  'What events are happening this week?',
  'How do I register for an event?',
];

export const AI_ANSWERS = [
  {
    match: ['hackathon', 'beginner'],
    answer:
      'The GENESIS Innovation Sprint on 12 October at the Main Auditorium is open to all current students, and no prior hackathon experience is needed. Registration closes 11 October at 6:00 PM.',
  },
  {
    match: ['robotics'],
    answer:
      'The Hut Labs (126 members, 2 upcoming events) is the club focused on robotics. It also hosts the Robotics Open Lab on 3 October.',
  },
  {
    match: ['week', 'happening'],
    answer:
      'This week: GENESIS Innovation Sprint (Mon 12), Open studio (Tue 13), Design & Build Workshop (Wed 14), Robotics lab (Thu 15) and the Campus Sustainability Drive (Fri 16).',
  },
  {
    match: ['join', 'club'],
    answer:
      'Open the Clubs Directory, pick a club and choose View club. In this prototype, favouriting only bookmarks a club — it does not enrol you. Official membership steps come from each club.',
  },
  {
    match: ['propose', 'document'],
    answer:
      "The demo reference set doesn't contain the official document checklist for proposing a new club. Please check with the Office of Student Affairs for verified requirements.",
  },
];
