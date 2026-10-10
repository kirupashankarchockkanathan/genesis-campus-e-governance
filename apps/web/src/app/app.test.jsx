import { describe, it, expect, afterEach, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PERMISSIONS, DEFAULT_ROLE_PERMISSIONS } from '@ccp/shared';
import { mockApi, mockSession, makeUser, membership, renderApp } from '../test/helpers.jsx';
import { sidebarFor } from '../utils/navigation.js';
import { PermissionGate } from './guards/guards.jsx';
import { AuthProvider } from '../auth/AuthContext.jsx';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

afterEach(() => vi.unstubAllGlobals());

const navLabels = () =>
  within(screen.getAllByRole('navigation', { name: /main|club workspace/i })[0])
    .getAllByRole('link')
    .map((a) => a.textContent);

describe('login and signup forms', () => {
  it('TC-UI-01 login shows field errors and does not submit empty values', async () => {
    const calls = mockApi({
      'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }],
    });
    renderApp('/login?as=student');
    await userEvent.click(await screen.findByRole('button', { name: /^log in$/i }));
    expect(await screen.findByText(/enter your username or email/i)).toBeInTheDocument();
    expect(screen.getByText(/enter your password/i)).toBeInTheDocument();
    expect(calls.some((c) => c.key === 'POST /auth/login')).toBe(false);
  });

  it('TC-UI-01 login disables the submit button while sending, then shows the server error', async () => {
    let release;
    const pending = new Promise((r) => (release = r));
    mockApi({
      'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }],
      'POST /auth/login': () => pending,
    });
    renderApp('/login?as=student');
    await userEvent.type(await screen.findByLabelText(/username or email/i), 'asha');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'whatever1');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
    expect(await screen.findByRole('button', { name: /logging in/i })).toBeDisabled();
    release({
      ok: false,
      status: 401,
      json: () =>
        Promise.resolve({ error: { code: 'UNAUTHENTICATED', message: 'Incorrect username or password.' } }),
    });
    expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect username or password.');
  });

  it('TC-UI-01 signup shows field errors for bad input', async () => {
    mockApi({ 'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }] });
    renderApp('/signup');
    await userEvent.click(await screen.findByRole('button', { name: /create account/i }));
    expect((await screen.findAllByText(/required|at least|invalid/i)).length).toBeGreaterThan(0);
  });
});

describe('route guards', () => {
  it('TC-UI-02 logged-out users are redirected to the start screen with exactly three buttons', async () => {
    mockApi({ 'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }] });
    renderApp('/clubs');
    const nav = await screen.findByRole('navigation', { name: /choose how to sign in/i });
    const links = within(nav).getAllByRole('link');
    expect(links).toHaveLength(3);
    expect(links.map((l) => l.getAttribute('href'))).toEqual([
      '/login?as=student',
      '/login?as=member',
      '/login?as=admin',
    ]);
    expect(links[0]).toHaveTextContent('Student');
    expect(links[1]).toHaveTextContent('Club Member');
    expect(links[2]).toHaveTextContent('Administrator');
  });

  it('each portal opens its own login screen', async () => {
    mockApi({ 'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }] });
    renderApp('/login?as=admin');
    expect(await screen.findByRole('heading', { name: /administrator login/i })).toBeInTheDocument();
  });

  it('TC-UI-02 the wrong platform role sees an access-denied page, not a blank page', async () => {
    mockSession({ user: makeUser({ platformRole: 'student' }) });
    renderApp('/osi/approvals');
    expect(await screen.findByText(/you do not have access/i)).toBeInTheDocument();
  });

  it('TC-UI-02 a club permission the role lacks shows access denied', async () => {
    mockSession({
      memberships: [membership('c1', 'MEDIA_LEAD', 'Media Lead', DEFAULT_ROLE_PERMISSIONS.MEDIA_LEAD)],
    });
    renderApp('/club/c1/events/new');
    expect(await screen.findByText(/you do not have access/i)).toBeInTheDocument();
  });

  it('a student who is not in a club cannot open that club workspace', async () => {
    mockSession();
    renderApp('/club/c9');
    expect(await screen.findByText(/you do not have access/i)).toBeInTheDocument();
  });

  it('forced password change: an admin with must_change_password is sent to change-password', async () => {
    const admin = makeUser({ platformRole: 'osi_admin', mustChangePassword: true });
    mockSession({ user: admin });
    renderApp('/osi/approvals');
    expect(await screen.findByRole('heading', { name: /change your password/i })).toBeInTheDocument();
  });
});

describe('sidebar per role (TC-UI-03)', () => {
  it('student without clubs has no My Clubs item', async () => {
    mockSession();
    renderApp('/clubs');
    await screen.findByRole('heading', { name: 'Clubs', level: 1 }).catch(() => null);
    await waitFor(() =>
      expect(navLabels()).toEqual(['Clubs', 'Events', 'Favourites', 'Activities', 'Profile', 'Settings']),
    );
  });

  it('student who is a club member sees My Clubs', () => {
    const items = sidebarFor({
      platformRole: 'student',
      memberships: [membership('c1', 'MEMBER', 'Member', [])],
    });
    expect(items.map((i) => i.label)).toContain('My Clubs');
  });

  it('club workspace items depend on the club role', () => {
    const labelsFor = (role) =>
      sidebarFor({
        platformRole: 'student',
        memberships: [membership('c1', role, role, DEFAULT_ROLE_PERMISSIONS[role])],
        clubId: 'c1',
      }).map((i) => i.label);
    const leader = labelsFor('LEADER');
    for (const l of [
      'Add an event',
      'Announcements',
      'Recruitment',
      'Registrations',
      'Reports',
      'Members and roles',
      'Student view',
    ])
      expect(leader).toContain(l);
    const media = labelsFor('MEDIA_LEAD');
    expect(media).toContain('Announcements');
    expect(media).not.toContain('Add an event');
    expect(media).not.toContain('Registrations');
    const member = labelsFor('MEMBER');
    for (const l of ['Announcements', 'Add an event', 'Recruitment', 'Registrations', 'Reports'])
      expect(member).not.toContain(l);
    expect(member).toContain('Discussion');
  });

  it('OSI, Events Authority and Super Admin get their own sidebars', () => {
    const labels = (platformRole) => sidebarFor({ platformRole, memberships: [] }).map((i) => i.label);
    expect(labels('osi_admin')).toEqual(['Approvals', 'Clubs', 'Calendar', 'Reports', 'Profile', 'Settings']);
    expect(labels('events_admin')).toEqual([
      'Hall requests',
      'Holds',
      'Halls',
      'Availability',
      'Calendar',
      'Profile',
      'Settings',
    ]);
    expect(labels('super_admin')).toEqual(['Users', 'Audit log', 'Settings']);
  });

  it('after login each role lands on its own home page (FR-AUTH-07)', async () => {
    mockSession({ user: makeUser({ platformRole: 'events_admin' }) });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Hall requests', level: 1 })).toBeInTheDocument();
  });

  it('club members land in their club workspace', async () => {
    mockSession({ memberships: [membership('c1', 'LEADER', 'Leader', DEFAULT_ROLE_PERMISSIONS.LEADER)] });
    renderApp('/');
    expect(await screen.findByRole('heading', { name: 'Club c1', level: 1 })).toBeInTheDocument();
  });
});

describe('PermissionGate (TC-UI-04)', () => {
  const renderGate = (role) => {
    mockSession({ memberships: [membership('c1', role, role, DEFAULT_ROLE_PERMISSIONS[role])] });
    return render(
      <MemoryRouter>
        <AuthProvider>
          <PermissionGate permission={PERMISSIONS.EVENT_SUBMIT} clubId="c1" fallback={<span>no submit</span>}>
            <button>Submit to OSI</button>
          </PermissionGate>
        </AuthProvider>
      </MemoryRouter>,
    );
  };
  it('hides "Submit to OSI" from a Media Lead', async () => {
    renderGate('MEDIA_LEAD');
    expect(await screen.findByText('no submit')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /submit to osi/i })).not.toBeInTheDocument();
  });
  it('shows "Submit to OSI" to the Leader', async () => {
    renderGate('LEADER');
    expect(await screen.findByRole('button', { name: /submit to osi/i })).toBeInTheDocument();
  });
});

describe('portal logins', () => {
  const loginVia = async (path, me, memberships = []) => {
    const user = makeUser({ platformRole: me });
    mockApi({
      'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }],
      'POST /auth/login': () => [200, { data: { accessToken: 'tok', user } }],
      'GET /me': () => [200, { data: { user, platformRole: me, memberships } }],
      'POST /auth/logout': () => [200, { data: {} }],
    });
    renderApp(path);
    await userEvent.type(await screen.findByLabelText(/username or email/i), 'someone');
    await userEvent.type(screen.getByLabelText(/^password$/i), 'whatever1');
    await userEvent.click(screen.getByRole('button', { name: /^log in$/i }));
  };

  it('the Administrator login refuses a student account', async () => {
    await loginVia('/login?as=admin', 'student');
    expect(await screen.findByRole('alert')).toHaveTextContent(/student account/i);
  });

  it('the Student login refuses an administrator account', async () => {
    await loginVia('/login?as=student', 'osi_admin');
    expect(await screen.findByRole('alert')).toHaveTextContent(/Administrator login/i);
  });

  it('the Club Member login refuses a student who is in no club', async () => {
    await loginVia('/login?as=member', 'student', []);
    expect(await screen.findByRole('alert')).toHaveTextContent(/not a member of any club/i);
  });

  it('a club member on the Student login lands on the student side; on the Club Member login in the workspace', async () => {
    const m = [membership('c1', 'LEADER', 'Leader', DEFAULT_ROLE_PERMISSIONS.LEADER)];
    await loginVia('/login?as=student', 'student', m);
    expect(await screen.findByRole('heading', { name: 'Clubs', level: 1 })).toBeInTheDocument();
  });

  it('the Club Member login opens the club workspace', async () => {
    const m = [membership('c1', 'LEADER', 'Leader', DEFAULT_ROLE_PERMISSIONS.LEADER)];
    await loginVia('/login?as=member', 'student', m);
    expect(await screen.findByRole('heading', { name: 'Club c1', level: 1 })).toBeInTheDocument();
  });
});
