import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen, waitFor } from '@testing-library/react';

const mockNavigate = vi.fn();
const courseStoreInitMock = vi.hoisted(() => vi.fn(async () => undefined));
const getAllCoursesMock = vi.hoisted(() => vi.fn(() => []));
const learnerCatalogStateMock = { status: 'error' };
const adminCatalogStateMock = { phase: 'ready', adminLoadStatus: 'skipped' };

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

vi.mock('../../../hooks/useUserProfile', () => ({
  useUserProfile: () => ({
    user: { id: 'user-123', email: 'user@example.com' },
  }),
}));

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => ({
    sessionStatus: 'authenticated',
    orgResolutionStatus: 'ready',
  }),
}));

vi.mock('../../../store/courseStore', () => ({
  courseStore: {
    subscribe: () => () => {},
    getAdminCatalogState: () => adminCatalogStateMock,
    getLearnerCatalogState: () => learnerCatalogStateMock,
    getAllCourses: () => getAllCoursesMock(),
    init: courseStoreInitMock,
    forceInit: vi.fn(async () => undefined),
  },
}));

vi.mock('../../../utils/courseNormalization', () => ({
  normalizeCourse: <T,>(course: T) => course,
}));

vi.mock('../../../utils/courseProgress', () => ({
  syncCourseProgressWithRemote: vi.fn(async () => null),
  loadStoredCourseProgress: vi.fn(() => ({
    completedLessonIds: [],
    lessonProgress: {},
    lessonPositions: {},
  })),
  buildLearnerProgressSnapshot: vi.fn(() => ({ overallProgress: 0 })),
}));

vi.mock('../../../dal/sync', () => ({
  syncService: {
    subscribe: () => () => {},
  },
}));

vi.mock('../../../components/PerformanceComponents', () => ({
  LazyImage: (props: any) => <img {...props} />, 
  ImageSkeleton: (props: any) => <div {...props} />,
}));

vi.mock('../../../components/ui/Button', () => ({
  default: (props: any) => <button {...props} />,
}));

vi.mock('../../../components/ui/Card', () => ({
  default: (props: any) => <div {...props} />,
}));

vi.mock('../../../components/ui/Badge', () => ({
  default: (props: any) => <span {...props} />,
}));

vi.mock('../../../components/ui/Input', () => ({
  default: (props: any) => <input {...props} />,
}));

vi.mock('../../../components/ui/ProgressBar', () => ({
  default: (props: any) => <div role="progressbar" {...props} />,
}));

vi.mock('../../../components/ui/EmptyState', () => ({
  default: (props: any) => (
    <div>
      {props.title && <div>{props.title}</div>}
      {props.description && <div>{props.description}</div>}
      {props.action}
    </div>
  ),
}));

vi.mock('../../../components/ui/Skeleton', () => ({
  default: (props: any) => <div {...props} />,
}));

vi.mock('../../../components/ui/SectionHeading', () => ({
  default: (props: any) => <div {...props} />,
}));

vi.mock('../../../components/ui/Breadcrumbs', () => ({
  default: (props: any) => <nav {...props} />,
}));

import LMSCourses from '../LMSCourses';

describe('LMSCourses learner route behavior', () => {
  beforeEach(() => {
    mockNavigate.mockReset();
    courseStoreInitMock.mockReset();
    learnerCatalogStateMock.status = 'error';
    adminCatalogStateMock.phase = 'ready';
    getAllCoursesMock.mockReturnValue([]);
  });

  const renderLMSCourses = () =>
    render(
      <MemoryRouter initialEntries={['/lms/courses']}>
        <Routes>
          <Route path="/lms/courses" element={<LMSCourses />} />
        </Routes>
      </MemoryRouter>,
    );

  it('renders the learner reconnect empty state when learner catalog is in error', async () => {
    renderLMSCourses();
    expect(await screen.findByText("We're reconnecting to your catalog")).toBeInTheDocument();
  });

  it('initializes the course store when mounted from a deep-linked LMS route', async () => {
    learnerCatalogStateMock.status = 'idle';
    adminCatalogStateMock.phase = 'idle';
    renderLMSCourses();

    await waitFor(() => {
      expect(courseStoreInitMock).toHaveBeenCalled();
    });
  });
});
