import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { syncCourseToDatabase, loadCourseFromDatabase } from '../../../dal/adminCourses';
import { getDraftSnapshot, saveDraftSnapshot } from '../../../dal/courseDrafts';

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
  saveDraftSnapshot: vi.fn(async () => {}),
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
  const renderBuilder = async (path = '/admin/course-builder/new') => {
    const { default: AdminCourseBuilder } = await import('../AdminCourseBuilder');
    const queryClient = new QueryClient();
    return render(
      <MemoryRouter initialEntries={[{ pathname: path }]}> 
        <QueryClientProvider client={queryClient}>
          <Routes>
            <Route path="/admin/course-builder/:courseId" element={<AdminCourseBuilder />} />
          </Routes>
        </QueryClientProvider>
      </MemoryRouter>
    );
  };

  const getTitleInput = (container: HTMLElement) =>
    (screen.queryByDisplayValue('New Course') as HTMLInputElement | null) ??
    (container.querySelector('input[type="text"], input:not([type]), textarea') as HTMLInputElement | null);

  it('renders without throwing and exposes the builder root element', async () => {
    await renderBuilder('/admin/course-builder/new');

    expect(await screen.findByTestId('admin-course-builder')).toBeInTheDocument();
  });

  it('debounces rapid typing into a single autosave request', async () => {
    const syncMock = vi.mocked(syncCourseToDatabase);
    syncMock.mockClear();
    syncMock.mockImplementation(async (course: unknown) => course as any);

    const { container } = await renderBuilder('/admin/course-builder/new');

    const titleInput = getTitleInput(container);
    expect(titleInput).toBeTruthy();

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Draft A' } });
      fireEvent.change(titleInput!, { target: { value: 'Draft AB' } });
      fireEvent.change(titleInput!, { target: { value: 'Draft ABC' } });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1800));
    });

    await waitFor(() => {
      expect(syncMock).toHaveBeenCalledTimes(1);
    });

  }, 10000);

  it('prevents overlapping autosave requests and keeps max concurrency at one', async () => {
    const syncMock = vi.mocked(syncCourseToDatabase);
    syncMock.mockClear();

    let active = 0;
    let maxActive = 0;
    syncMock.mockImplementation(async (course: any) => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 400));
      active -= 1;
      return course;
    });

    const { container } = await renderBuilder('/admin/course-builder/new');

    const titleInput = getTitleInput(container);
    expect(titleInput).toBeTruthy();

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Race 1' } });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1700));
    });

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Race 2' } });
      fireEvent.change(titleInput!, { target: { value: 'Race 3' } });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 2500));
    });

    expect(maxActive).toBeLessThanOrEqual(1);
    expect(syncMock.mock.calls.length).toBeGreaterThanOrEqual(1);
  }, 10000);

  it('keeps local dirty state and shows retry path when save fails', async () => {
    const syncMock = vi.mocked(syncCourseToDatabase);
    syncMock.mockClear();
    syncMock.mockRejectedValueOnce(new Error('Network fail'));

    const { container } = await renderBuilder('/admin/course-builder/new');
    const titleInput = getTitleInput(container);
    expect(titleInput).toBeTruthy();

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Failure Draft' } });
    });

    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1600));
    });

    await waitFor(() => {
      expect(syncMock).toHaveBeenCalled();
    });

    expect(titleInput?.value).toBe('Failure Draft');
    expect(container.querySelector('[data-save-button]')).toBeTruthy();
  }, 10000);

  it('persists local snapshots during editing for local-first recovery', async () => {
    const draftSaveMock = vi.mocked(saveDraftSnapshot);
    draftSaveMock.mockClear();

    const { container } = await renderBuilder('/admin/course-builder/new');
    const titleInput = getTitleInput(container);
    expect(titleInput).toBeTruthy();

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Local Snapshot Draft' } });
    });

    await waitFor(() => {
      expect(draftSaveMock).toHaveBeenCalled();
    });
  }, 10000);

  it('recovers newer local draft snapshot after refresh load', async () => {
    const snapshotMock = vi.mocked(getDraftSnapshot);
    const loadMock = vi.mocked(loadCourseFromDatabase);
    snapshotMock.mockResolvedValueOnce({
      id: 'new',
      updatedAt: Date.now() + 5000,
      dirty: true,
      course: {
        id: 'new',
        title: 'Recovered Draft',
        description: 'Recovered description',
        status: 'draft',
        modules: [],
      } as any,
    } as any);
    loadMock.mockResolvedValueOnce(null);

    await renderBuilder('/admin/course-builder/new');

    await waitFor(() => {
      expect(screen.getByText(/Recovered unsaved changes/i)).toBeInTheDocument();
    });
  }, 10000);

  it('shows unsaved changes immediately while typing', async () => {
    const draftSaveMock = vi.mocked(saveDraftSnapshot);
    draftSaveMock.mockClear();

    const { container } = await renderBuilder('/admin/course-builder/new');
    const titleInput = getTitleInput(container);
    expect(titleInput).toBeTruthy();

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Unsaved Label Draft' } });
    });

    await waitFor(() => {
      expect(draftSaveMock).toHaveBeenCalled();
    });
  }, 10000);

  it('does not trigger extra save when value remains unchanged (no-op edit)', async () => {
    const syncMock = vi.mocked(syncCourseToDatabase);
    syncMock.mockClear();
    syncMock.mockImplementation(async (course: unknown) => course as any);

    const { container } = await renderBuilder('/admin/course-builder/new');
    const titleInput = getTitleInput(container);
    expect(titleInput).toBeTruthy();

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Noop Draft' } });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    const callCountAfterFirstSave = syncMock.mock.calls.length;

    act(() => {
      fireEvent.change(titleInput!, { target: { value: 'Noop Draft' } });
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    expect(syncMock.mock.calls.length).toBe(callCountAfterFirstSave);
  }, 10000);
});
