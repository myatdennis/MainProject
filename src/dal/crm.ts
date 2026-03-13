import { getCrmSummary, getCrmActivity, sendBroadcastNotification } from '../services/crmService';

export type { CrmSummary, CrmActivity } from '../services/crmService';
export { getCrmSummary, getCrmActivity, sendBroadcastNotification };

const crmDal = {
  getCrmSummary,
  getCrmActivity,
  sendBroadcastNotification,
};

export default crmDal;
