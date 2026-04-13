import { describe, expect, it, vi } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { render, screen } from '@testing-library/react';
import AdminCourseBulkPlaceholder from '../AdminCourseBulkPlaceholder';

const showToastMock = vi.fn();

vi.mock('../../../../context/ToastContext', () => ({
  useToast: () => ({
    showToast: showToastMock,
  }),
}));

describe('AdminCourseBulkPlaceholder', () => {
  it('renders a production-safe fallback instead of a coming-soon dead end', () => {
    render(
      <MemoryRouter initialEntries={['/admin/courses/bulk?ids=course-1,course-2']}>
        <Routes>
          <Route path="/admin/courses/bulk" element={<AdminCourseBulkPlaceholder />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByText(/Bulk Assignment Unavailable/i)).toBeInTheDocument();
    expect(screen.getByText(/intentionally disabled in production/i)).toBeInTheDocument();
    expect(screen.getByText(/course-1,course-2/)).toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith(
      expect.stringMatching(/Bulk course assignment is disabled in production/i),
      'info',
      5000,
    );
  });
});
