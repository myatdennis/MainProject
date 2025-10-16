export type NotificationType =
  | 'assignment'
  | 'course_update'
  | 'survey_reminder'
  | 'completion'
  | 'broadcast'
  | 'system'
  | 'message';

export type NotificationCategory = 'alert' | 'announcement' | 'update' | 'celebration' | 'reminder';

export type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

export interface NotificationRecord {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string | null;
  actionLabel?: string | null;
  recipientUserId?: string | null;
  recipientOrgId?: string | null;
  isRead: boolean;
  createdAt: string;
  expiresAt?: string | null;
  priority: NotificationPriority;
  senderId?: string | null;
  category: NotificationCategory;
  metadata?: Record<string, unknown> | null;
  archived?: boolean;
}

export interface NotificationInput extends Partial<Omit<NotificationRecord, 'id' | 'createdAt' | 'isRead'>> {
  id?: string;
  createdAt?: string;
  isRead?: boolean;
}

export interface NotificationFilterOptions {
  userId?: string;
  orgId?: string;
  limit?: number;
  includeArchived?: boolean;
}

export interface NotificationPreferences {
  assignments: boolean;
  courseUpdates: boolean;
  surveyReminders: boolean;
  completionCelebrations: boolean;
  announcements: boolean;
  systemUpdates: boolean;
  digestFrequency: 'daily' | 'weekly' | 'off';
  allowPush: boolean;
  emailSummary: boolean;
}

export type NotificationEventType = 'delivered' | 'read' | 'clicked' | 'archived' | 'deleted';

export interface NotificationEvent {
  id: string;
  notificationId: string;
  type: NotificationEventType;
  occurredAt: string;
  userId?: string | null;
  metadata?: Record<string, unknown>;
}

export interface NotificationAnalytics {
  total: number;
  unread: number;
  read: number;
  archived: number;
  urgent: number;
  byType: Record<NotificationType, number>;
  byCategory: Record<NotificationCategory, number>;
  openRate: number;
  clickRate: number;
  engagementByOrg: Array<{
    orgId: string;
    sent: number;
    read: number;
  }>;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  assignments: true,
  courseUpdates: true,
  surveyReminders: true,
  completionCelebrations: true,
  announcements: true,
  systemUpdates: true,
  digestFrequency: 'daily',
  allowPush: false,
  emailSummary: true,
};
