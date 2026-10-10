import { config } from '../../config/index.js';
import { clock } from '../../lib/clock.js';
import { newId } from '../../lib/ids.js';
import { jsonToDb, toDb } from '../helpers.js';
import { SAMPLE_CLUB_NAME } from './clubsData.js';

const DAY = 24 * 3600 * 1000;

/**
 * Demo content for every screen (Appendix A): one sample event in each status, a recruitment, announcements,
 * a work entry and registrations. Everything is marked "Sample" and only runs with SEED_SAMPLE=true.
 * Idempotent: running it twice creates no duplicates.
 */
export async function seedSampleContent(knex) {
  if (!config.SEED_SAMPLE) return;
  const club = await knex('clubs').where({ name: SAMPLE_CLUB_NAME }).first();
  const leader = await knex('users').where({ username: 'sample_leader' }).first();
  const student = await knex('users').where({ username: 'sample_student' }).first();
  if (!club || !leader || !student) return;
  const osi = await knex('users').where({ platform_role: 'osi_admin' }).first();
  const now = clock.now();
  const at = (days, hour = 10) => {
    const d = new Date(now.getTime() + days * DAY);
    d.setUTCHours(hour, 0, 0, 0);
    return d;
  };
  const stamp = toDb(now);
  const halls = Object.fromEntries((await knex('halls')).map((h) => [h.name, h]));

  const specs = [
    { key: 'draft', title: 'Sample: Intro to Arduino (draft)', day: 22, status: 'draft' },
    {
      key: 'submitted',
      title: 'Sample: Line Follower Workshop (submitted)',
      day: 15,
      status: 'submitted',
      hall: 'Seminar Hall A',
      submitted: true,
    },
    {
      key: 'changes',
      title: 'Sample: Drone Basics Talk (changes requested)',
      day: 17,
      status: 'changes_requested',
      hall: 'Seminar Hall B',
      submitted: true,
    },
    {
      key: 'approved',
      title: 'Sample: Robo Hack 2026 (approved)',
      day: 10,
      status: 'approved',
      hall: 'Mini Auditorium',
      submitted: true,
      circulated: true,
      hours: 8,
      type: 'hackathon',
      seats: 120,
    },
    {
      key: 'rejected',
      title: 'Sample: Midnight Robot Race (rejected)',
      day: 12,
      status: 'rejected',
      submitted: true,
    },
    {
      key: 'completed',
      title: 'Sample: Soldering Bootcamp (completed)',
      day: -10,
      status: 'completed',
      hall: 'Innovation Lab',
      submitted: true,
      circulated: true,
      confirmed: true,
    },
    {
      key: 'cancelled',
      title: 'Sample: Rover Demo Day (cancelled)',
      day: 8,
      status: 'cancelled',
      submitted: true,
    },
  ];
  const ids = {};
  for (const sp of specs) {
    const existing = await knex('events').where({ club_id: club.id, title: sp.title }).first();
    if (existing) {
      ids[sp.key] = existing.id;
      continue;
    }
    const id = newId();
    ids[sp.key] = id;
    const start = at(sp.day);
    const end = new Date(start.getTime() + (sp.hours ?? 2) * 3600 * 1000);
    await knex('events').insert({
      id,
      club_id: club.id,
      title: sp.title,
      type: sp.type ?? 'workshop',
      summary: 'Sample event created for the demo. It is not a real event.',
      description: 'Sample description. Hands-on session with robots, sensors and teamwork.',
      objectives: 'Learn by building. Sample objectives.',
      mode: 'offline',
      starts_at: toDb(start),
      ends_at: toDb(end),
      registration_deadline: toDb(new Date(start.getTime() - DAY)),
      expected_participants: 60,
      max_seats: sp.seats ?? null,
      status: sp.status,
      submitted_by: sp.submitted ? leader.id : null,
      submitted_at: sp.submitted ? stamp : null,
      circulated_at: sp.circulated ? stamp : null,
      cancelled_reason: sp.status === 'cancelled' ? 'Sample: speaker unavailable' : null,
      hall_id: sp.confirmed ? halls[sp.hall]?.id : null,
      created_by: leader.id,
      created_at: stamp,
      updated_at: stamp,
    });
    if (sp.hall && halls[sp.hall]) {
      await knex('hall_bookings').insert({
        id: newId(),
        hall_id: halls[sp.hall].id,
        event_id: id,
        club_id: club.id,
        status: sp.confirmed ? 'confirmed' : 'tentative',
        starts_at: toDb(start),
        ends_at: toDb(end),
        expected_count: 60,
        expires_at:
          sp.confirmed || sp.status === 'approved' ? null : toDb(new Date(now.getTime() + 14 * DAY)),
        created_at: stamp,
        updated_at: stamp,
      });
    }
    if (osi && (sp.status === 'changes_requested' || sp.status === 'rejected')) {
      await knex('event_reviews').insert({
        id: newId(),
        event_id: id,
        reviewer_id: osi.id,
        decision: sp.status,
        note:
          sp.status === 'rejected'
            ? 'Sample: clashes with exams.'
            : 'Sample: please add a detailed schedule.',
        created_at: stamp,
      });
    }
  }

  // Registration form for the approved and the completed event.
  const fields = [
    {
      id: 'team_pref',
      type: 'single_choice',
      label: 'Team preference',
      help: '',
      required: true,
      options: ['Solo', 'Team'],
    },
    {
      id: 'laptop',
      type: 'dropdown',
      label: 'Will you bring a laptop?',
      help: '',
      required: false,
      options: ['Yes', 'No'],
    },
    { id: 'consent', type: 'consent', label: 'I agree to the code of conduct', help: '', required: true },
  ];
  for (const [key, status] of [
    ['approved', 'published'],
    ['completed', 'closed'],
  ]) {
    if (await knex('forms').where({ event_id: ids[key] }).first()) continue;
    await knex('forms').insert({
      id: newId(),
      club_id: club.id,
      event_id: ids[key],
      purpose: 'event_registration',
      title: 'Registration form (sample)',
      fields_json: jsonToDb(fields),
      status,
      opens_at: stamp,
      closes_at: toDb(at(key === 'approved' ? 9 : -11)),
      published_at: stamp,
      created_by: leader.id,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  const register = async (key, status, answers) => {
    if (await knex('registrations').where({ event_id: ids[key], user_id: student.id }).first()) return;
    const form = await knex('forms').where({ event_id: ids[key] }).first();
    const responseId = newId();
    await knex('form_responses').insert({
      id: responseId,
      form_id: form.id,
      user_id: student.id,
      answers_json: jsonToDb(answers),
      submitted_at: stamp,
    });
    await knex('registrations').insert({
      id: newId(),
      event_id: ids[key],
      user_id: student.id,
      form_response_id: responseId,
      status,
      qr_token: `sample-ticket-${newId().slice(0, 12)}`,
      checked_in_at: status === 'attended' ? stamp : null,
      created_at: stamp,
      updated_at: stamp,
    });
  };
  await register('approved', 'registered', { team_pref: 'Team', laptop: 'Yes', consent: true });
  await register('completed', 'attended', { team_pref: 'Solo', consent: true });

  // Announcements, a work entry and an open recruitment.
  if (!(await knex('announcements').where({ club_id: club.id }).first())) {
    for (const [title, body, pinned] of [
      ['Sample: Welcome to the new term', 'Sample announcement. Meetings restart this Friday.', 1],
      ['Sample: Robo Hack registrations are open', 'Sample announcement. Register from the event page.', 0],
    ]) {
      await knex('announcements').insert({
        id: newId(),
        club_id: club.id,
        author_id: leader.id,
        title,
        body,
        is_pinned: pinned,
        created_at: stamp,
        updated_at: stamp,
      });
    }
  }
  if (!(await knex('club_works').where({ club_id: club.id }).first())) {
    await knex('club_works').insert({
      id: newId(),
      club_id: club.id,
      title: 'Sample: Built a line-following robot',
      description: 'Sample entry for the Our work tab.',
      happened_on: '2026-03-12',
      created_by: leader.id,
      created_at: stamp,
      updated_at: stamp,
    });
  }
  if (!(await knex('recruitments').where({ club_id: club.id }).first())) {
    const rid = newId();
    await knex('recruitments').insert({
      id: rid,
      club_id: club.id,
      title: 'Sample: Autumn recruitment',
      description: 'Sample recruitment. Join the build team.',
      deadline: toDb(at(14)),
      status: 'open',
      auto_accept: 0,
      created_by: leader.id,
      created_at: stamp,
      updated_at: stamp,
    });
    await knex('recruitment_positions').insert([
      {
        id: newId(),
        recruitment_id: rid,
        title: 'Mechanical designer',
        description: 'CAD and fabrication',
        openings: 2,
      },
      {
        id: newId(),
        recruitment_id: rid,
        title: 'Embedded developer',
        description: 'Firmware and sensors',
        openings: 2,
      },
    ]);
    await knex('forms').insert({
      id: newId(),
      club_id: club.id,
      recruitment_id: rid,
      purpose: 'recruitment',
      title: 'Application (sample)',
      fields_json: jsonToDb([
        { id: 'why', type: 'long_text', label: 'Why do you want to join?', help: '', required: true },
      ]),
      status: 'published',
      opens_at: stamp,
      closes_at: toDb(at(14)),
      published_at: stamp,
      created_by: leader.id,
      created_at: stamp,
      updated_at: stamp,
    });
  }
}
