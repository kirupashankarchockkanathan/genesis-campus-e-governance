import fs from 'node:fs';
import path from 'node:path';
import { config } from '../../config/index.js';
import { clock } from '../../lib/clock.js';
import { toDb } from '../../db/helpers.js';

// Grounding for the chatbot (spec 14): relevant text is retrieved from the database and docs/faq/*.md.
// Only public portal content is read: club pages, works, announcements, approved events, open recruitments.
// Registration answers, applications and any personal data are never touched.
// Scoring is keyword based and runs in JavaScript so it behaves the same on SQLite and PostgreSQL.

const STOP = new Set(
  'the and for are but not you your with what when where who whom how why can does did has have had this that these those from into about our any all there their they them its was were will would could should may might been being than then too very just also some more most such only own same out off over under again once here both each few other which while during before after above below between through until against upon per via'.split(
    ' ',
  ),
);

export const tokenize = (text) => [
  ...new Set(
    String(text ?? '')
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((w) => w.length > 2 && !STOP.has(w))
      .map((w) => (w.length > 3 && w.endsWith('s') ? w.slice(0, -1) : w)),
  ),
];

const cap = (s, n = 1200) => (s.length > n ? `${s.slice(0, n)}...` : s);
const fmtDate = (iso) =>
  new Intl.DateTimeFormat('en-IN', {
    timeZone: config.APP_TIMEZONE,
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(iso));

function faqChunks() {
  const dir = path.resolve(config.apiRoot, '../../docs/faq');
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const file of fs.readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8');
    const title = raw.match(/^#\s+(.+)$/m)?.[1] ?? file;
    raw
      .split(/\n\s*\n/)
      .map((p) => p.replace(/^#\s+.+$/m, '').trim())
      .filter((p) => p.length > 40)
      .forEach((p, i) =>
        out.push({
          id: `faq:${file}:${i}`,
          kind: 'faq',
          title: `FAQ: ${title}`,
          text: cap(p),
          label: `FAQ: ${title}`,
          route: '/',
        }),
      );
  }
  return out;
}

export async function loadChunks(db, { clubId } = {}) {
  const now = toDb(clock.now());
  const since = toDb(new Date(clock.now().getTime() - 90 * 86400000));
  const chunks = [];
  const scoped = (q, col) => (clubId ? q.where(col, clubId) : q);

  const clubs = await scoped(db('clubs').where({ status: 'active' }), 'id');
  for (const c of clubs) {
    chunks.push({
      id: `club:${c.id}`,
      kind: 'club',
      clubId: c.id,
      title: c.name,
      label: `${c.name} (club page)`,
      route: `/clubs/${c.slug}`,
      text: cap(
        [
          `${c.name} is a ${c.category} club.`,
          c.tagline,
          c.description,
          c.why_join && `Why join: ${c.why_join}`,
          c.aim && `Aim: ${c.aim}`,
          c.meeting_info && `Meetings: ${c.meeting_info}`,
          c.faculty_coordinator && `Faculty coordinator: ${c.faculty_coordinator}`,
          c.contact_email && `Contact: ${c.contact_email}`,
        ]
          .filter(Boolean)
          .join(' '),
      ),
    });
  }
  const clubById = Object.fromEntries(clubs.map((c) => [c.id, c]));
  const clubName = (id) => clubById[id]?.name ?? 'a club';

  const works = await scoped(db('club_works').orderBy('created_at', 'desc').limit(100), 'club_id');
  for (const w of works.filter((x) => clubById[x.club_id])) {
    chunks.push({
      id: `work:${w.id}`,
      kind: 'work',
      clubId: w.club_id,
      title: w.title,
      label: `${clubName(w.club_id)}: ${w.title}`,
      route: `/clubs/${clubById[w.club_id].slug}`,
      text: cap(
        `${clubName(w.club_id)} work: ${w.title}. ${w.description ?? ''}${w.happened_on ? ` (${w.happened_on})` : ''}`,
      ),
    });
  }
  const anns = await scoped(
    db('announcements')
      .whereNull('deleted_at')
      .where('created_at', '>=', since)
      .orderBy('created_at', 'desc')
      .limit(150),
    'club_id',
  );
  for (const a of anns.filter((x) => clubById[x.club_id])) {
    chunks.push({
      id: `ann:${a.id}`,
      kind: 'announcement',
      clubId: a.club_id,
      title: a.title,
      label: `${clubName(a.club_id)}: ${a.title}`,
      route: `/clubs/${clubById[a.club_id].slug}`,
      text: cap(`Announcement from ${clubName(a.club_id)} (${fmtDate(a.created_at)}): ${a.title}. ${a.body}`),
    });
  }
  const events = await scoped(
    db('events as e')
      .leftJoin('halls as h', 'h.id', 'e.hall_id')
      .whereIn('e.status', ['approved'])
      .whereNotNull('e.circulated_at')
      .where('e.ends_at', '>=', now)
      .orderBy('e.starts_at')
      .limit(100)
      .select('e.*', 'h.name as hall_name'),
    'e.club_id',
  );
  for (const e of events.filter((x) => clubById[x.club_id])) {
    chunks.push({
      id: `event:${e.id}`,
      kind: 'event',
      clubId: e.club_id,
      title: e.title,
      label: `Event: ${e.title}`,
      route: `/events/${e.id}`,
      text: cap(
        `Event "${e.title}" by ${clubName(e.club_id)}: ${e.summary ?? ''} Starts ${fmtDate(e.starts_at)}, ends ${fmtDate(e.ends_at)}. Mode: ${e.mode}.${e.hall_name ? ` Venue: ${e.hall_name}.` : ''} Registration deadline ${fmtDate(e.registration_deadline)}.`,
      ),
    });
  }
  const recs = await scoped(
    db('recruitments').where({ status: 'open' }).where('deadline', '>', now).limit(50),
    'club_id',
  );
  for (const r of recs.filter((x) => clubById[x.club_id])) {
    const positions = await db('recruitment_positions').where({ recruitment_id: r.id });
    chunks.push({
      id: `rec:${r.id}`,
      kind: 'recruitment',
      clubId: r.club_id,
      title: r.title,
      label: `${clubName(r.club_id)}: ${r.title} (recruitment)`,
      route: `/clubs/${clubById[r.club_id].slug}`,
      text: cap(
        `${clubName(r.club_id)} is recruiting: ${r.title}. ${r.description ?? ''} Positions: ${positions.map((p) => `${p.title} (${p.openings} openings)`).join(', ')}. Deadline ${fmtDate(r.deadline)}.`,
      ),
    });
  }
  return [...chunks, ...faqChunks()];
}

/** Returns up to `limit` chunks with a positive score, best first. */
export async function retrieve(db, question, { clubId, limit = 6 } = {}) {
  const tokens = tokenize(question);
  if (!tokens.length) return [];
  const chunks = await loadChunks(db, { clubId });
  const scored = chunks
    .map((c) => {
      const titleTokens = new Set(tokenize(c.title));
      const body = new Set(tokenize(c.text));
      let score = 0;
      for (const t of tokens) {
        if (titleTokens.has(t)) score += 4;
        else if (body.has(t)) score += 1;
      }
      if (clubId && c.clubId === clubId) score += 0.5; // prefer the club the user is asking about
      return { ...c, score };
    })
    .filter((c) => c.score >= 1)
    .sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}
