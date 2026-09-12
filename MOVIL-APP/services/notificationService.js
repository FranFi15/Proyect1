import apiClient from './apiClient';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import Constants from 'expo-constants';
import { getNotifications, isPushNotificationsAvailable } from './expoNotificationsSafe';

const Notifications = getNotifications();

if (Notifications?.setNotificationHandler) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: true,
      shouldSetBadge: true,
    }),
  });
}

async function getExpoTokenAndSendToServer() {
  if (!Notifications) {
    throw new Error('Las notificaciones push no están disponibles en este entorno.');
  }

  try {
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) throw new Error('Falta el projectId en la configuración de Expo.');

    const token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token:', token);

    await apiClient.put('/users/profile/push-token', { token });

    return token;
  } catch (e) {
    console.error('Error obteniendo o enviando el Expo Push Token:', e);
    throw new Error(`No se pudo obtener o enviar el token para notificaciones: ${e.message}`);
  }
}

export async function registerForPushNotificationsAsync() {
  if (!isPushNotificationsAvailable() || !Notifications) {
    return { status: 'unavailable', token: null };
  }

  if (!Device.isDevice) {
    throw new Error('Las notificaciones push solo funcionan en dispositivos físicos.');
  }

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#FF231F7C',
    });
  }

  let { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    return { status: 'denied', token: null };
  }

  const token = await getExpoTokenAndSendToServer();
  return { status: 'granted', token };
}

const notificationService = {
  getNotifications: async () => {
    try {
      const response = await apiClient.get('/notifications/me');
      return response.data;
    } catch (error) {
      console.error('Error fetching notifications (MOVIL-APP):', error);
      throw error.response?.data?.message || 'Error al obtener notificaciones.';
    }
  },

  markNotificationAsRead: async (notificationId) => {
    try {
      const response = await apiClient.put(`/notifications/${notificationId}/read`);
      return response.data;
    } catch (error) {
      console.error(`Error marking notification ${notificationId} as read (MOVIL-APP):`, error);
      throw error.response?.data?.message || 'Error al marcar notificación como leída.';
    }
  },

  markAllNotificationsAsRead: async () => {
    try {
      const response = await apiClient.put('/notifications/mark-all-read');
      return response.data;
    } catch (error) {
      console.error('Error marking all notifications as read (MOVIL-APP):', error);
      throw error.response?.data?.message || 'Error al marcar todas las notificaciones como leídas.';
    }
  },

  deleteNotification: async (notificationId) => {
    try {
      const response = await apiClient.delete(`/notifications/me/${notificationId}`);
      return response.data;
    } catch (error) {
      console.error(`Error deleting notification ${notificationId}:`, error);
      throw error.response?.data?.message || 'Error al eliminar la notificación.';
    }
  },

  deleteAllNotifications: async () => {
    try {
      const response = await apiClient.delete('/notifications/me/all');
      return response.data;
    } catch (error) {
      console.error('Error deleting all notifications:', error);
      throw error.response?.data?.message || 'Error al eliminar todas las notificaciones.';
    }
  },

  registerForPushNotificationsAsync,
};

export default notificationService;
