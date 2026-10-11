// Notification copy written to be opened: a hook line, the facts, and a nudge. Same words on the server and in the
// browser, picked deterministically (by event id) so the stored notice and the on-screen one match.

const HOOKS = {
  Hackathon: {
    emoji: '🚀',
    quotes: [
      'Ideas are cheap. Prototypes win. Come build one.',
      'Great teams are formed in a single night. Find yours.',
      'Someone on this campus is building the next big thing. Why not you?',
    ],
  },
  Workshop: {
    emoji: '💡',
    quotes: [
      "Skills don't download themselves. Show up and level up.",
      'Learn by doing, not by scrolling.',
      'One session. One new skill. Zero regrets.',
    ],
  },
  Technical: {
    emoji: '⚙️',
    quotes: [
      'Curiosity compiles. Come run it.',
      'The best bugs are found in good company.',
      'Your future self will thank you for this one.',
    ],
  },
  Cultural: {
    emoji: '🎭',
    quotes: [
      "Some memories can't be streamed. Be in the room.",
      "Culture is better when you're part of the crowd.",
      "Great evenings start with a simple 'yes'.",
    ],
  },
  Sports: {
    emoji: '⚽',
    quotes: [
      'Game on. The bench is overrated.',
      'Warm up your legs, not your excuses.',
      'Winners just show up first.',
    ],
  },
  'Social Impact': {
    emoji: '🌱',
    quotes: [
      'Small hands, big difference. Join in.',
      "Change doesn't wait for permission. Neither should you.",
      'A better campus starts with a few of us.',
    ],
  },
};
const FALLBACK = {
  emoji: '✨',
  quotes: [
    'The best part of campus is what happens outside class.',
    "Don't just hear about it tomorrow. Be there.",
  ],
};

const pick = (list, seed) => list[[...String(seed)].reduce((a, c) => a + c.charCodeAt(0), 0) % list.length];

/** The hook (emoji and quote) for an event category. `seed` keeps the choice stable for one event. */
export const eventHook = (category, seed) => {
  const h = HOOKS[category] ?? FALLBACK;
  return { emoji: h.emoji, quote: pick(h.quotes, seed) };
};

/**
 * "New event" notice. `when` is a formatted date and time, `deadline` a formatted date. Mentions scarcity only when
 * the venue is small enough for it to be true.
 */
export function newEventNotice({
  title,
  category,
  clubName,
  when,
  venue,
  capacity,
  deadline,
  seed,
  quote: custom,
}) {
  const hook = eventHook(category, seed);
  const emoji = hook.emoji;
  const quote = custom || hook.quote; // an event-specific line (from the chat model) wins over the static one
  const seats = capacity <= 150 ? `Only ${capacity} seats, so grab yours before they're gone. ` : '';
  return {
    title: `${emoji} ${title} just dropped`,
    body: `"${quote}" ${clubName} opens registration for ${when} at ${venue}. ${seats}Registration closes ${deadline}. Tap to claim your spot →`,
  };
}

/** Registration confirmation: celebrates, then gives the student a reason to come back. */
export function registrationNotice({ title, category, when, venue, seed }) {
  const { emoji } = eventHook(category, seed);
  return {
    title: `You're in! ${emoji}`,
    body: `${title} is yours: ${when} at ${venue}. Add it to your calendar and bring a friend, the best events are better shared.`,
  };
}
