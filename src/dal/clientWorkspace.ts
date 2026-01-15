import clientWorkspaceService from '../services/clientWorkspaceService';

export type {
  StrategicPlanVersion,
  SessionAttachment,
  SessionNote,
  ActionItem,
  OrgWorkspace,
} from '../services/clientWorkspaceService';

export {
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
  checkWorkspaceAccess,
} from '../services/clientWorkspaceService';

export default clientWorkspaceService;
