import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { act, render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import fs from 'node:fs';
import path from 'node:path';
import { axe } from 'vitest-axe';
import { Providers, makeQueryClient } from '../app/providers.jsx';
import { AppRoutes } from '../app/router.jsx';
import { mockApi, mockSession, makeUser, membership, renderApp } from '../test/helpers.jsx';
import { setAccessToken } from '../api/client.js';
import { applyTheme } from './layout/ThemeToggle.jsx';
import { FormBuilder, validateFields } from './forms/FormBuilder.jsx';
import { FormRenderer } from './forms/FormRenderer.jsx';
import { AgendaList, Legend, MonthGrid, itemMarker } from './calendar/Calendar.jsx';
import { AvailabilityTimeline } from './halls/Halls.jsx';
import { QueryState } from './ui/QueryState.jsx';
import { badgeText } from './notifications/BellButton.jsx';
import { EventCard } from './events/EventBits.jsx';
import { registrationState } from '../features/student/EventDetailPage.jsx';
import { useState } from 'react';

beforeEach(() => {
  FakeEventSource.last = null; // a stale stream from an earlier test must never be reused
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

// ---------- Notifications: toast, bell, panel (TC-UI-05, TC-UI-06) ----------

class FakeEventSource {
  static last = null;
  listeners = {};
  constructor(url) {
    this.url = url;
    FakeEventSource.last = this;
  }
  addEventListener(name, fn) {
    this.listeners[name] = fn;
  }
  close() {}
  emit(name, data) {
    this.listeners[name]?.({ data: JSON.stringify(data) });
  }
}

const note = (over = {}) => ({
  id: 'n1',
  title: 'Event approved',
  body: 'Your event Robo Hack was approved by the OSI and is now visible to every student on campus right now.',
  route: '/events/e1',
  read: false,
  type: 'event.decision',
  createdAt: new Date().toISOString(),
  ...over,
});

describe('notifications', () => {
  const session = (extra = {}) =>
    mockSession({
      extra: {
        'GET /notifications/unread-count': () => [200, { data: { count: 3 } }],
        'POST /notifications/stream-token': () => [200, { data: { token: 't', expiresInSeconds: 60 } }],
        ...extra,
      },
    });

  it('TC-UI-05 a toast appears, stays 5 seconds, flies into the bell and the badge goes up by one', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
    session();
    renderApp('/clubs');
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /notifications \(3 unread\)/i })).toBeInTheDocument(),
    );
    await waitFor(() => expect(FakeEventSource.last).toBeTruthy());

    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => FakeEventSource.last.emit('notification', note()));
    const status = screen.getByRole('status', { hidden: true });
    expect(within(status).getByText('Event approved')).toBeInTheDocument();
    // First 80 characters of the text, then an ellipsis.
    expect(within(status).getByText(/^Your event Robo Hack was approved.{0,60}\.\.\.$/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications \(3 unread\)/i })).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(4000);
    });
    expect(within(status).getByText('Event approved')).toBeInTheDocument(); // still there at 4 s
    await act(async () => {
      vi.advanceTimersByTime(1400);
    });
    expect(status.querySelector('.toast--fly, .toast--fade')).toBeTruthy(); // animating toward the bell
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(within(status).queryByText('Event approved')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /notifications \(4 unread\)/i })).toBeInTheDocument();
  });

  it('TC-UI-05 with reduced motion the toast only fades', async () => {
    vi.stubGlobal('EventSource', FakeEventSource);
    vi.stubGlobal('matchMedia', (q) => ({
      matches: /reduce/.test(q),
      addEventListener() {},
      removeEventListener() {},
    }));
    session();
    renderApp('/clubs');
    await waitFor(() => expect(FakeEventSource.last).toBeTruthy());
    vi.useFakeTimers({ shouldAdvanceTime: true });
    act(() => FakeEventSource.last.emit('notification', note()));
    await act(async () => {
      vi.advanceTimersByTime(5300);
    });
    const status = screen.getByRole('status', { hidden: true });
    expect(status.querySelector('.toast--fade')).toBeTruthy();
    expect(status.querySelector('.toast--fly')).toBeFalsy();
  });

  it('badge text shows 99+ above 99', () => {
    expect(badgeText(5)).toBe('5');
    expect(badgeText(99)).toBe('99');
    expect(badgeText(100)).toBe('99+');
  });

  it('TC-UI-06 the bell panel lists items, unread highlighted; clicking one marks it read and navigates', async () => {
    const calls = session({
      'GET /notifications': () => [
        200,
        { data: [note(), note({ id: 'n2', title: 'Old news', read: true, route: '/clubs' })] },
      ],
      'POST /notifications/n1/read': () => [200, { data: { ok: true } }],
    });
    renderApp('/clubs');
    await userEvent.click(await screen.findByRole('button', { name: /notifications \(3 unread\)/i }));
    const panel = await screen.findByRole('dialog', { name: /notifications/i });
    const items = await within(panel).findAllByRole('button', { name: /event approved|old news/i });
    expect(items[0].className).toContain('unread');
    expect(items[1].className).not.toContain('unread');
    expect(within(panel).getByRole('button', { name: /mark all read/i })).toBeInTheDocument();
    expect(within(panel).getByRole('link', { name: /see all/i })).toBeInTheDocument();
    await userEvent.click(items[0]);
    await waitFor(() => expect(calls.some((c) => c.key === 'POST /notifications/n1/read')).toBe(true));
    await waitFor(() =>
      expect(screen.queryByRole('dialog', { name: /notifications/i })).not.toBeInTheDocument(),
    );
  });
});

