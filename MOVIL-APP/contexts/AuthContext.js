import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [clientId, setClientId] = useState(null);
    // --- ESTADOS ACTUALIZADOS ---
    // Reemplazamos gymIdentifier por gymName y añadimos gymLogo
    const [gymName, setGymName] = useState(null);
    const [gymLogo, setGymLogo] = useState(null);
    // --- FIN DE ESTADOS ACTUALIZADOS ---
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkInitialState = async () => {
            try {
                // Cargamos todos los datos de sesión desde el almacenamiento
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
        console.log('[AuthContext] El estado del usuario ha cambiado:', user ? `Usuario logueado: ${user.email}` : 'Usuario es null');
    }, [user]);

    // --- FUNCIÓN ACTUALIZADA ---
    // Ahora acepta un objeto 'data' con toda la información del gimnasio
    const setGymContext = async (data) => {
        try {
            await AsyncStorage.setItem('clientId', data.clientId);
            await AsyncStorage.setItem('gymName', data.gymName);
            await AsyncStorage.setItem('gymLogo', data.logoUrl || ''); // Guardamos '' si no viene

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

    // --- FUNCIÓN LOGOUT ACTUALIZADA ---
    const logout = async () => {
        try {
            await authService.logout();
            await AsyncStorage.multiRemove(['clientId', 'gymName', 'gymLogo']);
            
            setUser(null);
            setClientId(null);
            setGymName(null);
            setGymLogo(null);
            
            delete apiClient.defaults.headers.common['Authorization'];
            delete apiClient.defaults.headers.common['x-client-id'];
            
            console.log('[AuthContext] Sesión cerrada exitosamente.');
        } catch (error) {
            console.error('[AuthContext] Error durante el logout:', error);
        }
    };

    const refreshUser = async () => {
        try {
            const updatedUserData = await authService.getMe();
            if (updatedUserData) {
                setUser(updatedUserData);
            }
        } catch (error) {
            console.error('[AuthContext] No se pudo refrescar la información del usuario:', error);
            if (error.response && error.response.status === 401) {
                await logout();
            }
        }
    };

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
        // --- PROVEEDOR ACTUALIZADO ---
        <AuthContext.Provider value={{ 
            user, clientId, gymName, gymLogo, loading, 
            login, logout, refreshUser, register, setGymContext 
        }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);