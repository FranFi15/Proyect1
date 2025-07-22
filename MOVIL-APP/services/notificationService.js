import apiClient from './apiClient';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform, Alert } from 'react-native';
import Constants from 'expo-constants';

// Configuración inicial para cómo se deben manejar las notificaciones cuando la app está en primer plano.
Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true, 
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

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

    // --- NUEVA FUNCIÓN ---
    deleteNotification: async (notificationId) => {
        try {
            const response = await apiClient.delete(`/notifications/me/${notificationId}`);
            return response.data;
        } catch (error) {
            console.error(`Error deleting notification ${notificationId}:`, error);
            throw error.response?.data?.message || 'Error al eliminar la notificación.';
        }
    },

    // --- NUEVA FUNCIÓN ---
    deleteAllNotifications: async () => {
        try {
            const response = await apiClient.delete('/notifications/me/all');
            return response.data;
        } catch (error) {
            console.error('Error deleting all notifications:', error);
            throw error.response?.data?.message || 'Error al eliminar todas las notificaciones.';
        }
    },

    registerForPushNotificationsAsync: async () => {
        let token;
        if (!Device.isDevice) {
            Alert.alert('Funcionalidad no disponible', 'Las notificaciones push solo funcionan en dispositivos físicos.');
            return null;
        }

        const { status: existingStatus } = await Notifications.getPermissionsAsync();
        let finalStatus = existingStatus;
        if (existingStatus !== 'granted') {
            const { status } = await Notifications.requestPermissionsAsync();
            finalStatus = status;
        }

        if (finalStatus !== 'granted') {
            alert('No se pudo obtener el permiso para las notificaciones push.');
            return null;
        }

        try {
    // Este es el cambio crucial: obtener el projectId desde la configuración de Expo.
    const projectId = Constants.expoConfig?.extra?.eas?.projectId;
    if (!projectId) {
        throw new Error('El projectId de Expo no se encontró. Asegúrate de que está en app.json.');
    }
    token = (await Notifications.getExpoPushTokenAsync({ projectId })).data;
    console.log('Expo Push Token:', token);
  } catch (e) {
    console.error("Error obteniendo el push token:", e);
    return null;
  }

        if (Platform.OS === 'android') {
            Notifications.setNotificationChannelAsync('default', {
                name: 'default',
                importance: Notifications.AndroidImportance.MAX,
                vibrationPattern: [0, 250, 250, 250],
                lightColor: '#FF231F7C',
            });
        }

        if (token) {
            try {
                // Enviamos el token al backend para guardarlo
                await apiClient.put('/users/profile/push-token', { token });
            } catch (error) {
                console.error('Error al enviar el push token al servidor:', error);
            }
        }

        return token;
    }
};

export default notificationService;