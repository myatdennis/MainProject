import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, Check, Loader2, Users, X } from 'lucide-react';
import clsx from 'clsx';
import Modal from '../Modal';
import { assignSurvey } from '../../dal/surveys';
import orgService, { invalidateOrgListCache, type Org } from '../../dal/orgs';
import adminUsers, { AdminUserRecord } from '../../dal/adminUsers';
import { useToast } from '../../context/ToastContext';
import { resolveUserFacingError } from '../../utils/userFacingError';

type SurveyAssignmentModalProps = {
  isOpen: boolean;
  surveyId: string;
  surveyTitle: string;
  initialOrganizationIds?: string[];
  onClose: () => void;
  onAssigned?: () => void;
};

const SurveyAssignmentModal: React.FC<SurveyAssignmentModalProps> = ({
  isOpen,
  surveyId,
  surveyTitle,
  initialOrganizationIds = [],
  onClose,
  onAssigned,
}) => {
  const { showToast } = useToast();
  const [organizations, setOrganizations] = useState<Org[]>([]);
  const [orgLoading, setOrgLoading] = useState(false);
  const [orgError, setOrgError] = useState<string | null>(null);
  const [selectedOrgIds, setSelectedOrgIds] = useState<string[]>(initialOrganizationIds);
  const [orgSearch, setOrgSearch] = useState('');
  const [orgMembers, setOrgMembers] = useState<Record<string, AdminUserRecord[]>>({});
  const [userSearch, setUserSearch] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [userError, setUserError] = useState<string | null>(null);
  const [dueDate, setDueDate] = useState('');
  const [note, setNote] = useState('');
  const [assessmentType, setAssessmentType] = useState<'standard' | 'hdi'>('standard');
  const [administrationType, setAdministrationType] = useState<'single' | 'pre' | 'post' | 'pulse'>('single');
  const [linkedAssessmentId, setLinkedAssessmentId] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setSelectedOrgIds(initialOrganizationIds);
      setSelectedUserIds([]);
      setOrgSearch('');
      setUserSearch('');
      setNote('');
      setDueDate('');
      setAssessmentType('standard');
      setAdministrationType('single');
      setLinkedAssessmentId('');
      setOrgError(null);
      setUserError(null);
    }
  }, [isOpen, initialOrganizationIds]);

  useEffect(() => {
    if (!isOpen) return;
    let cancelled = false;
    setOrgLoading(true);
    orgService
      .listOrgs(undefined, { forceRefresh: true })
      .then((data) => {
        if (cancelled) return;
        setOrganizations(data);
      })
      .catch((error) => {
        if (cancelled) return;
        console.error('[SurveyAssignmentModal] Failed to load orgs', error);
        setOrgError('Unable to load organizations');
        setOrganizations([]);
      })
      .finally(() => {
        if (!cancelled) setOrgLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const missingOrgIds = selectedOrgIds.filter((orgId) => !orgMembers[orgId]);
    if (!missingOrgIds.length) return;
    let cancelled = false;
    Promise.all(
      missingOrgIds.map(async (orgId) => {
        try {
          const members = await adminUsers.listUsersByOrg(orgId);
          if (!cancelled) {
            setOrgMembers((prev) => ({ ...prev, [orgId]: members }));
          }
        } catch (error) {
          if (!cancelled) {
            console.warn('[SurveyAssignmentModal] Failed to load members', error);
            setUserError('Unable to load some members');
          }
        }
      }),
    ).catch(() => {
      if (!cancelled) {
        setUserError('Unable to load some members');
      }
    });
    return () => {
      cancelled = true;
    };
  }, [isOpen, selectedOrgIds, orgMembers]);

  useEffect(() => {
    // Remove users that belong to orgs no longer selected
    if (!selectedUserIds.length) return;
    const allowedUserIds = new Set(
      selectedOrgIds.flatMap((orgId) => (orgMembers[orgId] ?? []).map((member) => member.userId.toLowerCase())),
    );
    setSelectedUserIds((prev) => prev.filter((userId) => allowedUserIds.has(userId.toLowerCase())));
  }, [selectedOrgIds, orgMembers]);

  const filteredOrganizations = useMemo(() => {
    const query = orgSearch.trim().toLowerCase();
    if (!query) return organizations;
    return organizations.filter((org) => org.name?.toLowerCase().includes(query));
  }, [organizations, orgSearch]);

  const availableUsers = useMemo(() => {
    const aggregated: AdminUserRecord[] = [];
    selectedOrgIds.forEach((orgId) => {
      const members = orgMembers[orgId] || [];
      aggregated.push(...members);
    });
    const query = userSearch.trim().toLowerCase();
    if (!query) return aggregated;
    return aggregated.filter((user) => {
      const text = `${user.name ?? ''} ${user.email ?? ''}`.toLowerCase();
      return text.includes(query);
    });
  }, [selectedOrgIds, orgMembers, userSearch]);

  const toggleOrgSelection = (orgId: string) => {
    setSelectedOrgIds((prev) =>
      prev.includes(orgId) ? prev.filter((id) => id !== orgId) : [...prev, orgId],
    );
  };

  const toggleUserSelection = (userId: string) => {
    setSelectedUserIds((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleAssign = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!selectedOrgIds.length && !selectedUserIds.length) {
      showToast('Select at least one organization or user.', 'error');
      return;
    }
    setSubmitting(true);
    try {
      await assignSurvey(surveyId, {
        organizationIds: selectedOrgIds,
        userIds: selectedUserIds,
        dueAt: dueDate ? new Date(dueDate).toISOString() : undefined,
        note: note || undefined,
        metadata:
          assessmentType === 'hdi'
            ? {
                assessmentType: 'hdi',
                administrationType,
                linkedAssessmentId: linkedAssessmentId.trim() || null,
              }
            : undefined,
      });
      invalidateOrgListCache();
      showToast(
        `Assigned to ${selectedOrgIds.length} org${selectedOrgIds.length === 1 ? '' : 's'} and ${selectedUserIds.length} user${selectedUserIds.length === 1 ? '' : 's'}.`,
        'success',
      );
      onAssigned?.();
      onClose();
    } catch (error) {
      console.warn('[SurveyAssignmentModal] assign failed', error);
      const message = resolveUserFacingError(error, {
        fallback: 'Unable to assign survey.',
        action: 'Retry once the assignment service is healthy.',
      });
      showToast(message, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      ariaLabel="Assign survey"
      maxWidth="2xl"
      closeOnOverlayClick={!submitting}
    >
      <div className="w-full rounded-2xl bg-white">
        <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
          <div>
            <p className="text-sm uppercase tracking-wide text-gray-500">Assign Survey</p>
            <h2 className="sr-only">Assign survey to organizations</h2>
            <h3 className="text-xl font-semibold text-gray-900">{surveyTitle}</h3>
          </div>
          <button
            type="button"
            aria-label="Close assignment modal"
            onClick={onClose}
            className="rounded-full p-2 text-gray-500 hover:bg-gray-100 hover:text-gray-700"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={handleAssign} className="grid grid-cols-1 gap-6 px-6 py-6 md:grid-cols-2">
          <section className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-800">Organizations</label>
              <div className="relative mt-2">
                <Users className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  type="search"
                  className="w-full rounded-lg border border-gray-300 pl-9 pr-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Search organizations"
                  value={orgSearch}
                  onChange={(event) => setOrgSearch(event.target.value)}
                />
              </div>
              {orgError && <p className="mt-2 text-sm text-red-600">{orgError}</p>}
              <div className="mt-3 max-h-60 space-y-2 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {orgLoading && (
                  <div className="flex items-center space-x-2 text-sm text-gray-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Loading organizations…</span>
                  </div>
                )}
                {!orgLoading && filteredOrganizations.length === 0 && (
                  <p className="text-sm text-gray-500">No organizations found.</p>
                )}
                {filteredOrganizations.map((org) => {
                  const isSelected = selectedOrgIds.includes(org.id);
                  const inputId = `survey-assign-org-${org.id}`;
                  return (
                    <label
                      key={org.id}
                      htmlFor={inputId}
                      className={clsx(
                        'flex w-full cursor-pointer items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
                        isSelected ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-gray-200 hover:bg-gray-50',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          id={inputId}
                          type="checkbox"
                          checked={isSelected}
                          aria-label={org.name}
                          onChange={() => toggleOrgSelection(org.id)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                        />
                        <div>
                          <p className="font-medium">{org.name}</p>
                          <p className="text-xs text-gray-500">
                            {org.totalLearners?.toLocaleString() ?? 0} learners • {org.type ?? 'Org'}
                          </p>
                        </div>
                      </div>
                      <span
                        className={clsx(
                          'flex h-5 w-5 items-center justify-center rounded-full border',
                          isSelected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-gray-300 bg-white text-gray-400',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                    </label>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Selected organizations: <strong>{selectedOrgIds.length}</strong>
              </p>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">Due date (optional)</label>
              <div className="mt-2 flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2">
                <Calendar className="h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  className="w-full border-0 text-sm focus:outline-none focus:ring-0"
                  value={dueDate}
                  onChange={(event) => setDueDate(event.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-sm font-semibold text-gray-800">Note to recipients (optional)</label>
              <textarea
                className="mt-2 w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                rows={4}
                placeholder="Share context or expectations for this assignment…"
                value={note}
                onChange={(event) => setNote(event.target.value)}
              />
            </div>

            <div className="rounded-lg border border-gray-200 bg-gray-50 p-3 space-y-3">
              <div>
                <label className="text-sm font-semibold text-gray-800">Assessment mode</label>
                <select
                  value={assessmentType}
                  onChange={(event) => setAssessmentType(event.target.value as 'standard' | 'hdi')}
                  className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                >
                  <option value="standard">Standard survey assignment</option>
                  <option value="hdi">HDI assessment assignment</option>
                </select>
              </div>

              {assessmentType === 'hdi' && (
                <>
                  <div>
                    <label className="text-sm font-semibold text-gray-800">Administration type</label>
                    <select
                      value={administrationType}
                      onChange={(event) => setAdministrationType(event.target.value as 'single' | 'pre' | 'post' | 'pulse')}
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    >
                      <option value="single">Single administration</option>
                      <option value="pre">Pre-assessment</option>
                      <option value="post">Post-assessment</option>
                      <option value="pulse">Pulse / follow-up</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-800">Linked pre-assessment response ID (optional)</label>
                    <input
                      type="text"
                      value={linkedAssessmentId}
                      onChange={(event) => setLinkedAssessmentId(event.target.value)}
                      placeholder="Paste related pre response id"
                      className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                    />
                  </div>
                </>
              )}
            </div>
          </section>

          <section className="space-y-4">
            <div>
              <label className="text-sm font-semibold text-gray-800">Specific users (optional)</label>
              <p className="text-xs text-gray-500">
                Select individual users within the chosen organizations to notify directly.
              </p>
              <div className="relative mt-2">
                <input
                  type="search"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-200"
                  placeholder="Search members"
                  value={userSearch}
                  onChange={(event) => setUserSearch(event.target.value)}
                />
              </div>
              {userError && <p className="mt-2 text-sm text-red-600">{userError}</p>}
              <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-2">
                {availableUsers.length === 0 && (
                  <p className="text-sm text-gray-500">No users available for the selected organizations.</p>
                )}
                {availableUsers.map((user) => {
                  const isSelected = selectedUserIds.includes(user.userId);
                  return (
                    <button
                      type="button"
                      key={`${user.orgId}-${user.userId}`}
                      onClick={() => toggleUserSelection(user.userId)}
                      className={clsx(
                        'flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm',
                        isSelected ? 'border-emerald-500 bg-emerald-50 text-emerald-700' : 'border-gray-200 hover:bg-gray-50',
                      )}
                    >
                      <div>
                        <p className="font-medium">{user.name || user.email || user.userId}</p>
                        <p className="text-xs text-gray-500">{user.email ?? user.userId}</p>
                      </div>
                      <span
                        className={clsx(
                          'flex h-5 w-5 items-center justify-center rounded-full border',
                          isSelected ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-gray-300 bg-white text-gray-400',
                        )}
                      >
                        {isSelected && <Check className="h-3 w-3" />}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-xs text-gray-500">
                Selected users: <strong>{selectedUserIds.length}</strong>
              </p>
            </div>

            <div className="rounded-lg border border-indigo-100 bg-indigo-50 px-4 py-3 text-sm text-indigo-800">
              Assignments notify every selected organization and user. Learners will also see this survey in their dashboard.
            </div>

            <div className="flex items-center justify-end gap-3 border-t border-gray-200 pt-4">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="inline-flex items-center rounded-lg bg-indigo-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:opacity-60"
                aria-label="Save assignment"
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {submitting ? 'Saving…' : 'Save assignment'}
              </button>
            </div>
          </section>
        </form>
      </div>
    </Modal>
  );
};

export default SurveyAssignmentModal;
