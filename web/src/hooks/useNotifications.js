import { useContext } from 'react';
import NotificationContext from '../context/notificationState';
export default function useNotifications() { return useContext(NotificationContext); }
