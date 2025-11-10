import apiRequest from '../utils/apiClient';
// Workspace APIs use mixed casing on the wire. We disable auto-transforms here
// to preserve expected request/response shapes and rely on explicit mappers.
const apiFetch = async (path, options = {}) => apiRequest(path, { noTransform: true, ...options });
const mapStrategicPlan = (record) => ({
    id: record.id,
    orgId: record.orgId ?? record.org_id,
    content: record.content ?? '',
    createdAt: record.createdAt ?? record.created_at ?? new Date().toISOString(),
    createdBy: record.createdBy ?? record.created_by ?? 'System',
    metadata: record.metadata ?? {}
});
const mapSessionNote = (record) => ({
    id: record.id,
    orgId: record.orgId ?? record.org_id,
    title: record.title,
    body: record.body ?? '',
    date: record.date ?? record.note_date ?? record.created_at ?? new Date().toISOString(),
    tags: Array.isArray(record.tags) ? record.tags : [],
    attachments: Array.isArray(record.attachments) ? record.attachments : [],
    createdBy: record.createdBy ?? record.created_by ?? 'System',
    createdAt: record.createdAt ?? record.created_at,
    updatedAt: record.updatedAt ?? record.updated_at
});
const mapActionItem = (record) => ({
    id: record.id,
    orgId: record.orgId ?? record.org_id,
    title: record.title,
    description: record.description ?? undefined,
    assignee: record.assignee ?? undefined,
    dueDate: record.dueDate ?? record.due_at ?? undefined,
    status: record.status ?? 'Not Started',
    metadata: record.metadata ?? {},
    createdAt: record.createdAt ?? record.created_at,
    updatedAt: record.updatedAt ?? record.updated_at
});
export const getWorkspace = async (orgId) => {
    const json = await apiFetch(`/api/orgs/${orgId}/workspace`);
    return {
        orgId: json.data.orgId,
        strategicPlans: (json.data.strategicPlans ?? []).map(mapStrategicPlan),
        sessionNotes: (json.data.sessionNotes ?? []).map(mapSessionNote),
        actionItems: (json.data.actionItems ?? []).map(mapActionItem)
    };
};
export const addStrategicPlanVersion = async (orgId, content, createdBy = 'Huddle Co.', metadata = {}) => {
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/strategic-plans`, {
        method: 'POST',
        body: JSON.stringify({ content, createdBy, metadata })
    });
    return mapStrategicPlan(json.data);
};
export const listStrategicPlans = async (orgId) => {
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/strategic-plans`);
    return (json.data ?? []).map(mapStrategicPlan);
};
export const deleteStrategicPlanVersion = async (orgId, versionId) => {
    await apiFetch(`/api/orgs/${orgId}/workspace/strategic-plans/${versionId}`, {
        method: 'DELETE',
        expectedStatus: [200, 204],
        rawResponse: true
    });
};
export const getStrategicPlanVersion = async (orgId, versionId) => {
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/strategic-plans/${versionId}`);
    return json?.data ? mapStrategicPlan(json.data) : null;
};
export const addSessionNote = async (orgId, note, createdBy = 'Huddle Co.') => {
    const payload = {
        title: note.title,
        body: note.body,
        date: note.date,
        tags: note.tags,
        attachments: note.attachments,
        createdBy
    };
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/session-notes`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return mapSessionNote(json.data);
};
export const listSessionNotes = async (orgId) => {
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/session-notes`);
    return (json.data ?? []).map(mapSessionNote);
};
export const addActionItem = async (orgId, item) => {
    const payload = {
        title: item.title,
        description: item.description,
        assignee: item.assignee,
        dueDate: item.dueDate,
        status: item.status,
        metadata: item.metadata
    };
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/action-items`, {
        method: 'POST',
        body: JSON.stringify(payload)
    });
    return mapActionItem(json.data);
};
export const updateActionItem = async (orgId, item) => {
    const payload = {
        title: item.title,
        description: item.description,
        assignee: item.assignee,
        dueDate: item.dueDate,
        status: item.status,
        metadata: item.metadata
    };
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/action-items/${item.id}`, {
        method: 'PUT',
        body: JSON.stringify(payload)
    });
    return mapActionItem(json.data);
};
export const listActionItems = async (orgId) => {
    const json = await apiFetch(`/api/orgs/${orgId}/workspace/action-items`);
    return (json.data ?? []).map(mapActionItem);
};
export const checkWorkspaceAccess = async (orgId) => {
    try {
        const json = await apiFetch(`/api/orgs/${orgId}/workspace/access`);
        return json?.data ?? null;
    }
    catch (error) {
        if (error instanceof Error && /(401|403)/.test(error.message)) {
            return null;
        }
        throw error;
    }
};
export default {
    getWorkspace,
    addStrategicPlanVersion,
    listStrategicPlans,
    deleteStrategicPlanVersion,
    getStrategicPlanVersion,
    addSessionNote,
    listSessionNotes,
    addActionItem,
    updateActionItem,
    listActionItems,
    checkWorkspaceAccess
};
