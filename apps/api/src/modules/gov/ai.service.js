import {
  ASSISTANT_FALLBACK,
  duplicateSummary,
  localAssistant,
  localDuplicateCheck,
  selectors,
} from '@ccp/shared/gov';
import { config } from '../../config/index.js';
import { errors } from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';
import { SYSTEM_PROMPT, checkRate } from '../chat/chat.service.js';
import { registrationCounts } from './gov.service.js';
import { loadState } from './state.js';

const escapeDoc = (s) => String(s).replace(/</g, '&lt;').replace(/>/g, '&gt;');
const STOP = new Set([
  'the',
  'and',
  'for',
  'how',
  'what',
  'when',
  'where',
  'are',
  'any',
  'can',
  'does',
  'this',
  'that',
  'with',
  'there',
  'about',
  'which',
  'who',
  'you',
  'from',
]);
const words = (s) =>
  String(s)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP.has(w));

const PROCESS_NOTES = [
  {
    title: 'How events reach students',
    text: 'Events appear on the student dashboard only after online review, hard-copy letter verification, final approval by the Office of Student Affairs (OSA) and publication by the Events Section or OSA.',
  },
  {
    title: 'Joining a club',
    text: 'Open the Clubs Directory, pick a club and choose View club. Saving a club to favourites is only a bookmark: it does not enrol you. Official membership steps come from each club.',
  },
  {
    title: 'Proposing a new club',
    text: 'OSA expects a draft club constitution, a faculty advisor consent letter and a founding members list with at least 10 students. OSA also checks the idea against existing clubs for overlap.',
  },
];

export const status = (llm) => ({ engine: llm ? 'claude' : 'rules' });

/** Similar existing clubs for a club application. Uses the stored clubs, never a list sent by the browser. */
export async function duplicateClubs(db, application) {
  const state = await loadState(db);
  const clubs = selectors.allClubs(state);
  const objectivesOf = (c) => (selectors.clubProfile(state, c.id).objectives ?? []).join(' ');
  const matches = localDuplicateCheck(application ?? {}, clubs, objectivesOf);
  return { matches, summary: duplicateSummary(matches), method: 'similarity' };
}

function chunksFor(state) {
  const events = selectors
    .publishedEvents(state)
    .filter((e) => e.date >= selectors.TODAY_ISO)
    .map((e) => ({
      title: `Event: ${e.title}`,
      text: `${e.title} (${e.category}) by ${e.organizer} on ${e.dateLabel}, ${e.time} to ${e.endTime}, at ${e.venue}. ${e.closesLong}. Status: ${e.status}. Seats: ${e.registered} of ${e.capacity} taken. Open to: ${e.audience}. ${e.blurb}`,
    }));
  const clubs = selectors.allClubs(state).map((c) => ({
    title: `Club: ${c.name}`,
    text: `${c.name} (${c.category}), ${c.members} members, ${c.upcoming} upcoming event(s). ${c.blurb}`,
  }));
  return [...events, ...clubs, ...PROCESS_NOTES];
}

const rank = (question, chunks) => {
  const q = new Set(words(question));
  return chunks
    .map((c) => ({ c, score: words(`${c.title} ${c.text}`).filter((w) => q.has(w)).length }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8)
    .map((x) => x.c);
};

/** Answers a question from published events, clubs and the process notes only. */
export async function assistant(db, user, question, { llm }) {
  const text = String(question ?? '').trim();
  if (!text) throw errors.validation('Ask a question.');
  if (text.length > 600) throw errors.validation('Please keep your question under 600 characters.');
  checkRate(user.id);
  const state = { ...(await loadState(db)), registrationCounts: await registrationCounts(db) };
  const rules = () => ({
    answer: localAssistant(text, {
      events: selectors.publishedEvents(state),
      clubs: selectors.allClubs(state),
      todayISO: selectors.TODAY_ISO,
    }),
    engine: 'rules',
  });
  if (!llm) return rules();
  const chunks = rank(text, chunksFor(state));
  if (!chunks.length) return { answer: ASSISTANT_FALLBACK, engine: 'rules' };

  const docs = chunks
    .map(
      (c, i) =>
        `<document number="${i + 1}" title="${escapeDoc(c.title)}">\n${escapeDoc(c.text)}\n</document>`,
    )
    .join('\n');
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.CHAT_TIMEOUT_MS);
  try {
    const out = await llm.ask({
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `<retrieved_documents>\n${docs}\n</retrieved_documents>\n\nQuestion from the user: ${text}`,
        },
      ],
      signal: controller.signal,
    });
    if (out.refused || !out.text) return rules();
    return { answer: out.text, engine: 'claude' };
  } catch (err) {
    logger.warn({ err: { name: err?.name, status: err?.status } }, 'assistant model call failed');
    return rules();
  } finally {
    clearTimeout(timer);
  }
}
