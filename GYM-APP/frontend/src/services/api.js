import axios from 'axios';

const api = axios.create({
    baseURL: '/api', // O la URL completa de tu backend GYM-APP
});

// --- INTERCEPTOR CLAVE ---
// Este interceptor se ejecuta ANTES de cada petición.
api.interceptors.request.use(
    (config) => {
        // 1. Añadimos el token de autenticación del usuario si existe.
        const userInfo = JSON.parse(localStorage.getItem('userInfo'));
        if (userInfo && userInfo.token) {
            config.headers['Authorization'] = `Bearer ${userInfo.token}`;
        }

        // 2. Añadimos el identificador del gimnasio en una cabecera personalizada.
        const gymIdentifier = localStorage.getItem('gymIdentifier');
        if (gymIdentifier) {
            // El backend leerá esta cabecera en el gymTenantMiddleware.
            config.headers['x-gym-id'] = gymIdentifier;
        } else {
            // Si no hay identificador (excepto para login/registro), podríamos querer cancelar la petición.
            // Por ahora, lo dejamos pasar, pero el backend debería rechazarla si es necesario.
            console.warn('Petición realizada sin un x-gym-id.');
        }
        
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default api;
