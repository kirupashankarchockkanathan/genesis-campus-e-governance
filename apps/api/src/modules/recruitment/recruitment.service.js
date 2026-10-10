import {
  APPLICATION_STATUS,
  ERROR_CODES,
  FORM_STATUS,
  RECRUITMENT_STATUS,
  validateAnswers,
} from '@ccp/shared';
import { newId } from '../../lib/ids.js';
import { clock } from '../../lib/clock.js';
import { AppError, errors } from '../../lib/errors.js';
import { audit } from '../../lib/audit.js';
import { boolFromDb, boolToDb, jsonFromDb, jsonToDb, toDb } from '../../db/helpers.js';
import { allStudentIds, notify } from '../notifications/notifications.service.js';
import { ensureMembership } from '../members/members.service.js';

// ---------- DTOs ----------

const dto = (r, positions, form, extra = {}) => ({
  id: r.id,
  clubId: r.club_id,
  clubName: r.club_name,
  clubSlug: r.club_slug,
  title: r.title,
  description: r.description,
  deadline: r.deadline,
  status: r.status,
  autoAccept: boolFromDb(r.auto_accept),
  positions: positions.map((p) => ({
    id: p.id,
    title: p.title,
    description: p.description,
    openings: Number(p.openings),
  })),
  fields: form ? jsonFromDb(form.fields_json, []) : [],
  ...extra,
});

const base = (db) =>
  db('recruitments as r')
    .join('clubs as c', 'c.id', 'r.club_id')
    .select('r.*', 'c.name as club_name', 'c.slug as club_slug');

export async function getRow(db, id) {
  const r = await base(db).where('r.id', id).first();
  if (!r) throw errors.notFound('Recruitment not found.');
  return r;
}

const isOpenNow = (r) => r.status === RECRUITMENT_STATUS.OPEN && r.deadline > toDb(clock.now());

async function hydrate(db, rows, viewerId) {
  if (!rows.length) return [];
  const ids = rows.map((r) => r.id);
  const positions = await db('recruitment_positions').whereIn('recruitment_id', ids);
  const forms = await db('forms').whereIn('recruitment_id', ids);
  const mine = viewerId
    ? await db('applications').whereIn('recruitment_id', ids).where({ user_id: viewerId })
    : [];
  const counts = await db('applications')
    .whereIn('recruitment_id', ids)
    .groupBy('recruitment_id')
    .select('recruitment_id')
    .count('* as c');
  return rows.map((r) => {
    const a = mine.find((x) => x.recruitment_id === r.id);
    return dto(
      r,
      positions.filter((p) => p.recruitment_id === r.id),
      forms.find((f) => f.recruitment_id === r.id),
      {
        acceptingApplications: isOpenNow(r),
        myApplication: a ? { id: a.id, status: a.status, positionId: a.position_id } : null,
        applicationCount: Number(counts.find((c) => c.recruitment_id === r.id)?.c ?? 0),
      },
    );
  });
}

// ---------- Management (FR-REC-01) ----------

async function writePositions(trx, recruitmentId, positions) {
  await trx('recruitment_positions').where({ recruitment_id: recruitmentId }).del();
  for (const p of positions) {
    await trx('recruitment_positions').insert({
      id: newId(),
      recruitment_id: recruitmentId,
      title: p.title,
      description: p.description ?? '',
      openings: p.openings ?? 1,
    });
  }
}

export async function createRecruitment(db, actor, clubId, input) {
  return db.transaction(async (trx) => {
    const now = toDb(clock.now());
    const id = newId();
    await trx('recruitments').insert({
      id,
      club_id: clubId,
      title: input.title,
      description: input.description ?? '',
      deadline: input.deadline,
      status: RECRUITMENT_STATUS.DRAFT,
      auto_accept: boolToDb(input.autoAccept),
      created_by: actor.id,
      created_at: now,
      updated_at: now,
    });
    await writePositions(trx, id, input.positions);
    await trx('forms').insert({
      id: newId(),
      club_id: clubId,
      recruitment_id: id,
      purpose: 'recruitment',
      title: `${input.title}: application`,
      description: '',
      fields_json: jsonToDb(input.fields ?? []),
      status: FORM_STATUS.DRAFT,
      created_by: actor.id,
      created_at: now,
      updated_at: now,
    });
    await audit(trx, {
      actorId: actor.id,
      action: 'recruitment.created',
      entityType: 'recruitment',
      entityId: id,
    });
    return id;
  });
}

