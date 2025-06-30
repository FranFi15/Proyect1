import React, { createContext, useState, useContext, useEffect } from 'react';
import { saveItem, getItem, deleteItem } from '../services/storageService';
import apiClient from '../services/api';

const AdminAuthContext = createContext();

export const AdminAuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [clientId, setClientId] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const loadUserFromStorage = async () => {
      try {
        const storedToken = await getItem('admin_token');
        const storedClientId = await getItem('client_id');
        if (storedToken && storedClientId) {
          setUser({ token: storedToken }); 
          setClientId(storedClientId);
        }
      } catch (e) {
        console.error("Failed to load auth state.", e);
      } finally {
        setIsLoading(false);
      }
    };

    loadUserFromStorage();
  }, []);
  
  const register = async (userData) => {
    const storedClientId = await getItem('client_id');
    if (!storedClientId) {
        throw new Error("Client ID no encontrado. Por favor, identifique el gimnasio primero.");
    }
    const response = await apiClient.post('/auth/register', userData);
    const { token, user: registeredUser } = response.data;

    if (registeredUser.role !== 'admin') {
      throw new Error('Solo los administradores pueden registrarse aquí. Ya existe un administrador para este gimnasio.');
    }

    await saveItem('admin_token', token);
    setUser(registeredUser);
    return registeredUser;
  };

  const login = async (email, password) => {
    const storedClientId = await getItem('client_id');
     if (!storedClientId) {
        throw new Error("Client ID no encontrado. Por favor, identifique el gimnasio primero.");
    }
    const response = await apiClient.post('/auth/login', { email, password });
    const { token, user: userData } = response.data;
    
    if (userData.role !== 'admin') {
        await deleteItem('admin_token');
        throw new Error('Las credenciales proporcionadas no pertenecen a un administrador.');
    }
    
    await saveItem('admin_token', token);
    setUser(userData);
    return userData;
  };

  const logout = async () => {
    await deleteItem('admin_token');
    await deleteItem('client_id');
    setUser(null);
    setClientId(null);
  };
  
  const setGymClient = async (id) => {
      await saveItem('client_id', id);
      setClientId(id);
  }

  return (
    <AdminAuthContext.Provider value={{ user, clientId, isLoading, login, logout, register, setGymClient }}>
      {children}
    </AdminAuthContext.Provider>
  );
};

export const useAdminAuth = () => useContext(AdminAuthContext);