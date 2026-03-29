import * as notificationService from '../services/notificationService';

export type { Notification } from '../services/notificationService';

export {
  listAdminNotificationsWithMeta,
  listNotifications,
  addNotification,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  listLearnerNotifications,
  deleteLearnerNotification,
  markLearnerNotificationRead,
  markLearnerNotificationsRead,
} from '../services/notificationService';

export default notificationService;
