import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import AdminDocuments from '../AdminDocuments';

const listDocumentsMock = vi.fn();
const addDocumentMock = vi.fn();
const recordDownloadMock = vi.fn();
const deleteDocumentMock = vi.fn();
const addNotificationMock = vi.fn();
const showToastMock = vi.fn();

vi.mock('../../../dal/documents', () => ({
  default: {
    listDocuments: (...args: any[]) => listDocumentsMock(...args),
    addDocument: (...args: any[]) => addDocumentMock(...args),
    recordDownload: (...args: any[]) => recordDownloadMock(...args),
    deleteDocument: (...args: any[]) => deleteDocumentMock(...args),
  },
}));

vi.mock('../../../dal/notifications', () => ({
  default: {
    addNotification: (...args: any[]) => addNotificationMock(...args),
  },
}));

vi.mock('../../../context/ToastContext', () => ({
  useToast: () => ({ showToast: showToastMock }),
}));

let activeOrganizationState = {
  organizations: [{ id: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8', label: 'The Huddle' }],
  activeOrgId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
  isMultiOrg: false,
};

vi.mock('../../../hooks/useActiveOrganization', () => ({
  default: () => activeOrganizationState,
}));

describe('AdminDocuments', () => {
  beforeEach(() => {
    listDocumentsMock.mockReset();
    addDocumentMock.mockReset();
    recordDownloadMock.mockReset();
    deleteDocumentMock.mockReset();
    addNotificationMock.mockReset();
    showToastMock.mockReset();
    activeOrganizationState = {
      organizations: [{ id: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8', label: 'The Huddle' }],
      activeOrgId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
      isMultiOrg: false,
    };
  });

  it('shows the newly uploaded document after a successful upload', async () => {
    const createdDocument = {
      id: 'doc-1',
      name: 'Welcome Packet',
      category: 'Training',
      tags: ['welcome'],
      visibility: 'org',
      organizationId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
      createdAt: new Date().toISOString(),
    };

    listDocumentsMock.mockResolvedValueOnce([]).mockResolvedValueOnce([createdDocument]);
    addDocumentMock.mockResolvedValueOnce(createdDocument);

    render(<AdminDocuments />);

    await screen.findByText('No documents yet');

    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Welcome Packet' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Training' } });

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['hello'], 'welcome.txt', { type: 'text/plain' });
    fireEvent.change(fileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole('button', { name: /upload/i }));

    await waitFor(() => {
      expect(addDocumentMock).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Welcome Packet',
          category: 'Training',
          organizationId: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8',
        }),
        expect.any(File),
      );
    });

    expect(await screen.findByText('Welcome Packet')).toBeInTheDocument();
    expect(showToastMock).toHaveBeenCalledWith('Document uploaded successfully', 'success');
  });

  it('requires an explicit organization selection for multi-org admins', async () => {
    activeOrganizationState = {
      organizations: [
        { id: 'd28e403a-cdab-42cd-8fc7-2c9327ca40f8', label: 'The Huddle' },
        { id: '3f48d198-c3dd-4afb-b443-6257c8046d2f', label: 'Partner Org' },
      ],
      activeOrgId: null,
      isMultiOrg: true,
    };
    listDocumentsMock.mockResolvedValueOnce([]);

    render(<AdminDocuments />);

    await screen.findByText('No documents yet');
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'Policy' } });
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'Policy' } });
    expect(screen.getByText(/select the organization before uploading/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /upload/i })).toBeDisabled();
    expect(addDocumentMock).not.toHaveBeenCalled();
  });
});
