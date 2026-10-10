import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect } from '@playwright/test';
import { PASSWORDS } from '../passwords.js';

export const API = 'http://localhost:4100/api/v1';
const here = path.dirname(fileURLToPath(import.meta.url));
export const MAIL_FILE = path.resolve(here, '../.data/mail.jsonl');

export const ACCOUNTS = {
  student: { id: 'sample_student', password: PASSWORDS.sample },
  leader: { id: 'sample_leader', password: PASSWORDS.sample },
  vice: { id: 'sample_vice', password: PASSWORDS.sample },
  secretary: { id: 'sample_secretary', password: PASSWORDS.sample },
  coordinator: { id: 'sample_coordinator', password: PASSWORDS.sample },
  media: { id: 'sample_media', password: PASSWORDS.sample },
  member: { id: 'sample_member', password: PASSWORDS.sample },
  osi: { id: 'osi@campus.example', password: PASSWORDS.osi },
  events: { id: 'events@campus.example', password: PASSWORDS.events },
  superAdmin: { id: 'superadmin@campus.example', password: PASSWORDS.superAdmin },
};

// Admin accounts must change their first password; remember the new one for later logins in this run.
// Kept in a file because Playwright restarts its worker after a failed test, which would forget it.
const CHANGED_FILE = path.resolve(here, '../.data/changed-passwords.json');
const readChanged = () =>
  fs.existsSync(CHANGED_FILE) ? JSON.parse(fs.readFileSync(CHANGED_FILE, 'utf8')) : {};
const changed = {
  get: (id) => readChanged()[id],
  set: (id, pw) => fs.writeFileSync(CHANGED_FILE, JSON.stringify({ ...readChanged(), [id]: pw })),
};
const passwordFor = (acct) => changed.get(acct.id) ?? acct.password;
const NEW_PASSWORD = (acct) => `${acct.password}-Changed9`;

export const PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

// ---------- API helpers (fast setup) ----------

export async function apiLogin(request, acct) {
  const res = await request.post(`${API}/auth/login`, {
    data: { identifier: acct.id, password: passwordFor(acct) },
  });
  expect(res.ok(), `login ${acct.id}`).toBeTruthy();
  let { data } = await res.json();
  if (data.user.mustChangePassword) {
    const next = NEW_PASSWORD(acct);
    const ch = await request.post(`${API}/me/change-password`, {
      headers: { Authorization: `Bearer ${data.accessToken}` },
      data: { currentPassword: passwordFor(acct), newPassword: next },
    });
    expect(ch.ok(), 'change password').toBeTruthy();
    changed.set(acct.id, next);
    data = (await ch.json()).data;
  }
  return data.accessToken;
}

export const auth = (token) => ({ Authorization: `Bearer ${token}` });

export async function apiGet(request, token, p) {
  const res = await request.get(`${API}${p}`, { headers: auth(token) });
  expect(res.ok(), `GET ${p}: ${res.status()}`).toBeTruthy();
  return (await res.json()).data;
}
export async function apiPost(request, token, p, data = {}, expectOk = true) {
  const res = await request.post(`${API}${p}`, { headers: auth(token), data });
  if (expectOk) expect(res.ok(), `POST ${p}: ${res.status()} ${await res.text()}`).toBeTruthy();
  return res.ok() ? (await res.json()).data : res;
}

export const uniq = () => `${Date.now().toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`;

export async function createStudent(request, label = 'e2e') {
  const u = uniq();
  const body = {
    fullName: `E2E ${label} ${u}`,
    email: `${label}_${u}@campus.example`,
    username: `${label}_${u}`,
    rollNumber: `E2E-${u}`,
    department: 'CSE',
    yearOfStudy: 2,
    password: 'E2e-Student-Pass-9!',
  };
  const res = await request.post(`${API}/auth/signup`, { data: body });
  expect(res.ok(), `signup ${await res.text()}`).toBeTruthy();
  return { ...body, id: body.username, acct: { id: body.username, password: body.password } };
}

