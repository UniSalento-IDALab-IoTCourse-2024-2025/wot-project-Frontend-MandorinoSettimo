import * as Notifications from 'expo-notifications';

let pendingNotifications: Notifications.Notification[] = [];

export const addPendingNotification = (n: Notifications.Notification) => {
    pendingNotifications.push(n);
};

export const getAndClearPendingNotifications = () => {
    const result = [...pendingNotifications];
    pendingNotifications = [];
    return result;
};