export async function updateRecruitment(db, actor, row, input) {
  if (row.status === RECRUITMENT_STATUS.CLOSED)
    throw errors.invalidState('A closed recruitment cannot be edited.');
  const structural = input.positions !== undefined || input.fields !== undefined;
  if (structural && row.status !== RECRUITMENT_STATUS.DRAFT) {
    throw errors.invalidState(
      'Positions and the application form can only be changed while the recruitment is a draft.',
    );
  }
  await db.transaction(async (trx) => {
    const patch = { updated_at: toDb(clock.now()) };
    if (input.title !== undefined) patch.title = input.title;
    if (input.description !== undefined) patch.description = input.description;
    if (input.deadline !== undefined) patch.deadline = input.deadline;
    if (input.autoAccept !== undefined) patch.auto_accept = boolToDb(input.autoAccept);
    await trx('recruitments').where({ id: row.id }).update(patch);
    if (input.positions !== undefined) await writePositions(trx, row.id, input.positions);
    if (input.fields !== undefined) {
      await trx('forms')
        .where({ recruitment_id: row.id })
        .update({ fields_json: jsonToDb(input.fields), updated_at: toDb(clock.now()) });
    }
  });
  return get(db, row.id, actor.id);
}

export async function openRecruitment(db, actor, row) {
  if (row.status !== RECRUITMENT_STATUS.DRAFT)
    throw errors.invalidState('Only a draft recruitment can be opened.');
  if (row.deadline <= toDb(clock.now()))
    throw errors.validation('The deadline is already in the past. Choose a later deadline first.', [
      { path: 'deadline', message: 'Choose a future deadline' },
    ]);
  const positions = await db('recruitment_positions').where({ recruitment_id: row.id });
  if (!positions.length) throw errors.validation('Add at least one position before opening.');
  await db.transaction(async (trx) => {
    const now = toDb(clock.now());
    await trx('recruitments')
      .where({ id: row.id })
      .update({ status: RECRUITMENT_STATUS.OPEN, updated_at: now });
    await trx('forms').where({ recruitment_id: row.id }).update({
      status: FORM_STATUS.PUBLISHED,
      published_at: now,
      opens_at: now,
      closes_at: row.deadline,
      updated_at: now,
    });
    await audit(trx, {
      actorId: actor.id,
      action: 'recruitment.opened',
      entityType: 'recruitment',
      entityId: row.id,
    });
    await notify(trx, {
      userIds: await allStudentIds(trx),
      type: 'recruitment.opened',
      title: `${row.club_name} is recruiting`,
      body: `${row.title}: apply before ${new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium' }).format(new Date(row.deadline))}.`,
      route: `/clubs/${row.club_slug}`,
    });
  });
  return get(db, row.id, actor.id);
}

export async function closeRecruitment(db, actor, row) {
  if (row.status !== RECRUITMENT_STATUS.OPEN)
    throw errors.invalidState('Only an open recruitment can be closed.');
  const now = toDb(clock.now());
  await db('recruitments')
    .where({ id: row.id })
    .update({ status: RECRUITMENT_STATUS.CLOSED, updated_at: now });
  await db('forms').where({ recruitment_id: row.id }).update({ status: FORM_STATUS.CLOSED, updated_at: now });
  await audit(db, {
    actorId: actor.id,
    action: 'recruitment.closed',
    entityType: 'recruitment',
    entityId: row.id,
  });
  return get(db, row.id, actor.id); // existing applications are untouched
}

// ---------- Reading ----------

export async function get(db, id, viewerId) {
  return (await hydrate(db, [await getRow(db, id)], viewerId))[0];
}

/** Members see every recruitment of the club; students see only the open one (FR-REC-02). */
export async function listForClub(db, clubId, { isMember, viewerId }) {
  const q = base(db).where('r.club_id', clubId).orderBy('r.created_at', 'desc');
  if (!isMember) q.where('r.status', RECRUITMENT_STATUS.OPEN).where('r.deadline', '>', toDb(clock.now()));
  return hydrate(db, await q, viewerId);
}