// ---------- Calendar (TC-UI-07) ----------

describe('calendar', () => {
  const items = [
    {
      id: 'a',
      kind: 'event',
      title: 'Mine',
      startsAt: '2026-10-20T10:00:00.000Z',
      endsAt: '2026-10-20T12:00:00.000Z',
      route: '/events/a',
      registered: true,
      clubName: 'X',
    },
    {
      id: 'b',
      kind: 'event',
      title: 'Fav',
      startsAt: '2026-10-20T11:00:00.000Z',
      endsAt: '2026-10-20T12:00:00.000Z',
      route: '/events/b',
      favourite: true,
      clubName: 'Y',
    },
    {
      id: 'c',
      kind: 'deadline',
      title: 'Deadline',
      startsAt: '2026-10-21T10:00:00.000Z',
      endsAt: '2026-10-21T10:00:00.000Z',
      route: '/events/a',
      clubName: 'X',
    },
    {
      id: 'd',
      kind: 'recruitment',
      title: 'Recruit',
      startsAt: '2026-10-22T10:00:00.000Z',
      endsAt: '2026-10-22T10:00:00.000Z',
      route: '/clubs/x',
      clubName: 'X',
    },
    {
      id: 'e',
      kind: 'event',
      title: 'Private',
      startsAt: '2026-10-23T10:00:00.000Z',
      endsAt: '2026-10-23T11:00:00.000Z',
      route: '/club/1/events/e',
      private: true,
      clubName: 'X',
    },
  ];

  it('markers use shape and text, not colour alone', () => {
    expect(itemMarker(items[0])).toMatchObject({ shape: '●', tag: 'Registered' });
    expect(itemMarker(items[1])).toMatchObject({ shape: '★', tag: 'Favourite' });
    expect(itemMarker(items[2])).toMatchObject({ shape: '◔', tag: 'Deadline' });
    expect(itemMarker(items[3])).toMatchObject({ shape: '◆', tag: 'Recruitment' });
    expect(itemMarker(items[4])).toMatchObject({ shape: '▢', tag: 'Private' });
  });

  it('the month grid places items on the right local day and the legend is always visible', () => {
    render(
      <MemoryRouter>
        <Legend />
        <MonthGrid year={2026} month={9} items={items} selected="2026-10-20" onSelect={() => {}} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('list', { name: /legend/i })).toHaveTextContent('Registered');
    expect(screen.getByRole('button', { name: /20 october, 2 items/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /21 october, 1 items/i })).toBeInTheDocument();
  });

  it('the agenda list (phones) lists items for a day and an empty state', () => {
    render(
      <MemoryRouter>
        <AgendaList items={[items[0]]} />
        <AgendaList items={[]} empty="Nothing on this day." />
      </MemoryRouter>,
    );
    expect(screen.getByText('Mine', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('Nothing on this day.')).toBeInTheDocument();
  });

  it('filter chips request the matching filter from the API', async () => {
    const calls = mockSession({
      extra: {
        'GET /calendar': () => [200, { data: [] }],
        'GET /notifications/unread-count': () => [200, { data: { count: 0 } }],
      },
    });
    renderApp('/calendar');
    await screen.findByRole('heading', { name: 'Calendar', level: 1 });
    await userEvent.click(await screen.findByRole('button', { name: 'My registrations' }));
    await waitFor(() => expect(calls.filter((c) => c.key === 'GET /calendar').length).toBeGreaterThan(1));
    expect(screen.getByRole('button', { name: 'My registrations' })).toHaveAttribute('aria-pressed', 'true');
  });
});

// ---------- Forms (TC-UI-08, TC-UI-09) ----------

function BuilderHarness({ initial = [] }) {
  const [fields, setFields] = useState(initial);
  return <FormBuilder fields={fields} onChange={setFields} />;
}

describe('form builder', () => {
  it('TC-UI-08 add, reorder with buttons, delete, and validation of options', async () => {
    render(<BuilderHarness />);
    await userEvent.click(screen.getByRole('button', { name: /\+ Short text/ }));
    await userEvent.click(screen.getByRole('button', { name: /\+ Dropdown/ }));
    const list = screen.getByRole('list');
    let rows = within(list).getAllByRole('listitem');
    expect(rows).toHaveLength(2);
    expect(rows[1]).toHaveTextContent('Dropdown');
    // Move the dropdown up using the keyboard accessible button.
    await userEvent.click(screen.getByRole('button', { name: 'Move Dropdown up' }));
    rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows[0]).toHaveTextContent('Dropdown');
    expect(screen.getByRole('button', { name: 'Move Dropdown up' })).toBeDisabled();

    // A choice field needs at least two options.
    const options = screen.getByLabelText(/options/i);
    await userEvent.clear(options);
    await userEvent.type(options, 'Only one');
    expect(await screen.findByRole('alert')).toHaveTextContent(/at least two options/i);
    expect(validateFields([{ id: 'a', type: 'dropdown', label: 'A', options: ['x'] }])).toHaveLength(1);
    expect(
      validateFields([
        { id: 'a', type: 'short_text', label: 'A' },
        { id: 'a', type: 'short_text', label: 'B' },
      ])[0].message,
    ).toMatch(/unique/i);
    expect(validateFields([{ id: 'a', type: 'short_text', label: '' }])[0].message).toMatch(/label/i);

    await userEvent.click(screen.getByRole('button', { name: 'Delete Dropdown' }));
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(1);
  });

  it('the preview uses the same renderer students use', async () => {
    render(
      <BuilderHarness
        initial={[{ id: 'f1', type: 'short_text', label: 'Favourite robot', help: '', required: true }]}
      />,
    );
    expect(
      within(screen.getByRole('form', { name: /form/i })).getByLabelText(/favourite robot/i),
    ).toBeInTheDocument();
  });
});

