// services/apiClient.js
import axios from 'axios';
import authService from './authService';

const API_URL = 'http://192.168.0.109:5000/api'; // URL de tu GYM-APP backend

const apiClient = axios.create({
  baseURL: API_URL,
});

// Interceptor para añadir automáticamente los headers a cada petición
// Esta lógica es idéntica a la de tu frontend web
apiClient.interceptors.request.use(
  async (config) => {
    const user = await authService.getCurrentUser();
    if (user && user.token) {
      // Adjunta el token para la autenticación
      config.headers.Authorization = `Bearer ${user.token}`;
      // Adjunta el clientId para identificar al gimnasio en el middleware del backend
      config.headers['x-client-id'] = user.clientId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;