/** Auto-close recruitments past their deadline (job). */
export async function closeExpired(db) {
  const now = toDb(clock.now());
  const due = await db('recruitments')
    .where({ status: RECRUITMENT_STATUS.OPEN })
    .where('deadline', '<=', now)
    .pluck('id');
  if (!due.length) return 0;
  await db('recruitments').whereIn('id', due).update({ status: RECRUITMENT_STATUS.CLOSED, updated_at: now });
  await db('forms').whereIn('recruitment_id', due).update({ status: FORM_STATUS.CLOSED, updated_at: now });
  return due.length;
}

// ---------- Applying (FR-REC-03/06) ----------

export async function apply(db, user, recruitmentId, { positionId, answers }) {
  return db.transaction(async (trx) => {
    const r = await getRow(trx, recruitmentId);
    if (!isOpenNow(r))
      throw new AppError(ERROR_CODES.REGISTRATION_CLOSED, 'This recruitment is not accepting applications.');
    const membership = await trx('club_members')
      .where({ club_id: r.club_id, user_id: user.id, status: 'active' })
      .first();
    if (membership) throw errors.conflict('You are already a member of this club.'); // TC-REC-07
    const existing = await trx('applications').where({ recruitment_id: r.id, user_id: user.id }).first();
    if (existing && existing.status !== APPLICATION_STATUS.WITHDRAWN) {
      throw new AppError(ERROR_CODES.ALREADY_REGISTERED, 'You have already applied.', {
        application: { id: existing.id, status: existing.status },
      });
    }
    if (
      positionId &&
      !(await trx('recruitment_positions').where({ id: positionId, recruitment_id: r.id }).first())
    ) {
      throw errors.validation('Choose one of the listed positions.', [
        { path: 'positionId', message: 'Unknown position' },
      ]);
    }
    const form = await trx('forms').where({ recruitment_id: r.id }).first();
    const checked = validateAnswers(jsonFromDb(form.fields_json, []), answers);
    if (!checked.ok) {
      throw errors.validation(
        'Please correct the highlighted answers.',
        Object.entries(checked.errors).map(([path, message]) => ({ path, message })),
      );
    }
    const now = toDb(clock.now());
    if (existing) await trx('applications').where({ id: existing.id }).update({ form_response_id: null });
    await trx('form_responses').where({ form_id: form.id, user_id: user.id }).del();
    const responseId = newId();
    await trx('form_responses').insert({
      id: responseId,
      form_id: form.id,
      user_id: user.id,
      answers_json: jsonToDb(checked.value),
      submitted_at: now,
    });

    let id;
    const fresh = {
      position_id: positionId ?? null,
      form_response_id: responseId,
      status: APPLICATION_STATUS.SUBMITTED,
      reviewed_by: null,
      reviewed_at: null,
      note: null,
      updated_at: now,
    };
    if (existing) {
      id = existing.id;
      await trx('applications').where({ id }).update(fresh);
    } else {
      id = newId();
      await trx('applications').insert({
        id,
        recruitment_id: r.id,
        user_id: user.id,
        created_at: now,
        ...fresh,
      });
    }
    if (boolFromDb(r.auto_accept)) {
      await ensureMembership(trx, { clubId: r.club_id, userId: user.id });
      await trx('applications')
        .where({ id })
        .update({ status: APPLICATION_STATUS.ACCEPTED, reviewed_at: now, note: 'Auto-accepted' });
    }
    const status = boolFromDb(r.auto_accept) ? APPLICATION_STATUS.ACCEPTED : APPLICATION_STATUS.SUBMITTED;
    await notify(trx, {
      userIds: [user.id],
      type: 'application.status',
      title: status === 'accepted' ? 'Application accepted' : 'Application received',
      body:
        status === 'accepted'
          ? `Welcome to ${r.club_name}!`
          : `${r.club_name} received your application for "${r.title}".`,
      route: '/activities',
    });
    return { id, status };
  });
}

