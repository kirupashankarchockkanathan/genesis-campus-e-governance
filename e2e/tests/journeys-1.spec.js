import { test, expect } from '@playwright/test';
import { ACCOUNTS, PNG, approvedEvent, createStudent, lastMailTo, slot, uiLogin, uniq } from './support.js';

test.describe('E2E-01 student sign-up and browsing', () => {
  test('signs up, logs in through the Student portal, browses clubs, favourites one and opens its page', async ({
    page,
  }) => {
    const u = `e2e_${uniq()}`;
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('E2E Student');
    await page.getByLabel('College email').fill(`${u}@campus.example`);
    await page.getByLabel('Username').fill(u);
    await page.getByLabel('Roll number').fill(`R-${u}`);
    await page.getByLabel('Department').fill('CSE');
    await page.getByLabel('Year of study').selectOption('2');
    await page.getByLabel('Password', { exact: true }).fill('E2e-Student-Pass-9!');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByText('Your account is ready.')).toBeVisible(); // AUTO_VERIFY_EMAIL in the test stack
    await page.getByRole('link', { name: 'Go to log in' }).click();

    await page.getByLabel('Username or email').fill(u);
    await page.getByLabel('Password', { exact: true }).fill('E2e-Student-Pass-9!');
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(/\/clubs$/);
    await expect(page.getByRole('heading', { name: 'Clubs', level: 1 })).toBeVisible();
    await expect(page.locator('.club-card')).toHaveCount(26);

    await page.getByLabel('Search clubs').fill('Hut Labs');
    await expect(page.locator('.club-card')).toHaveCount(1);
    await page.getByRole('button', { name: 'Add Hut Labs to favourites' }).click();
    await expect(page.getByRole('button', { name: 'Remove Hut Labs from favourites' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );

    await page.getByRole('link', { name: 'Hut Labs' }).first().click();
    await expect(page.getByRole('heading', { name: 'Hut Labs', level: 1 })).toBeVisible();
    await expect(page.getByRole('tab', { name: 'Recruitment' })).toBeVisible();

    await page.getByRole('link', { name: 'Favourites' }).click();
    await expect(page.getByRole('heading', { name: 'Hut Labs', level: 2 })).toBeVisible();
  });

  test('the start screen offers exactly three portals and each login refuses the wrong kind of account', async ({
    page,
  }) => {
    await page.goto('/login');
    const nav = page.getByRole('navigation', { name: /choose how to sign in/i });
    await expect(nav.getByRole('link')).toHaveCount(3);
    await expect(nav.getByRole('link').nth(0)).toContainText('Student');
    await expect(nav.getByRole('link').nth(1)).toContainText('Club Member');
    await expect(nav.getByRole('link').nth(2)).toContainText('Administrator');

    await uiLogin(page, 'admin', ACCOUNTS.student); // a student on the Administrator login
    await expect(page.getByRole('alert')).toContainText(/student account/i);
    await uiLogin(page, 'member', ACCOUNTS.student); // student is not a club member (sample_student)
    await expect(page.getByRole('alert')).toContainText(/not a member of any club/i);
    await uiLogin(page, 'student', ACCOUNTS.osi);
    await expect(page.getByRole('alert')).toContainText(/Administrator login/i);
  });
});

test.describe('E2E-02 plan, approve, publish and register', () => {
  test('Leader drafts an event with poster and submits; OSI approves; student sees it everywhere and registers', async ({
    page,
    request,
  }) => {
    const title = `E2E Robotics Day ${uniq()}`;
    const s = slot(30);
    // The student exists before approval, so the "new event" notification reaches them.
    const student = await createStudent(request, 'e2e02');

    // Leader: Club Member portal, add an event.
    await uiLogin(page, 'member', ACCOUNTS.leader);
    await expect(page.getByRole('heading', { name: 'Hut Labs', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: 'Add an event' }).click();
    await page.getByLabel('Title', { exact: true }).fill(title);
    await page.getByLabel('Short summary').fill('A day of robots.');
    await page.getByLabel('Full description').fill('Build, test and race small robots with mentors.');
    await page.getByLabel('Objectives').fill('Teach the basics of robotics.');
    await page.getByLabel('Starts').fill(s.starts);
    await page.getByLabel('Ends').fill(s.ends);
    await page.getByLabel('Registration deadline').fill(s.deadline);
    await page.getByLabel('Expected participants').fill('40');
    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page.getByRole('heading', { name: title, level: 1 })).toBeVisible();

    // Poster, then submit with a free hall.
    await page.getByRole('tab', { name: 'Poster' }).click();
    await page
      .locator('#poster-file')
      .setInputFiles({ name: 'poster.png', mimeType: 'image/png', buffer: PNG });
    await expect(page.getByRole('img', { name: `Poster of ${title}` })).toBeVisible();
    await page.getByRole('tab', { name: 'Plan' }).click();
    await page.getByRole('button', { name: 'Submit to OSI' }).click();
    await page.locator('input[name=hall]:not([disabled])').first().check();
    await page.getByRole('dialog').getByRole('button', { name: 'Submit', exact: true }).click();
    await expect(page.getByText('Submitted to the OSI')).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    // OSI: Administrator portal, approve and circulate.
    await uiLogin(page, 'admin', ACCOUNTS.osi);
    await expect(page.getByRole('heading', { name: 'Approvals', level: 1 })).toBeVisible();
    await page.getByRole('link', { name: title, exact: true }).click();
    await page.getByRole('button', { name: 'Approve and circulate' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(/\/osi\/approvals$/);
    await page.getByRole('button', { name: 'Log out' }).click();

    // Leader publishes registration.
    await uiLogin(page, 'member', ACCOUNTS.leader);
    await page.getByRole('link', { name: 'Events' }).first().click();
    await page.getByRole('link', { name: title, exact: true }).click();
    await page.getByRole('tab', { name: 'Form' }).click();
    await page.getByRole('button', { name: 'Publish registration' }).click();
    await expect(page.getByText('published', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Log out' }).click();

    // A new student sees it in Events, Calendar and notifications, and registers.
    await uiLogin(page, 'student', student.acct);
    await page.getByRole('link', { name: 'Events' }).first().click();
    await expect(page.getByRole('link', { name: title, exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: /notifications \([1-9]\d* unread\)/i })).toBeVisible();
    await page.getByRole('link', { name: 'Calendar' }).first().click();
    // The event is about a month away: page forward until its chip appears in the month grid.
    for (let i = 0; i < 3; i++) {
      await page.waitForTimeout(800);
      if (
        await page
          .getByRole('grid')
          .getByText(title, { exact: false })
          .first()
          .isVisible()
          .catch(() => false)
      )
        break;
      await page.getByRole('button', { name: 'Next month' }).click();
    }
    await expect(page.getByRole('grid').getByText(title, { exact: false }).first()).toBeVisible();
    await page.getByRole('link', { name: 'Events' }).first().click();
    await page.getByRole('link', { name: title, exact: true }).first().click();
    await page.getByRole('button', { name: 'Register' }).click();
    await expect(page.getByText('You are registered')).toBeVisible();
    await expect(page.getByRole('img', { name: /QR ticket/i })).toBeVisible();
  });
});

test.describe('E2E-07 sharing', () => {
  test('a logged-out visitor sees the public page and is asked to log in to register', async ({
    page,
    request,
  }) => {
    const ev = await approvedEvent(request, {
      day: 33,
      title: `E2E Share ${uniq()}`,
      hallName: 'Seminar Hall B',
    });
    await page.goto(`/e/${ev.id}`);
    await expect(page.getByRole('heading', { name: ev.title, level: 1 })).toBeVisible();
    await expect(page.getByText('Log in to register for this event.')).toBeVisible();
    await expect(page.locator('body')).not.toContainText('@campus.example'); // no personal data
    await page.getByRole('link', { name: 'Log in to register' }).click();
    await expect(page).toHaveURL(/\/login\?as=student/);
    // After logging in the student lands back on the event to register.
    const student = await createStudent(request, 'e2e07');
    await page.getByLabel('Username or email').fill(student.id);
    await page.getByLabel('Password', { exact: true }).fill(student.password);
    await page.getByRole('button', { name: 'Log in' }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${ev.id}`));
    await expect(page.getByRole('button', { name: 'Register' })).toBeVisible();
  });
});

test.describe('E2E-08 password reset', () => {
  test('forgot password, follow the emailed link, set a new password and log in with it', async ({
    page,
    request,
  }) => {
    const student = await createStudent(request, 'e2e08');
    await page.goto('/forgot-password');
    await page.getByLabel('College email').fill(student.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByText(/reset link is on its way/i)).toBeVisible();

    await expect.poll(() => lastMailTo(student.email)?.subject ?? '').toMatch(/reset/i);
    const link = lastMailTo(student.email).text.match(/http:\/\/\S+/)[0];
    await page.goto(new URL(link).pathname + new URL(link).search);
    await page.getByLabel('New password').fill('Brand-New-Pass-77');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByText('Password updated. Please log in.')).toBeVisible();
    // The same link cannot be used twice.
    await page.goto(new URL(link).pathname + new URL(link).search);
    await page.getByLabel('New password').fill('Another-Pass-88');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('alert')).toContainText(/invalid or has expired/i);

    await uiLogin(page, 'student', { id: student.id, password: 'Brand-New-Pass-77' });
    await expect(page).toHaveURL(/\/clubs$/);
  });
});
