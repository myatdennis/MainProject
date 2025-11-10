import React from 'react';
export const useNotifications = () => {
    const [notifications, setNotifications] = React.useState([]);
    const addNotification = React.useCallback((notification) => {
        const id = Math.random().toString(36).substr(2, 9);
        setNotifications(prev => [...prev, { ...notification, id }]);
        // Auto-remove after 5 seconds
        setTimeout(() => {
            setNotifications(prev => prev.filter(n => n.id !== id));
        }, 5000);
    }, []);
    const removeNotification = React.useCallback((id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    }, []);
    return {
        notifications,
        addNotification,
        removeNotification
    };
};
