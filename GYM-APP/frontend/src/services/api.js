// Example of how to modify your api.js (or apiClient.js if you have one)
import axios from 'axios';

const api = axios.create({
    baseURL: 'http://localhost:5000/api'
});

// Interceptor to add the x-client-id header
api.interceptors.request.use(async (config) => {
    const clientId = sessionStorage.getItem('clientId');
    if (clientId) {
        config.headers['x-client-id'] = clientId;
    }

     const user = localStorage.getItem('user'); 
    if (user) {
        const parsedUser = JSON.parse(user);
        if (parsedUser.token) { 
            config.headers['Authorization'] = `Bearer ${parsedUser.token}`;
        }
    }

    return config;
}, (error) => {
    return Promise.reject(error);
});

export default api;