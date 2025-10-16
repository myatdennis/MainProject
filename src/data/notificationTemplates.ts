import { NotificationInput } from '../types/notifications';

export type NotificationTemplate = NotificationInput & {
  id: string;
  description: string;
};

export const notificationTemplates: NotificationTemplate[] = [
  {
    id: 'course-assignment',
    description: 'Announce a newly assigned course to learners.',
    type: 'assignment',
    category: 'alert',
    priority: 'high',
    title: 'New Course Assigned',
    message: 'You have been assigned to a new development experience. Start today to stay on track.',
    actionLabel: 'Open Course',
  },
  {
    id: 'survey-reminder',
    description: 'Nudge participants to complete an upcoming survey.',
    type: 'survey_reminder',
    category: 'reminder',
    priority: 'medium',
    title: 'Survey Reminder',
    message: 'A new inclusion pulse check is waiting for you. We value your voice—please share your perspective.',
    actionLabel: 'Take Survey',
  },
  {
    id: 'completion-celebration',
    description: 'Congratulate learners on a recent achievement.',
    type: 'completion',
    category: 'celebration',
    priority: 'medium',
    title: 'Congratulations on Your Milestone!',
    message: 'You just completed a major milestone. Celebrate the progress and explore what’s next.',
    actionLabel: 'View Progress',
  },
  {
    id: 'system-update',
    description: 'Share platform updates or maintenance notifications.',
    type: 'system',
    category: 'announcement',
    priority: 'low',
    title: 'Platform Update',
    message: 'We are rolling out performance upgrades this weekend. Expect a smoother experience on Monday.',
    actionLabel: 'Read Details',
  },
  {
    id: 'broadcast-ceo',
    description: 'Broadcast organization-wide leadership announcements.',
    type: 'broadcast',
    category: 'announcement',
    priority: 'urgent',
    title: 'Leadership Update',
    message: 'Our CEO just shared new DEI commitments for the upcoming quarter. Review the highlights and next steps.',
    actionLabel: 'View Announcement',
  },
];

export const findTemplateById = (templateId: string) =>
  notificationTemplates.find((template) => template.id === templateId);

export default notificationTemplates;