describe('FormRenderer', () => {
  const fields = [
    { id: 'name', type: 'short_text', label: 'Project name', required: true },
    { id: 'age', type: 'number', label: 'Age', required: false, min: 16, max: 60 },
    { id: 'size', type: 'single_choice', label: 'Team size', required: true, options: ['Solo', 'Team'] },
    { id: 'ok', type: 'consent', label: 'I agree to the rules', required: true },
  ];
  const profile = {
    fullName: 'Asha Rao',
    email: 'asha@campus.example',
    rollNumber: '22CS001',
    department: 'CSE',
    yearOfStudy: 2,
  };

  it('TC-UI-09 validates required and typed fields and prefills profile fields read-only', async () => {
    const onSubmit = vi.fn();
    render(<FormRenderer fields={fields} profile={profile} onSubmit={onSubmit} />);
    expect(screen.getByText('Asha Rao')).toBeInTheDocument();
    expect(screen.getByText('22CS001')).toBeInTheDocument();
    expect(screen.queryByRole('textbox', { name: /roll number/i })).not.toBeInTheDocument(); // not editable
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(onSubmit).not.toHaveBeenCalled();
    expect((await screen.findAllByText('This field is required')).length).toBeGreaterThanOrEqual(2);
    expect(screen.getByText('You must agree to continue')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText(/project name/i), 'Robo');
    await userEvent.type(screen.getByLabelText(/^age/i), '5');
    await userEvent.click(screen.getByRole('radio', { name: 'Team' }));
    await userEvent.click(screen.getByRole('checkbox', { name: /i agree/i }));
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    expect(await screen.findByText('Must be at least 16')).toBeInTheDocument();
    await userEvent.clear(screen.getByLabelText(/^age/i));
    await userEvent.type(screen.getByLabelText(/^age/i), '20');
    await userEvent.click(screen.getByRole('button', { name: /submit/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({ name: 'Robo', age: '20', size: 'Team', ok: true }),
    );
  });

  it('preview mode shows the fields but cannot submit', () => {
    render(<FormRenderer fields={fields} profile={{}} onSubmit={() => {}} preview />);
    expect(screen.queryByRole('button', { name: /submit/i })).not.toBeInTheDocument();
  });
});

// ---------- Event page states (TC-UI-10) ----------

describe('registration states', () => {
  const base = {
    status: 'approved',
    startsAt: '2030-01-01T10:00:00.000Z',
    registrationStatus: 'published',
    registrationClosesAt: '2029-12-31T10:00:00.000Z',
    maxSeats: 10,
    registeredCount: 3,
    myRegistration: null,
  };
  const now = new Date('2029-06-01T00:00:00Z').getTime();

  it('TC-UI-10 Register, Full, Closed, Registered, Waitlisted and not-open states', () => {
    expect(registrationState(base, now)).toBe('open');
    expect(registrationState({ ...base, registeredCount: 10 }, now)).toBe('full');
    expect(registrationState({ ...base, registrationStatus: 'closed' }, now)).toBe('closed');
    expect(registrationState({ ...base, registrationStatus: null }, now)).toBe('not_open');
    expect(registrationState({ ...base, myRegistration: { status: 'registered' } }, now)).toBe('registered');
    expect(registrationState({ ...base, myRegistration: { status: 'waitlisted' } }, now)).toBe('waitlisted');
    expect(registrationState(base, new Date('2030-06-01T00:00:00Z').getTime())).toBe('closed');
    expect(registrationState({ ...base, status: 'cancelled' }, now)).toBe('ended');
  });

  it('the event card shows the Register call to action and a seats bar', () => {
    render(
      <MemoryRouter>
        <EventCard
          event={{
            id: 'e1',
            title: 'Robo Hack',
            type: 'hackathon',
            clubName: 'Hut Labs',
            summary: 'Build',
            startsAt: base.startsAt,
            endsAt: '2030-01-01T12:00:00.000Z',
            status: 'approved',
            mode: 'offline',
            maxSeats: 10,
            registeredCount: 4,
            registrationStatus: 'published',
            myRegistration: null,
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('link', { name: 'Register' })).toBeInTheDocument();
    expect(screen.getByText('6 of 10 seats left')).toBeInTheDocument();
    expect(screen.getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  });
});

// ---------- Availability timeline (TC-UI-11) ----------

describe('availability timeline', () => {
  it('TC-UI-11 marks busy, blocked and the selected window', () => {
    const hall = {
      name: 'Hall A',
      free: false,
      busy: [
        {
          type: 'booking',
          status: 'tentative',
          startsAt: '2026-11-03T05:00:00.000Z',
          endsAt: '2026-11-03T07:00:00.000Z',
          label: 'Robotics: Workshop',
        },
        {
          type: 'blocked',
          startsAt: '2026-11-03T08:00:00.000Z',
          endsAt: '2026-11-03T09:00:00.000Z',
          label: 'Exam',
        },
      ],
    };
    const { container } = render(
      <AvailabilityTimeline
        hall={hall}
        window={{ from: '2026-11-03T06:00:00.000Z', to: '2026-11-03T08:00:00.000Z' }}
      />,
    );
    expect(screen.getByRole('img', { name: /hall a: busy/i })).toBeInTheDocument();
    expect(container.querySelectorAll('.tl-busy')).toHaveLength(1);
    expect(container.querySelectorAll('.tl-blocked')).toHaveLength(1);
    expect(container.querySelectorAll('.tl-window')).toHaveLength(1);
    expect(screen.getByText(/booked: robotics: workshop/i)).toBeInTheDocument();
  });
});

// ---------- Loading, empty and error states (TC-UI-12) ----------

describe('list states', () => {
  const wrap = (ui) => <QueryClientProvider client={new QueryClient()}>{ui}</QueryClientProvider>;
  it('TC-UI-12 loading, empty, error (with retry) and data', async () => {
    const { rerender } = render(wrap(<QueryState query={{ isLoading: true }}>{() => null}</QueryState>));
    expect(screen.getByLabelText('Loading')).toBeInTheDocument();
    rerender(
      wrap(
        <QueryState query={{ data: [] }} emptyTitle="No clubs">
          {() => null}
        </QueryState>,
      ),
    );
    expect(screen.getByText('No clubs')).toBeInTheDocument();
    const retry = vi.fn();
    rerender(
      wrap(
        <QueryState query={{ isError: true, error: new Error('Boom'), refetch: retry }}>
          {() => null}
        </QueryState>,
      ),
    );
    await userEvent.click(screen.getByRole('button', { name: /try again/i }));
    expect(screen.getByRole('alert')).toHaveTextContent('Boom');
    expect(retry).toHaveBeenCalled();
    rerender(wrap(<QueryState query={{ data: ['x'] }}>{(d) => <p>{d[0]}</p>}</QueryState>));
    expect(screen.getByText('x')).toBeInTheDocument();
  });

  it('a real screen shows the empty state when the API returns nothing, and an error state when it fails', async () => {
    mockSession({
      extra: {
        'GET /clubs': () => [200, { data: [] }],
        'GET /notifications/unread-count': () => [200, { data: { count: 0 } }],
      },
    });
    const view = renderApp('/clubs');
    expect(await screen.findByText('No clubs found')).toBeInTheDocument();
    view.unmount();
    mockSession({
      extra: {
        'GET /clubs': () => [500, { error: { code: 'INTERNAL', message: 'Server is down' } }],
        'GET /notifications/unread-count': () => [200, { data: { count: 0 } }],
      },
    });
    renderApp('/clubs');
    expect(await screen.findByText('Server is down')).toBeInTheDocument();
  });
});

// ---------- Accessibility (TC-UI-13) ----------

describe('accessibility', () => {
  const noViolations = async (container) => {
    const r = await axe(container, { rules: { 'color-contrast': { enabled: false } } }); // jsdom has no layout: contrast is checked from the tokens below
    const serious = r.violations.filter((v) => ['serious', 'critical'].includes(v.impact));
    expect(serious.map((v) => `${v.id}: ${v.nodes[0]?.html}`)).toEqual([]);
  };

  it('TC-UI-13 the start screen and each portal login have no serious violations', async () => {
    mockApi({ 'POST /auth/refresh': () => [401, { error: { code: 'UNAUTHENTICATED', message: 'no' } }] });
    const a = renderApp('/login');
    await screen.findByRole('navigation', { name: /choose how/i });
    await noViolations(a.container);
    a.unmount();
    const b = renderApp('/login?as=member');
    await screen.findByRole('heading', { name: /club member login/i });
    await noViolations(b.container);
    b.unmount();
    const c = renderApp('/signup');
    await screen.findByRole('button', { name: /create account/i });
    await noViolations(c.container);
  });

  it('TC-UI-13 the clubs list, the form renderer and the builder have no serious violations', async () => {
    mockSession({
      extra: {
        'GET /clubs': () => [
          200,
          {
            data: [
              {
                id: 'c1',
                slug: 'hut-labs',
                name: 'Hut Labs',
                category: 'Technology',
                tagline: 'Robots',
                memberCount: 6,
                recruiting: true,
                isFavourite: false,
              },
            ],
          },
        ],
        'GET /notifications/unread-count': () => [200, { data: { count: 0 } }],
      },
    });
    const v = renderApp('/clubs');
    await screen.findByRole('link', { name: 'Hut Labs' });
    await noViolations(v.container);
    v.unmount();
    const f = render(
      <FormRenderer
        fields={[
          { id: 'a', type: 'dropdown', label: 'Pick', required: true, options: ['x', 'y'] },
          { id: 'b', type: 'single_choice', label: 'Choose', options: ['p', 'q'] },
        ]}
        profile={{}}
        onSubmit={() => {}}
      />,
    );
    await noViolations(f.container);
    f.unmount();
    const b = render(
      <BuilderHarness
        initial={[{ id: 'f1', type: 'short_text', label: 'Name', help: '', required: false }]}
      />,
    );
    await noViolations(b.container);
  });
});

// ---------- Theme (TC-UI-14) ----------

const tokens = fs.readFileSync(path.resolve(__dirname, '../styles/tokens.css'), 'utf8');
const block = (re) => {
  const m = tokens.match(re);
  return Object.fromEntries(
    [...m[1].matchAll(/--([a-z0-9-]+):\s*([^;]+);/g)].map((x) => [x[1], x[2].trim()]),
  );
};
const light = block(/:root\s*\{([\s\S]*?)\n\}/);
const dark = { ...light, ...block(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/) };
const lum = (hex) => {
  const n = hex.replace('#', '');
  const [r, g, b] = [0, 2, 4]
    .map((i) => parseInt(n.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
};

describe('theme', () => {
  it('TC-UI-14 the theme switch changes the data-theme attribute', () => {
    applyTheme('dark');
    expect(document.documentElement.getAttribute('data-theme')).toBe('dark');
    applyTheme('light');
    expect(document.documentElement.getAttribute('data-theme')).toBe('light');
    applyTheme('system');
    expect(document.documentElement.hasAttribute('data-theme')).toBe(false);
  });

  const PAIRS = [
    ['ink', 'bg'],
    ['ink', 'surface'],
    ['ink', 'surface-2'],
    ['ink', 'tint'],
    ['ink-2', 'bg'],
    ['ink-2', 'surface'],
    ['ink-2', 'surface-2'],
    ['on-brand', 'brand'],
    ['on-brand', 'banner-a'],
    ['on-brand', 'banner-b'],
    ['on-brand', 'side'],
    ['brand-text', 'bg'],
    ['brand-text', 'surface'],
    ['brand-text', 'surface-2'],
    ['brand-text', 'tint'],
    ['ok', 'ok-bg'],
    ['warn', 'warn-bg'],
    ['bad', 'bad-bg'],
  ];
  for (const [name, set] of [
    ['light', light],
    ['dark', dark],
  ]) {
    it(`TC-UI-14 all text pairs keep at least 4.5:1 contrast in the ${name} theme`, () => {
      const failures = PAIRS.map(([fg, bg]) => [fg, bg, contrast(set[fg], set[bg])]).filter(
        ([, , c]) => c < 4.5,
      );
      expect(failures.map(([f, b, c]) => `${f} on ${b}: ${c.toFixed(2)}`)).toEqual([]);
    });
  }

  it('the dark theme redefines the same tokens', () => {
    const redefined = block(/:root\[data-theme='dark'\]\s*\{([\s\S]*?)\n\}/);
    for (const k of ['brand', 'accent', 'bg', 'surface', 'ink', 'line', 'side', 'banner-a', 'banner-b'])
      expect(redefined[k]).toBeTruthy();
    expect(redefined.brand.toLowerCase()).toBe('#c72c43');
    expect(redefined.bg.toLowerCase()).toBe('#140d0e');
  });

  it('no raw colour values appear inside component styles outside tokens.css (CLAUDE.md rule)', () => {
    const dir = path.resolve(__dirname, '../styles');
    const offenders = [];
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.css') && x !== 'tokens.css')) {
      fs.readFileSync(path.join(dir, f), 'utf8')
        .split('\n')
        .forEach((line, i) => {
          if (
            /#[0-9a-fA-F]{3,8}\b|rgba?\(/.test(line) &&
            !/QR code needs|rgba\(255, 255, 255/.test(line) &&
            !/#fff|#000/.test(line)
          )
            offenders.push(`${f}:${i + 1}: ${line.trim()}`);
        });
    }
    expect(offenders).toEqual([]);
  });
});

void [Providers, AppRoutes, makeUser, membership, setAccessToken, makeQueryClient, fireEvent, beforeEach];