/** yyyy-MM-dd and times for a future day, for datetime-local inputs (typed in the portal time zone). */
export function slot(dayOffset, startHour = 10, hours = 2) {
  const d = new Date(Date.now() + dayOffset * 86400000);
  const day = d.toISOString().slice(0, 10);
  const prev = new Date(d.getTime() - 86400000).toISOString().slice(0, 10);
  const hh = (h) => String(h).padStart(2, '0');
  return {
    day,
    starts: `${day}T${hh(startHour)}:00`,
    ends: `${day}T${hh(startHour + hours)}:00`,
    deadline: `${prev}T09:00`,
  };
}

/** Converts a datetime-local string in the portal zone (Asia/Kolkata, UTC+5:30) to an ISO instant. */
export const zoned = (local) => new Date(new Date(`${local}:00Z`).getTime() - 330 * 60000).toISOString();

export const hutLabsId = async (request, token) =>
  (await apiGet(request, token, '/me/clubs')).find((c) => c.name === 'Hut Labs').id;

/** Draft with poster, submitted by the Leader into a hall, approved by the OSI, registration published. */
export async function approvedEvent(
  request,
  { day, title, hallName = 'Seminar Hall A', publish = true, expected = 40 },
) {
  const leader = await apiLogin(request, ACCOUNTS.leader);
  const clubId = await hutLabsId(request, leader);
  const s = slot(day);
  const ev = await apiPost(request, leader, `/clubs/${clubId}/events`, {
    title,
    type: 'workshop',
    summary: `${title} summary`,
    description: `${title} description`,
    objectives: 'Learn things',
    mode: 'offline',
    expectedParticipants: expected,
    startsAt: zoned(s.starts),
    endsAt: zoned(s.ends),
    registrationDeadline: zoned(s.deadline),
  });
  const up = await request.post(`${API}/events/${ev.id}/poster`, {
    headers: auth(leader),
    multipart: { poster: { name: 'poster.png', mimeType: 'image/png', buffer: PNG } },
  });
  expect(up.ok(), 'poster').toBeTruthy();
  const halls = await apiGet(request, leader, '/halls');
  const hall = halls.find((h) => h.name === hallName);
  await apiPost(request, leader, `/events/${ev.id}/submit`, { hallId: hall.id });
  const osi = await apiLogin(request, ACCOUNTS.osi);
  await apiPost(request, osi, `/osi/events/${ev.id}/decision`, { decision: 'approved', circulate: true });
  if (publish) await apiPost(request, leader, `/events/${ev.id}/form/publish`, {});
  return { id: ev.id, title, clubId, hall, ...s };
}

// ---------- UI helpers ----------

export async function uiLogin(page, portal, acct) {
  await page.goto(`/login?as=${portal}`);
  await page.getByLabel('Username or email').fill(acct.id);
  await page.getByLabel('Password', { exact: true }).fill(passwordFor(acct));
  await page.getByRole('button', { name: 'Log in' }).click();
  if (portal === 'admin') {
    // First login of an admin account: the forced password change screen.
    await page
      .waitForURL(/\/(change-password|osi\/|events-admin\/|admin\/)/, { timeout: 15000 })
      .catch(() => {});
    if (page.url().includes('/change-password')) {
      const next = NEW_PASSWORD(acct);
      await page.getByLabel('Current password').fill(passwordFor(acct));
      await page.getByLabel('New password').fill(next);
      await page.getByRole('button', { name: 'Save new password' }).click();
      changed.set(acct.id, next);
      await page.waitForURL(/\/(osi\/|events-admin\/|admin\/)/);
    }
  }
}

export async function uiLogout(page) {
  await page.getByRole('button', { name: 'Log out' }).click();
  await expect(page.getByRole('navigation', { name: /choose how to sign in/i })).toBeVisible();
}

export function lastMailTo(email) {
  const lines = fs.existsSync(MAIL_FILE)
    ? fs.readFileSync(MAIL_FILE, 'utf8').trim().split('\n').filter(Boolean)
    : [];
  return lines
    .map((l) => JSON.parse(l))
    .reverse()
    .find((m) => m.to === email);
}
