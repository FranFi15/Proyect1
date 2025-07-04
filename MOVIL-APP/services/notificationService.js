// MOVIL-APP/services/notificationService.js
import apiClient from './apiClient'; // Assuming apiClient is your configured axios instance for MOVIL-APP

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
};

export default notificationService;