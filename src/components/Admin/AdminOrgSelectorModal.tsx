import Card from '../ui/Card';
import Button from '../ui/Button';
import Badge from '../ui/Badge';
import type { FC } from 'react';
import Modal from '../Modal';

interface OrgOption {
  id: string;
  label: string;
  status?: string | null;
}

interface Props {
  open: boolean;
  onClose: () => void;
  organizationOptions: OrgOption[];
  activeOrgId: string | null;
  selectOrganization: (orgId: string | null) => Promise<void>;
}

const AdminOrgSelectorModal: FC<Props> = ({ open, onClose, organizationOptions, activeOrgId, selectOrganization }) => {
  return (
    <Modal isOpen={open} onClose={onClose} ariaLabel="Choose organization" maxWidth="xl">
      <div className="w-full">
        <Card className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-lg font-heading font-semibold">Choose an organization</h3>
              <p className="text-sm text-slate/70 mt-1">Select an active workspace to unlock organization-scoped admin tools.</p>
            </div>
            <div>
              <button onClick={onClose} className="text-slate/60 hover:text-slate">✕</button>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {organizationOptions.length === 0 && (
              <div className="text-sm text-slate/70">No organizations available. You can create one from the Organizations page.</div>
            )}

            {organizationOptions.map((org) => (
              <div key={org.id} className="flex items-center justify-between gap-3 rounded-md border border-cloud p-3">
                <div>
                  <div className="font-semibold text-charcoal">{org.label}</div>
                  {org.status && <div className="text-xs text-slate/60">{org.status}</div>}
                </div>
                <div className="flex items-center gap-3">
                  {activeOrgId === org.id ? (
                    <Badge tone="info">Active</Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={async () => {
                        try {
                          await selectOrganization(org.id);
                          onClose();
                        } catch (e) {
                          console.warn('Failed to select org via modal', e);
                        }
                      }}
                    >
                      Use org
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-end gap-3">
            <Button variant="ghost" onClick={onClose}>Close</Button>
            <Button asChild>
              <a href="/admin/organizations" className="no-underline">Open Organizations</a>
            </Button>
          </div>
        </Card>
      </div>
    </Modal>
  );
};

export default AdminOrgSelectorModal;
