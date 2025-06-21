// superadmin-frontend/src/services/adminCreationService.js
import axios from 'axios';

const API_URL = 'http://localhost:8080/api/admin'; // Asegúrate de que el puerto sea el correcto

const createTempAdmin = async (email, password, role = 'superadmin') => {
    try {
        const response = await axios.post(`${API_URL}/create-temp-admin`, { email, password, role });
        return response.data;
    } catch (error) {
        // Mejor manejo de errores, puede que el backend devuelva un objeto de error
        throw error.response?.data?.message || error.message || 'Error al crear el administrador.';
    }
};

const adminCreationService = {
    createTempAdmin
};

export default adminCreationService;