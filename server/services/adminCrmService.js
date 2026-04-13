export const createAdminCrmService = ({ loadCrmSummary, loadCrmActivity } = {}) => ({
  loadSummary: async ({ req }) => ({
    status: 200,
    data: await loadCrmSummary(),
    meta: { requestId: req.requestId ?? null },
  }),
  loadActivity: async ({ req }) => ({
    status: 200,
    data: await loadCrmActivity(),
    meta: { requestId: req.requestId ?? null },
  }),
});

export default createAdminCrmService;
