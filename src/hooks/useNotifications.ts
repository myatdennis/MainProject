import React from 'react';

type NotificationType = 'success' | 'error' | 'warning' | 'info';

export const useNotifications = () => {
  const [notifications, setNotifications] = React.useState<Array<{
    id: string;
    type: NotificationType;
    title: string;
    message?: string;
  }>>([]);

  const addNotification = React.useCallback((notification: Omit<typeof notifications[0], 'id'>) => {
    const id = Math.random().toString(36).substr(2, 9);
    setNotifications(prev => [...prev, { ...notification, id }]);
    
    // Auto-remove after 5 seconds
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== id));
    }, 5000);
  }, []);

  const removeNotification = React.useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  return {
    notifications,
    addNotification,
    removeNotification
  };
};