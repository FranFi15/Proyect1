// MOVIL-APP/contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/apiClient'; // Ensure this path is correct

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [clientId, setClientId] = useState(null);
    const [gymName, setGymName] = useState(null);
    const [gymLogo, setGymLogo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkInitialState = async () => {
            try {
                const storedClientId = await AsyncStorage.getItem('clientId');
                const storedGymName = await AsyncStorage.getItem('gymName');
                const storedGymLogo = await AsyncStorage.getItem('gymLogo');
                const storedUser = await authService.getCurrentUser();

                if (storedGymName) setGymName(storedGymName);
                if (storedGymLogo) setGymLogo(storedGymLogo);

                if (storedClientId) {
                    setClientId(storedClientId);
                    apiClient.defaults.headers.common['x-client-id'] = storedClientId;
                }
                if (storedUser) {
                    setUser(storedUser);
                }
            } catch (e) {
                console.error("No se pudo verificar el estado inicial", e);
            } finally {
                setLoading(false);
            }
        };
        checkInitialState();
    }, []);

    useEffect(() => {
        // This log helps debug, but doesn't cause the loop itself if user object reference is stable
        console.log('[AuthContext] El estado del usuario ha cambiado:', user ? `Usuario logueado: ${user.email}` : 'Usuario es null');
    }, [user]);

    const setGymContext = async (data) => {
        try {
            await AsyncStorage.setItem('clientId', data.clientId);
            await AsyncStorage.setItem('gymName', data.gymName);
            await AsyncStorage.setItem('gymLogo', data.logoUrl || '');
            
            setClientId(data.clientId);
            setGymName(data.gymName);
            setGymLogo(data.logoUrl || '');

            apiClient.defaults.headers.common['x-client-id'] = data.clientId;
        } catch (error) {
            console.error("Error guardando el contexto del gym", error);
            throw error;
        }
    };

    const login = async (credentials) => {
        const userData = await authService.login(credentials);
        if (userData && userData.token) {
            setUser(userData);
        } else {
            throw new Error('La respuesta del servidor no fue válida.');
        }
        return userData;
    };

    const logout = async () => {
        try {
            await authService.logout();
            // Clear all relevant AsyncStorage items, including 'user'
            await AsyncStorage.multiRemove(['clientId', 'gymName', 'gymLogo', 'user']); 
            
            setUser(null);
            setClientId(null);
            setGymName(null);
            setGymLogo(null);
            
            // Clear Axios default headers
            delete apiClient.defaults.headers.common['Authorization'];
            delete apiClient.defaults.headers.common['x-client-id'];
            
            console.log('[AuthContext] Sesión cerrada exitosamente.');
        } catch (error) {
            console.error('[AuthContext] Error durante el logout:', error);
        }
    };

    // --- CRITICAL FIX FOR INFINITE LOOP: Stabilize user object update ---
    const refreshUser = async () => {
        try {
            const updatedUserData = await authService.getMe(); // Call backend to get fresh user data
            
            // Only update user state if the content actually changed or if user was null
            // Compare JSON strings for a deep content comparison
            if (updatedUserData) { // If there's new data
                if (JSON.stringify(user) !== JSON.stringify(updatedUserData)) {
                    setUser(updatedUserData);
                }
            } else if (user) { // If updatedUserData is null/undefined but user was previously logged in
                console.log('[AuthContext] User data refresh returned null. Forcing logout.');
                await logout(); // Force logout if user data disappears from backend
            }
        } catch (error) {
            console.error('[AuthContext] No se pudo refrescar la información del usuario:', error);
            // If 401 (Unauthorized), it means the token is expired/invalid, so force logout
            if (error.response && error.response.status === 401) {
                console.log('[AuthContext] Token expired or invalid during refresh. Forcing logout.');
                await logout();
            } else if (error.message.includes('Network Error')) {
                console.warn('[AuthContext] Network error during refresh. User might be offline.');
                // Don't necessarily logout, but user state might be stale
            }
        }
    };
    // --- END CRITICAL FIX ---

    const register = async (userData) => {
        try {
            const newUserData = await authService.register(userData);
            if (newUserData && newUserData.token) {
                setUser(newUserData);
            } else {
                throw new Error('El registro fue exitoso pero no se recibieron datos de usuario válidos.');
            }
            return newUserData;
        } catch (error) {
            console.error('[AuthContext] Error durante el registro:', error);
            throw error;
        }
    };

    return (
        <AuthContext.Provider value={{ user, clientId, gymName, gymLogo, loading, login, logout, refreshUser, register, setGymContext }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);