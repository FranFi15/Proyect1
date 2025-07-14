// MOVIL-APP/services/notificationService.js
import api from './api'; // Assuming apiClient is your configured axios instance for MOVIL-APP

const notificationService = {

    createNotification: async (payload) => { // Accept the full payload object
        try {
            const response = await api.post('/notifications', payload); // Send the payload as is
            return response.data;
        } catch (error) {
            console.error('Error creating notification:', error);
            throw error.response?.data?.message || 'Error al crear notificación.';
        }
    },
   
    getNotifications: async () => {
        try {
            const response = await api.get('/notifications/me');
            return response.data;
        } catch (error) {
            console.error('Error fetching notifications (MOVIL-APP):', error);
            throw error.response?.data?.message || 'Error al obtener notificaciones.';
        }
    },

    markNotificationAsRead: async (notificationId) => {
        try {
            const response = await api.put(`/notifications/${notificationId}/read`);
            return response.data;
        } catch (error) {
            console.error(`Error marking notification ${notificationId} as read (MOVIL-APP):`, error);
            throw error.response?.data?.message || 'Error al marcar notificación como leída.';
        }
    },

    markAllNotificationsAsRead: async () => {
        try {
            const response = await api.put('/notifications/mark-all-read');
            return response.data;
        } catch (error) {
            console.error('Error marking all notifications as read (MOVIL-APP):', error);
            throw error.response?.data?.message || 'Error al marcar todas las notificaciones como leídas.';
        }
    },
};

export default notificationService;