const toStrategicPlan = (row) => ({
  id: row.id,
  orgId: row.org_id,
  content: row.content,
  createdAt: row.created_at,
  createdBy: row.created_by,
  metadata: row.metadata ?? {},
});

const toSessionNote = (row) => ({
  id: row.id,
  orgId: row.org_id,
  title: row.title,
  body: row.body,
  date: row.note_date ?? row.created_at,
  tags: Array.isArray(row.tags) ? row.tags : [],
  attachments: Array.isArray(row.attachments) ? row.attachments : [],
  createdBy: row.created_by,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const toActionItem = (row) => ({
  id: row.id,
  orgId: row.org_id,
  title: row.title,
  description: row.description,
  assignee: row.assignee,
  dueDate: row.due_at,
  status: row.status,
  metadata: row.metadata ?? {},
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const sortActionItems = (items) =>
  [...items].sort((left, right) => {
    const leftDue = left.dueDate ? Date.parse(left.dueDate) : Number.POSITIVE_INFINITY;
    const rightDue = right.dueDate ? Date.parse(right.dueDate) : Number.POSITIVE_INFINITY;
    if (leftDue !== rightDue) return leftDue - rightDue;
    return String(left.title || '').localeCompare(String(right.title || ''));
  });

export const createWorkspaceService = ({ repository }) => {
  const assertResult = (result, fallbackMessage) => {
    if (result?.error) {
      const error = new Error(result.error.message || fallbackMessage);
      error.code = result.error.code || 'workspace_query_failed';
      throw error;
    }
    return result;
  };

  return {
    async getAccessEnvelope(orgId, access) {
      return { orgId, role: access.role };
    },

    async getWorkspace(orgId) {
      const { plans, notes, items } = await repository.getWorkspaceBundle(orgId);
      assertResult(plans, 'Unable to load strategic plans');
      assertResult(notes, 'Unable to load session notes');
      assertResult(items, 'Unable to load action items');
      return {
        orgId,
        strategicPlans: (plans.data ?? []).map(toStrategicPlan),
        sessionNotes: (notes.data ?? []).map(toSessionNote),
        actionItems: sortActionItems((items.data ?? []).map(toActionItem)),
      };
    },

    async listStrategicPlans(orgId) {
      const result = assertResult(await repository.listStrategicPlans(orgId), 'Unable to fetch strategic plans');
      return (result.data ?? []).map(toStrategicPlan);
    },

    async getStrategicPlan(orgId, id) {
      const result = assertResult(await repository.getStrategicPlan(orgId, id), 'Unable to fetch strategic plan');
      return result.data ? toStrategicPlan(result.data) : null;
    },

    async createStrategicPlan(orgId, payload) {
      const result = assertResult(await repository.createStrategicPlan(orgId, payload), 'Unable to create strategic plan');
      return toStrategicPlan(repository.firstRow(result));
    },

    async deleteStrategicPlan(orgId, id) {
      const result = assertResult(await repository.deleteStrategicPlan(orgId, id), 'Unable to delete strategic plan');
      return result;
    },

    async listSessionNotes(orgId) {
      const result = assertResult(await repository.listSessionNotes(orgId), 'Unable to fetch session notes');
      return (result.data ?? []).map(toSessionNote);
    },

    async createSessionNote(orgId, payload) {
      const result = assertResult(await repository.createSessionNote(orgId, payload), 'Unable to create session note');
      return toSessionNote(repository.firstRow(result));
    },

    async listActionItems(orgId) {
      const result = assertResult(await repository.listActionItems(orgId), 'Unable to fetch action items');
      return sortActionItems((result.data ?? []).map(toActionItem));
    },

    async createActionItem(orgId, payload) {
      const result = assertResult(await repository.createActionItem(orgId, payload), 'Unable to create action item');
      return toActionItem(repository.firstRow(result));
    },

    async updateActionItem(orgId, id, payload) {
      const result = assertResult(await repository.updateActionItem(orgId, id, payload), 'Unable to update action item');
      const row = repository.firstRow(result);
      return row ? toActionItem(row) : null;
    },

    async deleteActionItem(orgId, id) {
      const result = assertResult(await repository.deleteActionItem(orgId, id), 'Unable to delete action item');
      return result;
    },
  };
};

export default createWorkspaceService;
