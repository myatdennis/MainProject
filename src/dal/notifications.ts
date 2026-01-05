import * as notificationService from '../services/notificationService';

export type { Notification } from '../services/notificationService';

export {
  listNotifications,
  addNotification,
  markNotificationRead,
  deleteNotification,
  clearNotifications,
  listLearnerNotifications,
  markLearnerNotificationRead,
  markLearnerNotificationsRead,
} from '../services/notificationService';

export default notificationService;
