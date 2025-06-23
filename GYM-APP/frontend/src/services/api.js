import axios from 'axios';
import authService from './authService';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

const apiClient = axios.create({
  baseURL: API_URL,
});

// Interceptor para añadir automáticamente los headers a cada petición
apiClient.interceptors.request.use(
  (config) => {
    const user = authService.getCurrentUser();
    if (user && user.token) {
      // Adjuntamos el token para la autenticación
      config.headers.Authorization = `Bearer ${user.token}`;
      // Adjuntamos el clientId para identificar al gimnasio
      config.headers['x-client-id'] = user.clientId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;