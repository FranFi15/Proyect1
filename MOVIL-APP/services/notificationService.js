import apiClient from './apiClient';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import Constants from 'expo-constants';

Notifications.setNotificationHandler({
    handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
    }),
});

async function getExpoTokenAndSendToServer() {
    try {
        const projectId = Constants.expoConfig?.extra?.eas?.projectId;
        if (!projectId) throw new Error("Falta el projectId en la configuración de Expo.");
        
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
    if (!Device.isDevice) {
        throw new Error('Las notificaciones push solo funcionan en dispositivos físicos.');
    }

    // 1. Configuración OBLIGATORIA para Android
    if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.MAX,
            vibrationPattern: [0, 250, 250, 250],
            lightColor: '#FF231F7C',
        });
    }

    // 2. Revisar permisos existentes
    let { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // 3. Si no está determinado, pedir permiso
    if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
    }

    // 4. Si el usuario denegó, salir
    if (finalStatus !== 'granted') {
        return { status: 'denied', token: null };
    }

    // 5. Obtener token y enviar
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

};

    

export default notificationService;