const firstRow = (result) => {
  const rows = Array.isArray(result?.data) ? result.data : result?.data ? [result.data] : [];
  return rows[0] ?? null;
};

export const createWorkspaceRepository = ({ supabase }) => {
  const listStrategicPlans = async (orgId) =>
    supabase.from('org_workspace_strategic_plans').select('*').eq('org_id', orgId).order('created_at', { ascending: false });

  const getStrategicPlan = async (orgId, id) =>
    supabase.from('org_workspace_strategic_plans').select('*').eq('org_id', orgId).eq('id', id).maybeSingle();

  const createStrategicPlan = async (orgId, payload) =>
    supabase
      .from('org_workspace_strategic_plans')
      .insert({
        org_id: orgId,
        content: payload.content,
        created_by: payload.createdBy,
        metadata: payload.metadata,
      })
      .select('*');

  const deleteStrategicPlan = async (orgId, id) =>
    supabase.from('org_workspace_strategic_plans').delete().eq('org_id', orgId).eq('id', id);

  const listSessionNotes = async (orgId) =>
    supabase
      .from('org_workspace_session_notes')
      .select('*')
      .eq('org_id', orgId)
      .order('note_date', { ascending: false })
      .order('created_at', { ascending: false });

  const createSessionNote = async (orgId, payload) =>
    supabase
      .from('org_workspace_session_notes')
      .insert({
        org_id: orgId,
        title: payload.title,
        body: payload.body,
        note_date: payload.date,
        tags: payload.tags,
        attachments: payload.attachments,
        created_by: payload.createdBy,
      })
      .select('*');

  const listActionItems = async (orgId) =>
    supabase.from('org_workspace_action_items').select('*').eq('org_id', orgId);

  const getActionItem = async (orgId, id) =>
    supabase.from('org_workspace_action_items').select('*').eq('org_id', orgId).eq('id', id).maybeSingle();

  const createActionItem = async (orgId, payload) =>
    supabase
      .from('org_workspace_action_items')
      .insert({
        org_id: orgId,
        title: payload.title,
        description: payload.description,
        assignee: payload.assignee,
        due_at: payload.dueDate,
        status: payload.status,
        metadata: payload.metadata,
      })
      .select('*');

  const updateActionItem = async (orgId, id, payload) => {
    const updatePayload = {};
    const map = {
      title: 'title',
      description: 'description',
      assignee: 'assignee',
      dueDate: 'due_at',
      status: 'status',
      metadata: 'metadata',
    };
    for (const [key, column] of Object.entries(map)) {
      if (Object.prototype.hasOwnProperty.call(payload, key)) {
        updatePayload[column] = payload[key];
      }
    }
    if (Object.keys(updatePayload).length === 0) {
      return getActionItem(orgId, id);
    }
    return supabase.from('org_workspace_action_items').update(updatePayload).eq('org_id', orgId).eq('id', id).select('*');
  };

  const deleteActionItem = async (orgId, id) =>
    supabase.from('org_workspace_action_items').delete().eq('org_id', orgId).eq('id', id);

  const getWorkspaceBundle = async (orgId) => {
    const [plans, notes, items] = await Promise.all([
      listStrategicPlans(orgId),
      listSessionNotes(orgId),
      listActionItems(orgId),
    ]);
    return { plans, notes, items };
  };

  return {
    firstRow,
    listStrategicPlans,
    getStrategicPlan,
    createStrategicPlan,
    deleteStrategicPlan,
    listSessionNotes,
    createSessionNote,
    listActionItems,
    getActionItem,
    createActionItem,
    updateActionItem,
    deleteActionItem,
    getWorkspaceBundle,
  };
};

export default createWorkspaceRepository;
