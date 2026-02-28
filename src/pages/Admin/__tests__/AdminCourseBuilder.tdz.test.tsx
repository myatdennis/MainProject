import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

vi.mock('../../../store/courseStore', () => {
  const mockCourseStore = {
    getCourse: vi.fn(() => null),
    saveCourse: vi.fn(),
    deleteCourse: vi.fn(),
  };

  return {
    courseStore: mockCourseStore,
    generateId: (prefix: string = 'id') => `${prefix}-test`,
    calculateCourseDuration: () => '5 min',
    countTotalLessons: () => 0,
    createModuleId: () => 'module-test',
    createLessonId: () => 'lesson-test',
    sanitizeModuleGraph: (course: unknown) => course,
  };
});

vi.mock('../../../dal/adminCourses', () => {
  class CourseValidationError extends Error {
    issues: unknown[];
    constructor(message = 'invalid', issues: unknown[] = []) {
      super(message);
      this.issues = issues;
    }
  }
  return {
    syncCourseToDatabase: vi.fn(async (course: unknown) => course),
    loadCourseFromDatabase: vi.fn(async () => null),
    adminPublishCourse: vi.fn(async () => ({ status: 'ok' })),
    CourseValidationError,
  };
});

vi.mock('../../../context/SecureAuthContext', () => ({
  useSecureAuth: () => ({
    activeOrgId: 'org-test',
    user: { id: 'user-1', email: 'admin@example.com' },
  }),
}));

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../../hooks/useRuntimeStatus', () => ({
  default: () => ({
    supabaseConfigured: true,
    supabaseHealthy: true,
    lastChecked: Date.now(),
    apiReachable: true,
    apiAuthRequired: false,
    apiHealthy: true,
    demoModeEnabled: false,
    lastError: null,
    statusLabel: 'ok',
  }),
}));

vi.mock('../../../hooks/useIsMobile', () => ({
  default: () => false,
}));

vi.mock('../../../hooks/useSwipeNavigation', () => ({
  default: () => ({}),
}));

vi.mock('../../../dal/courseDrafts', () => ({
  getDraftSnapshot: vi.fn(async () => null),
  deleteDraftSnapshot: vi.fn(async () => {}),
  markDraftSynced: vi.fn(async () => {}),
}));

vi.mock('../../../utils/runtimeGating', () => ({
  evaluateRuntimeGate: () => ({ mode: 'remote', reason: null, tone: 'info' }),
}));

vi.mock('../../../utils/idempotency', () => ({
  createActionIdentifiers: () => ({ requestId: 'req', actionId: 'act' }),
}));

vi.mock('../../../dal/media', () => ({
  uploadLessonVideo: vi.fn(async () => ({ url: 'https://example.com/video.mp4' })),
  uploadDocumentResource: vi.fn(async () => ({ url: 'https://example.com/doc.pdf' })),
}));

vi.mock('../../../components/CourseAssignmentModal', () => ({
  default: () => <div data-testid="CourseAssignmentModal" />,
}));

vi.mock('../../../components/LivePreview', () => ({
  default: () => <div data-testid="LivePreview" />,
}));

vi.mock('../../../components/preview/CoursePreviewDock', () => ({
  default: () => <div data-testid="CoursePreviewDock" />,
}));

vi.mock('../../../components/AIContentAssistant', () => ({
  default: () => <div data-testid="AIContentAssistant" />,
}));

vi.mock('../../../components/Admin/MobileCourseToolbar', () => ({
  default: () => <div data-testid="MobileCourseToolbar" />,
}));

vi.mock('../../../components/Admin/MobileModuleNavigator', () => ({
  default: () => <div data-testid="MobileModuleNavigator" />,
}));

vi.mock('../../../components/SortableItem', () => ({
  default: ({ children }: { children?: React.ReactNode }) => <div data-testid="SortableItem">{children}</div>,
}));

vi.mock('../../../components/VersionControl', () => ({
  default: () => <div data-testid="VersionControl" />,
}));

vi.mock('../../../components/Admin/ValidationIssueIndicators', () => ({
  ModuleIssueBadge: () => <span data-testid="module-issue" />,
  LessonIssueTag: () => <span data-testid="lesson-issue" />,
}));

describe('AdminCourseBuilder', () => {
  it('renders without throwing and exposes the builder root element', async () => {
    const { default: AdminCourseBuilder } = await import('../AdminCourseBuilder');

    render(
      <MemoryRouter initialEntries={[{ pathname: '/admin/course-builder/new' }]}>
        <Routes>
          <Route path="/admin/course-builder/:courseId" element={<AdminCourseBuilder />} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByTestId('admin-course-builder')).toBeInTheDocument();
  });
});
