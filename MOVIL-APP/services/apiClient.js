// Archivo: MOVIL-APP/services/apiClient.js
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import config from '../config';
import { triggerSessionExpired, isEventBlocked   } from './sessionEvent';

const baseURL = config.gymAppBackend;

const apiClient = axios.create({
    baseURL: baseURL,
});

let isLoggingOut = false;

// Interceptor para añadir el token de autorización y el tenant del gym
apiClient.interceptors.request.use(
    async (requestConfig) => {
        requestConfig.headers = requestConfig.headers || {};

        const [userString, storedClientId] = await Promise.all([
            AsyncStorage.getItem('user'),
            AsyncStorage.getItem('clientId'),
        ]);

        if (userString) {
            try {
                const user = JSON.parse(userString);
                if (user?.token) {
                    requestConfig.headers.Authorization = `Bearer ${user.token}`;
                }
            } catch (e) {
                console.warn('No se pudo parsear el usuario guardado para Authorization');
            }
        }

        // Always attach tenant header from storage so polling/hot-reload
        // never race AuthContext defaults.
        if (storedClientId) {
            requestConfig.headers['x-client-id'] = storedClientId;
        }

        return requestConfig;
    },
    (error) => {
        return Promise.reject(error);
    }
);

apiClient.interceptors.response.use(
    (response) => response,
    async (error) => {
        if (error.response && error.response.status === 401) {
            const requestUrl = String(error.config?.url || '');
            // Failed login/register are expected 401s — not an expired session.
            const isAuthCredentialRequest =
                requestUrl.includes('/auth/login') ||
                requestUrl.includes('/auth/register');

            if (isAuthCredentialRequest) {
                return Promise.reject(error);
            }

            // Si ya se disparó la alerta, no hacemos nada más que rechazar
            if (isLoggingOut || isEventBlocked) {
                return Promise.reject(error);
            }
            isLoggingOut = true;
            console.log("⛔ Sesión expirada. Disparando evento...");
            triggerSessionExpired();
            // Allow future 401 handling after the session flow settles
            setTimeout(() => {
                isLoggingOut = false;
            }, 5000);
            return Promise.reject(new Error("SESSION_EXPIRED"));
        }
        return Promise.reject(error);
    }
);

export default apiClient;
