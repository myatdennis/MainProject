import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ClientNotificationBell from '../ClientNotificationBell';

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const {
  listLearnerNotificationsMock,
  markLearnerNotificationReadMock,
  syncSubscribers,
  wsHandlers,
  wsOnMock,
  wsOffMock,
  wsConnectMock,
  navigateMock,
} = vi.hoisted(() => {
  const syncSubscribers = new Map<string, Array<() => void>>();
  const wsHandlers = new Map<string, Array<(payload: unknown) => void>>();

  return {
    listLearnerNotificationsMock: vi.fn(async () => []),
    markLearnerNotificationReadMock: vi.fn(async () => ({})),
    syncSubscribers,
    wsHandlers,
    wsOnMock: vi.fn((event: string, callback: (payload: unknown) => void) => {
      const list = wsHandlers.get(event) ?? [];
      wsHandlers.set(event, [...list, callback]);
    }),
    wsOffMock: vi.fn((event: string, callback: (payload: unknown) => void) => {
      const list = wsHandlers.get(event) ?? [];
      wsHandlers.set(
        event,
        list.filter((entry) => entry !== callback),
      );
    }),
    wsConnectMock: vi.fn(),
    navigateMock: vi.fn(),
  };
});

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => navigateMock,
  };
});

vi.mock('../../../dal/notifications', () => ({
  listLearnerNotifications: listLearnerNotificationsMock,
  markLearnerNotificationRead: markLearnerNotificationReadMock,
}));

vi.mock('../../../dal/sync', () => ({
  syncService: {
    subscribe: (eventType: string, callback: () => void) => {
      const list = syncSubscribers.get(eventType) ?? [];
      syncSubscribers.set(eventType, [...list, callback]);
      return () => {
        const current = syncSubscribers.get(eventType) ?? [];
        syncSubscribers.set(
          eventType,
          current.filter((entry) => entry !== callback),
        );
      };
    },
  },
}));

vi.mock('../../../dal/wsClient', () => ({
  wsClient: {
    on: (event: string, callback: (payload: unknown) => void) => wsOnMock(event, callback),
    off: (event: string, callback: (payload: unknown) => void) => wsOffMock(event, callback),
    connect: () => wsConnectMock(),
    isEnabled: () => true,
  },
}));

describe('ClientNotificationBell', () => {
  beforeEach(() => {
    listLearnerNotificationsMock.mockReset();
    markLearnerNotificationReadMock.mockReset();
    syncSubscribers.clear();
    wsHandlers.clear();
    wsOnMock.mockClear();
    wsOffMock.mockClear();
    wsConnectMock.mockClear();
  navigateMock.mockClear();

    listLearnerNotificationsMock.mockResolvedValue([
      {
        id: 'n-1',
        title: 'Assigned: Foundations',
        type: 'course_assignment',
        read: false,
        createdAt: new Date().toISOString(),
      },
    ] as any);
  });

  it('renders unread badge from fetched learner notifications', async () => {
    render(<ClientNotificationBell />);

    await waitFor(() => {
      expect(listLearnerNotificationsMock).toHaveBeenCalled();
    });

    expect(screen.getByText('1')).toBeInTheDocument();
  });

  it('refreshes notifications when assignment sync events arrive', async () => {
    render(<ClientNotificationBell />);

    await waitFor(() => {
      expect(listLearnerNotificationsMock).toHaveBeenCalledTimes(1);
    });

    const assignmentCreatedCallbacks = syncSubscribers.get('assignment_created') ?? [];
    expect(assignmentCreatedCallbacks.length).toBeGreaterThan(0);

    await act(async () => {
      assignmentCreatedCallbacks.forEach((callback) => callback());
      await wait(350);
    });

    await waitFor(() => {
      expect(listLearnerNotificationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('refreshes notifications when websocket message_sent event is received', async () => {
    render(<ClientNotificationBell />);

    await waitFor(() => {
      expect(listLearnerNotificationsMock).toHaveBeenCalledTimes(1);
    });

    const eventCallbacks = wsHandlers.get('event') ?? [];
    expect(eventCallbacks.length).toBeGreaterThan(0);

    await act(async () => {
      eventCallbacks.forEach((callback) => callback({ type: 'message_sent' }));
      await wait(350);
    });

    await waitFor(() => {
      expect(listLearnerNotificationsMock).toHaveBeenCalledTimes(2);
    });
  });

  it('marks as read and navigates to assignment action URL when present', async () => {
    listLearnerNotificationsMock.mockResolvedValue([
      {
        id: 'n-2',
        title: 'New survey assigned',
        type: 'survey_assignment',
        read: false,
        createdAt: new Date().toISOString(),
        metadata: { actionUrl: '/client/surveys?assignment=a-1&focus=s-1' },
      },
    ] as any);

    const user = userEvent.setup();
    render(<ClientNotificationBell />);

    await waitFor(() => {
      expect(listLearnerNotificationsMock).toHaveBeenCalled();
    });

    await user.click(screen.getByLabelText('Notifications'));
    await user.click(screen.getByText('New survey assigned'));

    await waitFor(() => {
      expect(markLearnerNotificationReadMock).toHaveBeenCalledWith('n-2');
      expect(navigateMock).toHaveBeenCalledWith('/client/surveys?assignment=a-1&focus=s-1');
    });
  });
});
