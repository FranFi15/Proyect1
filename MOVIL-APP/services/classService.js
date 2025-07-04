// MOVIL-APP/services/classService.js
import apiClient from './apiClient'; // Ensure apiClient is your configured axios instance for MOVIL-APP

const classService = {
    
    getAllClasses: async () => {
        try {
            const response = await apiClient.get('/classes'); 
            return response.data;
        } catch (error) {
            console.error('Error fetching all classes:', error);
            throw error.response?.data?.message || 'Error al obtener todas las clases.';
        }
    },

    
    getClassById: async (classId) => {
        try {
            const response = await apiClient.get(`/classes/${classId}`);
            return response.data;
        } catch (error) {
            console.error(`Error fetching class by ID (${classId}):`, error);
            throw error.response?.data?.message || 'Error al obtener clase por ID.';
        }
    },

   
    requestSpotNotification: async (classId) => {
        try {
            const response = await apiClient.post(`/classes/${classId}/request-spot-notification`);
            return response.data;
        } catch (error) {
            console.error(`Error requesting spot notification for class ${classId} (MOVIL-APP):`, error);
            throw error.response?.data?.message || 'Error al solicitar notificación de lugar.';
        }
    },
   
};

export default classService;