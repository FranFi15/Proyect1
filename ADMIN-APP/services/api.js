import axios from 'axios';
import { getItem } from './storageService';

const apiClient = axios.create({
  baseURL: 'http://192.168.0.118:5000/api', // Reemplazar con tu URL de producción
});

apiClient.interceptors.request.use(
  async (config) => {
    const token = await getItem('admin_token');
    const clientId = await getItem('client_id');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    if (clientId) {
      config.headers['x-client-id'] = clientId;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default apiClient;