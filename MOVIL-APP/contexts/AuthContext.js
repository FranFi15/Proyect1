// contexts/AuthContext.js
import React, { createContext, useState, useContext, useEffect } from 'react';
import authService from '../services/authService';

// 1. Creamos el contexto aquí, en su propio archivo.
const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true); // Empezamos cargando

  // 2. useEffect para verificar el usuario al iniciar la app
  useEffect(() => {
    const checkStoredUser = async () => {
      try {
        const storedUser = await authService.getCurrentUser();
        if (storedUser) {
          setUser(storedUser);
        }
      } catch (e) {
        console.error("No se pudo verificar el usuario guardado", e);
      } finally {
        setLoading(false); // Terminamos de cargar
      }
    };
    checkStoredUser();
  }, []);

  const login = async (credentials, gymIdentifier) => {
    if (!credentials.email || !credentials.contraseña) {
        setUser(credentials);
        return credentials;
    }
    const userData = await authService.login(credentials, gymIdentifier);
    setUser(userData);
    return userData;
  };
  const logout = async () => {
    await authService.logout();
    setUser(null);
  };
  
  const refreshUser = async () => {
    console.log("Refrescando datos del usuario desde la API...");
    try {
        const userData = await authService.getMe(); 
        if (userData) {
            setUser(userData);
        }
    } catch (error) {
        console.error("No se pudo refrescar la información del usuario:", error);
    }
};

  return (
    // 3. Usamos el AuthContext que definimos arriba
    <AuthContext.Provider value={{ user, login, logout, isLoading: loading, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

// Hook personalizado para no tener que importar useContext y AuthContext en cada archivo
export const useAuth = () => {
  return useContext(AuthContext);
};