export async function withdraw(db, user, recruitmentId) {
  const a = await db('applications').where({ recruitment_id: recruitmentId, user_id: user.id }).first();
  if (!a) throw errors.notFound('You have no application for this recruitment.');
  if (![APPLICATION_STATUS.SUBMITTED, APPLICATION_STATUS.SHORTLISTED].includes(a.status)) {
    throw errors.invalidState('This application has already been decided or withdrawn.');
  }
  await db('applications')
    .where({ id: a.id })
    .update({ status: APPLICATION_STATUS.WITHDRAWN, updated_at: toDb(clock.now()) });
  return { id: a.id, status: APPLICATION_STATUS.WITHDRAWN };
}

// ---------- Reviewing (FR-REC-04/05, TC-REC-04/05) ----------

export async function listApplications(db, recruitmentId) {
  const rows = await db('applications as a')
    .join('users as u', 'u.id', 'a.user_id')
    .leftJoin('form_responses as fr', 'fr.id', 'a.form_response_id')
    .leftJoin('recruitment_positions as p', 'p.id', 'a.position_id')
    .where('a.recruitment_id', recruitmentId)
    .select(
      'a.*',
      'u.full_name',
      'u.email',
      'u.roll_number',
      'u.department',
      'u.year_of_study',
      'fr.answers_json',
      'p.title as position_title',
    )
    .orderBy('a.created_at');
  return rows.map((a) => ({
    id: a.id,
    status: a.status,
    positionId: a.position_id,
    positionTitle: a.position_title,
    note: a.note,
    appliedAt: a.created_at,
    reviewedAt: a.reviewed_at,
    user: {
      id: a.user_id,
      fullName: a.full_name,
      email: a.email,
      rollNumber: a.roll_number,
      department: a.department,
      yearOfStudy: a.year_of_study,
    },
    answers: jsonFromDb(a.answers_json, {}),
  }));
}

const NEXT = {
  [APPLICATION_STATUS.SUBMITTED]: ['shortlisted', 'accepted', 'rejected'],
  [APPLICATION_STATUS.SHORTLISTED]: ['accepted', 'rejected'],
};

export async function decide(db, actor, applicationId, { status, roleKey, note }) {
  return db.transaction(async (trx) => {
    const a = await trx('applications').where({ id: applicationId }).first();
    if (!a) throw errors.notFound('Application not found.');
    if (!(NEXT[a.status] ?? []).includes(status))
      throw errors.invalidState(`An application that is ${a.status} cannot be set to ${status}.`);
    const r = await getRow(trx, a.recruitment_id);
    const now = toDb(clock.now());
    if (status === APPLICATION_STATUS.ACCEPTED) {
      // Membership and status change happen together or not at all (spec 5.4).
      await ensureMembership(trx, { clubId: r.club_id, userId: a.user_id, roleKey: roleKey ?? 'MEMBER' });
    }
    await trx('applications')
      .where({ id: a.id })
      .update({ status, reviewed_by: actor.id, reviewed_at: now, note: note ?? null, updated_at: now });
    await audit(trx, {
      actorId: actor.id,
      action: `application.${status}`,
      entityType: 'application',
      entityId: a.id,
    });
    await notify(trx, {
      userIds: [a.user_id],
      type: 'application.status',
      title: `Application ${status}`,
      body: `${r.club_name}: your application for "${r.title}" was ${status}.${note ? ` ${note}` : ''}`,
      route: '/activities',
    });
    return { id: a.id, status };
  });
}

export async function getApplicationClub(db, applicationId) {
  const a = await db('applications as a')
    .join('recruitments as r', 'r.id', 'a.recruitment_id')
    .where('a.id', applicationId)
    .select('r.club_id')
    .first();
  return a?.club_id;
}

/** Applications shown on the student's Activities page: open ones are "current", decided ones "past" (FR-ACT-01). */
export async function myApplications(db, userId) {
  const rows = await db('applications as a')
    .join('recruitments as r', 'r.id', 'a.recruitment_id')
    .join('clubs as c', 'c.id', 'r.club_id')
    .where('a.user_id', userId)
    .select('a.*', 'r.title', 'r.deadline', 'c.name as club_name', 'c.slug')
    .orderBy('a.created_at', 'desc');
  return rows.map((a) => ({
    id: a.id,
    recruitmentId: a.recruitment_id,
    title: a.title,
    clubName: a.club_name,
    clubSlug: a.slug,
    status: a.status,
    appliedAt: a.created_at,
    decided: ['accepted', 'rejected', 'withdrawn'].includes(a.status),
  }));
}
