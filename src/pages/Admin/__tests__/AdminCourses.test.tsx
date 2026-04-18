import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

const showToastMock = vi.fn();
const syncCourseToDatabaseMock = vi.fn();
const apiRequestRawMock = vi.fn();

const catalogState = {
  phase: 'ready',
  adminLoadStatus: 'error',
  lastError: 'Unable to fetch courses',
  lastAttemptAt: Date.now(),
};
const coursesState: any[] = [];

const courseStoreMock = {
  subscribe: () => () => {},
  getAdminCatalogState: () => catalogState,
  getAllCourses: () => coursesState,
  init: vi.fn(),
  forceInit: vi.fn(),
  saveCourse: vi.fn(),
};

vi.mock('../../../store/courseStore', () => ({
  courseStore: courseStoreMock,
}));

vi.mock('../../../dal/adminCourses', () => ({
  syncCourseToDatabase: (...args: any[]) => syncCourseToDatabaseMock(...args),
  CourseValidationError: class CourseValidationError extends Error {},
}));

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

vi.mock('../../../dal/sync', () => ({
  useSyncService: () => ({}),
}));

vi.mock('../../../utils/apiClient', () => ({
  apiRequestRaw: (...args: any[]) => apiRequestRawMock(...args),
}));

vi.mock('../../../utils/logAuthRedirect', () => ({
  logAuthRedirect: () => undefined,
}));

vi.mock('../../../hooks/useRouteChangeReset', () => ({
  useRouteChangeReset: () => ({ routeKey: 'courses-route-key' }),
}));

vi.mock('../../../hooks/useNavTrace', () => ({
  useNavTrace: () => undefined,
}));

vi.mock('../../../components/ui/Breadcrumbs', () => ({
  default: () => <div data-testid="breadcrumbs" />,
}));

vi.mock('../../../components/ui/Card', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/EmptyState', () => ({
  default: ({ title }: { title: string }) => <div data-testid="empty-state">{title}</div>,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../../../components/ui/Input', () => ({
  default: (props: React.InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

vi.mock('../../../components/ui/Loading', () => ({
  default: () => <div>Loading</div>,
}));

vi.mock('../../../components/Modal', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/LoadingButton', () => ({
  default: ({ children, onClick }: { children?: React.ReactNode; onClick?: () => void }) => (
    <button type="button" onClick={onClick}>{children}</button>
  ),
}));

vi.mock('../../../components/CourseEditModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/CourseAssignmentModal', () => ({
  default: () => null,
}));

vi.mock('../../../components/PerformanceComponents', () => ({
  LazyImage: () => null,
}));

describe('AdminCourses page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    catalogState.phase = 'ready';
    catalogState.adminLoadStatus = 'error';
    catalogState.lastError = 'Unable to fetch courses';
    coursesState.length = 0;
    window.history.pushState({}, '', '/admin/courses');
  });

  const renderPage = async () => {
    vi.resetModules();
    const AdminCourses = (await import('../AdminCourses')).default;

    return render(
      <MemoryRouter initialEntries={[{ pathname: '/admin/courses' }]}>
        <Routes>
          <Route path="/admin/courses" element={<AdminCourses />} />
          <Route path="/admin/dashboard" element={<div>Dashboard</div>} />
        </Routes>
      </MemoryRouter>,
    );
  };

  it('shows the error gate instead of the empty state when course loading fails', async () => {
    const screen = await renderPage();

    await waitFor(() => {
      expect(screen.getByText('We couldn’t load the admin catalog')).toBeTruthy();
    });
    expect(screen.queryByText('No courses yet')).toBeNull();
  });

  it('shows the true empty state only when the catalog response is empty', async () => {
    catalogState.adminLoadStatus = 'empty';
    catalogState.lastError = null;

    const screen = await renderPage();

    await waitFor(() => {
      expect(screen.getByText('No courses yet')).toBeTruthy();
    });
  });
});
