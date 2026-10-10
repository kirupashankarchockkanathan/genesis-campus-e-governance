import { test, expect } from '@playwright/test';
import {
  ACCOUNTS,
  apiGet,
  apiLogin,
  apiPost,
  approvedEvent,
  createStudent,
  hutLabsId,
  slot,
  uiLogin,
  uniq,
  zoned,
} from './support.js';

async function registerViaApi(request, student, ev) {
  const token = await apiLogin(request, student.acct);
  await apiPost(request, token, `/events/${ev.id}/register`, { answers: {} });
  return token;
}

test.describe('E2E-03 final hall request and venue confirmation', () => {
  test('registration closes, the Leader sends the final request, the Events Authority approves, the student sees the venue', async ({
    page,
    request,
  }) => {
    const ev = await approvedEvent(request, {
      day: 36,
      title: `E2E Hall ${uniq()}`,
      hallName: 'Mini Auditorium',
    });
    const student = await createStudent(request, 'e2e03');
    await registerViaApi(request, student, ev);

    await uiLogin(page, 'member', ACCOUNTS.leader);
    await page.goto(`/club/${ev.clubId}/events/${ev.id}?tab=form`);
    await page.getByRole('button', { name: 'Close registration now' }).click();
    await expect(page.getByText('closed', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Hall' }).click();
    await page.getByRole('button', { name: 'Send final hall request' }).click();
    await expect(page.getByText('Request sent.')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    await uiLogin(page, 'admin', ACCOUNTS.events);
    await expect(page.getByRole('heading', { name: 'Hall requests', level: 1 })).toBeVisible();
    const row = page.getByRole('row', { name: new RegExp(ev.title) });
    await expect(row).toContainText('1 / 40');
    await row.getByRole('button', { name: 'Approve' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByText('No requests waiting')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    await uiLogin(page, 'student', student.acct);
    await page.goto(`/events/${ev.id}`);
    await expect(page.locator('.fact-tiles')).toContainText('Mini Auditorium');
    await page.getByRole('button', { name: /notifications \(/i }).click();
    await expect(page.getByRole('dialog', { name: /notifications/i })).toContainText('Venue confirmed');
  });
});

test.describe('E2E-04 recruitment', () => {
  test('club opens recruitment, a student applies, the Secretary accepts, the club appears under My Clubs', async ({
    page,
    request,
  }) => {
    const leader = await apiLogin(request, ACCOUNTS.leader);
    const clubId = await hutLabsId(request, leader);
    const title = `E2E Recruitment ${uniq()}`;
    const rec = await apiPost(request, leader, `/clubs/${clubId}/recruitments`, {
      title,
      description: 'Join the build team',
      deadline: new Date(Date.now() + 10 * 86400000).toISOString(),
      positions: [{ title: 'Builder', description: 'Build robots', openings: 5 }],
      fields: [{ id: 'why', type: 'long_text', label: 'Why do you want to join?', help: '', required: true }],
    });
    await apiPost(request, leader, `/recruitments/${rec.id}/open`);
    const student = await createStudent(request, 'e2e04');

    await uiLogin(page, 'student', student.acct);
    await page.goto('/clubs/hut-labs?tab=recruitment');
    await expect(page.getByRole('heading', { name: title })).toBeVisible();
    await page.getByRole('button', { name: 'Register' }).first().click();
    await page.getByLabel(/Why do you want to join/).fill('I love robots.');
    await page.getByRole('button', { name: 'Submit application' }).click();
    await expect(page.getByText('Your application: submitted')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    await uiLogin(page, 'member', ACCOUNTS.secretary);
    await page.getByRole('link', { name: 'Recruitment' }).first().click();
    const card = page.locator('article', { hasText: title });
    await card.getByRole('button', { name: 'Review applications' }).click();
    await card
      .getByRole('row', { name: new RegExp(student.fullName) })
      .getByRole('button', { name: 'Accept' })
      .click();
    await expect(card.getByText('Decided')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    await uiLogin(page, 'student', student.acct);
    await page.getByRole('link', { name: 'My Clubs' }).click();
    await expect(page.getByRole('heading', { name: 'Hut Labs' })).toBeVisible();
  });
});

test.describe('E2E-05 role limits', () => {
  test('Media Lead can post an announcement and upload a poster but sees no Submit button; Event Coordinator can build the form but cannot submit', async ({
    page,
    request,
  }) => {
    const leader = await apiLogin(request, ACCOUNTS.leader);
    const clubId = await hutLabsId(request, leader);
    const s = slot(40);
    const draft = await apiPost(request, leader, `/clubs/${clubId}/events`, {
      title: `E2E Draft ${uniq()}`,
      type: 'talk',
      summary: 'A talk',
      mode: 'offline',
      expectedParticipants: 30,
      startsAt: zoned(s.starts),
      endsAt: zoned(s.ends),
      registrationDeadline: zoned(s.deadline),
    });

    await uiLogin(page, 'member', ACCOUNTS.media);
    await page.getByRole('link', { name: 'Announcements' }).first().click();
    const ann = `E2E announcement ${uniq()}`;
    await page.getByLabel('Title').fill(ann);
    await page.getByLabel('Message').fill('Posted by the Media Lead.');
    await page.getByRole('button', { name: 'Post announcement' }).click();
    await expect(page.getByRole('heading', { name: ann })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Add an event' })).toHaveCount(0); // no event.draft permission

    await page.goto(`/club/${clubId}/events/${draft.id}`);
    await expect(page.getByRole('button', { name: 'Submit to OSI' })).toHaveCount(0);
    await expect(page.getByText('Only the Leader can submit to the OSI.')).toBeVisible();
    await page.getByRole('tab', { name: 'Poster' }).click();
    await expect(page.locator('#poster-file')).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Form' })).toHaveAttribute('aria-disabled', 'true');
    await page.getByRole('button', { name: 'Log out' }).click();

    await uiLogin(page, 'member', ACCOUNTS.coordinator);
    await page.goto(`/club/${clubId}/events/${draft.id}?tab=form`);
    await page.getByRole('button', { name: '+ Short text' }).click();
    await page.getByLabel('Label').fill('Your favourite robot');
    await page.getByRole('button', { name: 'Save form' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await page.getByRole('tab', { name: 'Plan' }).click();
    await expect(page.getByRole('button', { name: 'Submit to OSI' })).toHaveCount(0);
  });
});

test.describe('E2E-06 hall conflicts', () => {
  test('a second club sees the held hall as busy and is offered free alternatives', async ({
    page,
    request,
  }) => {
    const ev = await approvedEvent(request, {
      day: 44,
      title: `E2E Holder ${uniq()}`,
      hallName: 'Seminar Hall A',
      publish: false,
    });
    // A second club with its own Leader, created by the OSI.
    const leader2 = await createStudent(request, 'e2e06');
    const osi = await apiLogin(request, ACCOUNTS.osi);
    const name = `E2E Club ${uniq()}`;
    const club2 = await apiPost(request, osi, '/clubs', {
      name,
      category: 'Other',
      description: 'Second club',
      leaderEmail: leader2.email,
    });
    const token2 = await apiLogin(request, leader2.acct);
    await apiPost(request, token2, `/clubs/${club2.id}/events`, {
      title: `E2E Clash ${uniq()}`,
      type: 'workshop',
      summary: 'Wants the same hall',
      mode: 'offline',
      expectedParticipants: 40,
      startsAt: zoned(ev.starts),
      endsAt: zoned(ev.ends),
      registrationDeadline: zoned(ev.deadline),
    });
    const events = await apiGet(request, token2, `/clubs/${club2.id}/events`);

    await uiLogin(page, 'member', leader2.acct);
    await page.goto(`/club/${club2.id}/events/${events[0].id}`);
    await page.getByRole('button', { name: 'Submit to OSI' }).click();
    const busy = page.locator('.hall-card', { hasText: 'Seminar Hall A' });
    await expect(busy).toContainText('Busy');
    await expect(busy.locator('input[type=radio]')).toBeDisabled();
    await expect(page.locator('.hall-card', { hasText: 'Free' }).first()).toBeVisible(); // alternatives are offered
  });
});

test.describe('E2E-09 check-in', () => {
  test('a member checks a student in by ticket code and the registration shows as attended', async ({
    page,
    request,
  }) => {
    const ev = await approvedEvent(request, {
      day: 48,
      title: `E2E Checkin ${uniq()}`,
      hallName: 'Innovation Lab',
      expected: 30,
    });
    const student = await createStudent(request, 'e2e09');
    const token = await registerViaApi(request, student, ev);
    const ticket = await apiGet(request, token, `/me/registrations/${ev.id}/ticket`);

    await uiLogin(page, 'member', ACCOUNTS.secretary);
    await page.goto(`/club/${ev.clubId}/events/${ev.id}?tab=registrations`);
    await page.getByLabel('Ticket code').fill(ticket.qrToken);
    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByText(`${student.fullName} checked in.`)).toBeVisible();
    // Scanning twice reports "already checked in".
    await page.getByLabel('Ticket code').fill(ticket.qrToken);
    await page.getByRole('button', { name: 'Check in' }).click();
    await expect(page.getByRole('alert')).toContainText('already checked in');
    await page.getByRole('button', { name: 'Log out' }).click();

    await uiLogin(page, 'student', student.acct);
    await page.getByRole('link', { name: 'Activities' }).first().click();
    await page.getByRole('tab', { name: 'All registrations' }).click();
    await expect(page.getByText('Attended')).toBeVisible();
  });
});
