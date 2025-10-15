import { useEffect, useState, useCallback } from 'react';
import { 
  Bell, 
  X, 
  CheckCircle, 
  AlertTriangle, 
  Info, 
  BookOpen, 

  Award,
  TrendingUp
} from 'lucide-react';
import { useRealtimeSync, RealtimeEvent } from '../hooks/useRealtimeSync';
import toast from 'react-hot-toast';

interface Notification {
  id: string;
  title: string;
  message: string;
  type: 'course_assigned' | 'progress_sync' | 'achievement' | 'announcement' | 'reminder';
  priority: 'low' | 'medium' | 'high';
  timestamp: Date;
  read: boolean;
  actionUrl?: string;
  actionLabel?: string;
}

interface RealtimeNotificationsProps {
  userId?: string;
  enabled?: boolean;
  maxNotifications?: number;
}

const RealtimeNotifications = ({ 
  userId = 'demo-user', 
  enabled = true,
  maxNotifications = 50
}: RealtimeNotificationsProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(`notifications_${userId}`);
      if (stored) {
        const parsedNotifications = JSON.parse(stored).map((n: any) => ({
          ...n,
          timestamp: new Date(n.timestamp)
        }));
        setNotifications(parsedNotifications);
        setUnreadCount(parsedNotifications.filter((n: Notification) => !n.read).length);
      }
    } catch (error) {
      console.error('[RealtimeNotifications] Failed to load notifications:', error);
    }
  }, [userId]);

  // Save notifications to localStorage whenever they change
  const saveNotifications = useCallback((newNotifications: Notification[]) => {
    try {
      const toStore = newNotifications.map(n => ({
        ...n,
        timestamp: n.timestamp.toISOString()
      }));
      localStorage.setItem(`notifications_${userId}`, JSON.stringify(toStore));
    } catch (error) {
      console.error('[RealtimeNotifications] Failed to save notifications:', error);
    }
  }, [userId]);

  // Handle realtime events
  const handleRealtimeEvent = useCallback((event: RealtimeEvent) => {
    const notification = createNotificationFromEvent(event);
    if (notification) {
      addNotification(notification);
    }
  }, []);

  // Initialize realtime sync
  useRealtimeSync({
    userId,
    enabled,
    onEvent: handleRealtimeEvent,
    onError: (error) => {
      console.error('[RealtimeNotifications] Realtime error:', error);
      addNotification({
        id: `error_${Date.now()}`,
        title: 'Connection Error',
        message: 'Lost connection to real-time updates. Some notifications may be delayed.',
        type: 'announcement',
        priority: 'medium',
        timestamp: new Date(),
        read: false
      });
    }
  });

  const createNotificationFromEvent = (event: RealtimeEvent): Notification | null => {
    const baseId = `${event.type}_${event.timestamp}`;
    
    switch (event.type) {
      case 'course_assigned':
        return {
          id: baseId,
          title: 'New Course Assigned',
          message: `You've been enrolled in "${event.payload.course_name || 'a new course'}".`,
          type: 'course_assigned',
          priority: 'high',
          timestamp: new Date(event.timestamp),
          read: false,
          actionUrl: `/lms/courses/${event.payload.course_id}`,
          actionLabel: 'View Course'
        };
        
      case 'course_updated':
        return {
          id: baseId,
          title: 'Course Updated',
          message: `"${event.payload.course_name || 'Course'}" has been updated with new content.`,
          type: 'announcement',
          priority: 'medium',
          timestamp: new Date(event.timestamp),
          read: false,
          actionUrl: `/lms/courses/${event.payload.course_id}`,
          actionLabel: 'View Updates'
        };
        
      case 'progress_sync':
        // Only show progress sync notifications for significant milestones
        if (event.payload.completed || (event.payload.progress && event.payload.progress >= 100)) {
          return {
            id: baseId,
            title: 'Lesson Completed!',
            message: `Great job completing "${event.payload.lesson_name || 'lesson'}"!`,
            type: 'achievement',
            priority: 'medium',
            timestamp: new Date(event.timestamp),
            read: false,
            actionUrl: `/lms/module/${event.payload.module_id}/lesson/${event.payload.lesson_id}`,
            actionLabel: 'Continue Learning'
          };
        }
        break;
        
      case 'enrollment_changed':
        return {
          id: baseId,
          title: 'Enrollment Updated',
          message: event.payload.status === 'enrolled' 
            ? `You're now enrolled in "${event.payload.course_name || 'course'}"`
            : `Your enrollment in "${event.payload.course_name || 'course'}" has been updated`,
          type: 'announcement',
          priority: event.payload.status === 'enrolled' ? 'high' : 'medium',
          timestamp: new Date(event.timestamp),
          read: false,
          actionUrl: event.payload.status === 'enrolled' ? `/lms/courses/${event.payload.course_id}` : undefined,
          actionLabel: event.payload.status === 'enrolled' ? 'Start Learning' : undefined
        };
        
      case 'user_status_changed':
        return {
          id: baseId,
          title: 'Account Status Updated',
          message: event.payload.status === 'suspended' 
            ? 'Your account has been suspended. Please contact support.'
            : event.payload.status === 'activated'
            ? 'Your account has been activated. Welcome back!'
            : `Your account status has been updated to ${event.payload.status}`,
          type: 'announcement',
          priority: 'high',
          timestamp: new Date(event.timestamp),
          read: false
        };
        
      default:
        return null;
    }
    
    return null;
  };

  const addNotification = useCallback((notification: Notification) => {
    setNotifications(prev => {
      // Remove duplicates and add new notification
      const filtered = prev.filter(n => n.id !== notification.id);
      const newNotifications = [notification, ...filtered].slice(0, maxNotifications);
      
      saveNotifications(newNotifications);
      return newNotifications;
    });
    
    setUnreadCount(prev => prev + 1);
    
    // Show toast notification
    const icon = getNotificationIcon(notification.type);
    toast(notification.message, {
      icon: icon,
      duration: notification.priority === 'high' ? 8000 : 4000,
      position: 'top-right'
    });
  }, [maxNotifications, saveNotifications]);

  const markAsRead = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const updated = prev.map(n => 
        n.id === notificationId ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
    
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [saveNotifications]);

  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
    
    setUnreadCount(0);
  }, [saveNotifications]);

  const deleteNotification = useCallback((notificationId: string) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === notificationId);
      const updated = prev.filter(n => n.id !== notificationId);
      saveNotifications(updated);
      
      if (notification && !notification.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
      }
      
      return updated;
    });
  }, [saveNotifications]);

  const clearAllNotifications = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    saveNotifications([]);
  }, [saveNotifications]);

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'course_assigned':
        return <BookOpen className="w-4 h-4 text-blue-600" />;
      case 'progress_sync':
        return <TrendingUp className="w-4 h-4 text-green-600" />;
      case 'achievement':
        return <Award className="w-4 h-4 text-yellow-600" />;
      case 'announcement':
        return <Info className="w-4 h-4 text-blue-600" />;
      case 'reminder':
        return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      default:
        return <Bell className="w-4 h-4 text-gray-600" />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500 bg-red-50';
      case 'medium':
        return 'border-l-yellow-500 bg-yellow-50';
      case 'low':
        return 'border-l-blue-500 bg-blue-50';
      default:
        return 'border-l-gray-500 bg-gray-50';
    }
  };

  const formatTimestamp = (timestamp: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - timestamp.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      return `${diffDays}d ago`;
    } else if (diffHours > 0) {
      return `${diffHours}h ago`;
    } else if (diffMins > 0) {
      return `${diffMins}m ago`;
    } else {
      return 'Just now';
    }
  };

  if (!enabled) return null;

  return (
    <>
      {/* Notification Bell */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="relative p-2 text-gray-600 hover:text-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-lg"
        >
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </button>

        {/* Notifications Dropdown */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-96 bg-white rounded-lg shadow-lg border border-gray-200 z-50 max-h-96 overflow-hidden">
            {/* Header */}
            <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-gray-900">Notifications</h3>
              <div className="flex items-center space-x-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-800"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Notifications List */}
            <div className="max-h-80 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="px-4 py-8 text-center text-gray-500">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  <p>No notifications yet</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-100">
                  {notifications.map((notification) => (
                    <div
                      key={notification.id}
                      className={`px-4 py-3 hover:bg-gray-50 border-l-4 ${getPriorityColor(notification.priority)} ${
                        !notification.read ? 'bg-blue-50' : 'bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3 flex-1">
                          <div className="flex-shrink-0 mt-1">
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${!notification.read ? 'text-gray-900' : 'text-gray-700'}`}>
                              {notification.title}
                            </p>
                            <p className="text-sm text-gray-600 mt-1">
                              {notification.message}
                            </p>
                            <div className="flex items-center justify-between mt-2">
                              <span className="text-xs text-gray-500">
                                {formatTimestamp(notification.timestamp)}
                              </span>
                              {notification.actionUrl && (
                                <a
                                  href={notification.actionUrl}
                                  className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                                  onClick={() => {
                                    markAsRead(notification.id);
                                    setIsOpen(false);
                                  }}
                                >
                                  {notification.actionLabel}
                                </a>
                              )}
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-1 ml-2">
                          {!notification.read && (
                            <button
                              onClick={() => markAsRead(notification.id)}
                              className="p-1 text-blue-600 hover:text-blue-800"
                              title="Mark as read"
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => deleteNotification(notification.id)}
                            className="p-1 text-gray-400 hover:text-gray-600"
                            title="Delete notification"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Footer */}
            {notifications.length > 0 && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <button
                  onClick={clearAllNotifications}
                  className="w-full text-xs text-gray-600 hover:text-gray-800"
                >
                  Clear all notifications
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Click outside to close */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  );
};

export default RealtimeNotifications;