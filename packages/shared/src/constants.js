export const APP_NAME = 'Campus Clubs Portal';
// D1: the expansion of OSI is unconfirmed; keep it configurable here.
export const OSI_LABEL = 'OSI';
export const OSI_EXPANSION = 'OSI (expansion to be confirmed)';
export const EVENTS_AUTHORITY_LABEL = 'Events Authority';

export const CLUB_CATEGORIES = Object.freeze([
  'Technology',
  'Cultural',
  'Arts',
  'Business',
  'Literature',
  'Social impact',
  'Sports',
  'Other',
]);
export const EVENT_TYPES = Object.freeze([
  'workshop',
  'hackathon',
  'talk',
  'cultural',
  'competition',
  'exhibition',
  'recruitment_drive',
  'other',
]);
export const EVENT_MODES = Object.freeze(['offline', 'online', 'hybrid']);

export const LIMITS = Object.freeze({
  PASSWORD_MIN: 8,
  PASSWORD_MAX: 128,
  POSTER_MAX_BYTES: 5 * 1024 * 1024,
  PAGE_SIZE_DEFAULT: 20,
  PAGE_SIZE_MAX: 100,
  LOGIN_MAX_FAILURES: 5,
  LOGIN_WINDOW_MINUTES: 15,
  VERIFY_TOKEN_HOURS: 24,
  RESET_TOKEN_HOURS: 1,
  BCRYPT_COST: 12,
});

export const COMMON_PASSWORDS = Object.freeze([
  'password',
  'password1',
  'password123',
  '12345678',
  '123456789',
  '1234567890',
  'qwerty123',
  'qwertyuiop',
  'iloveyou',
  'admin123',
  'welcome1',
  'welcome123',
  'letmein123',
  'abc12345',
  'monkey123',
  'dragon123',
  'football1',
  'baseball1',
  'passw0rd',
  'p@ssw0rd',
  '11111111',
  '00000000',
]);
