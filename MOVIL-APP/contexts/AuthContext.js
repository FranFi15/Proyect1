import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';
import notificationService from '../services/notificationService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiClient from '../services/apiClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [clientId, setClientId] = useState(null);
    const [gymName, setGymName] = useState(null);
    const [gymLogo, setGymLogo] = useState(null);
    const [gymColor, setGymColor] = useState('#150224'); // Color por defecto
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const checkInitialState = async () => {
            try {
                const storedClientId = await AsyncStorage.getItem('clientId');
                const storedGymName = await AsyncStorage.getItem('gymName');
                const storedGymLogo = await AsyncStorage.getItem('gymLogo');
                const storedGymColor = await AsyncStorage.getItem('gymColor'); // Cargar color
                const storedUser = await authService.getCurrentUser();

                if (storedGymName) setGymName(storedGymName);
                if (storedGymLogo) setGymLogo(storedGymLogo);
                if (storedGymColor) setGymColor(storedGymColor); // Establecer color

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

    const setGymContext = async (data) => {
        try {
            await AsyncStorage.setItem('clientId', data.clientId);
            await AsyncStorage.setItem('gymName', data.gymName);
            await AsyncStorage.setItem('gymLogo', data.logoUrl || '');
            await AsyncStorage.setItem('gymColor', data.primaryColor || '#150224'); // Guardar color
            
            setClientId(data.clientId);
            setGymName(data.gymName);
            setGymLogo(data.logoUrl || '');
            setGymColor(data.primaryColor || '#150224'); // Establecer color

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
            await notificationService.registerForPushNotificationsAsync();
        } else {
            throw new Error('La respuesta del servidor no fue válida.');
        }
        return userData;
    };

    const logout = async () => {
        try {
            await authService.logout();
            await AsyncStorage.multiRemove(['clientId', 'gymName', 'gymLogo', 'user', 'gymColor']); // Limpiar color
            
            setUser(null);
            setClientId(null);
            setGymName(null);
            setGymLogo(null);
            setGymColor('#150224'); // Resetear a color por defecto
            
            delete apiClient.defaults.headers.common['Authorization'];
            delete apiClient.defaults.headers.common['x-client-id'];
        } catch (error) {
            console.error('[AuthContext] Error durante el logout:', error);
        }
    };

    const refreshUser = async () => {
        try {
            const updatedUserData = await authService.getMe();
            if (updatedUserData) {
                if (JSON.stringify(user) !== JSON.stringify(updatedUserData)) {
                    setUser(updatedUserData);
                }
            } else if (user) {
                await logout();
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
                await notificationService.registerForPushNotificationsAsync();
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
        <AuthContext.Provider value={{ user, clientId, gymName, gymLogo, gymColor, loading, login, logout, refreshUser, register, setGymContext }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
