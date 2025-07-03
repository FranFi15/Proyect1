import React, { createContext, useState, useContext, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService.js';
import { useGym } from './GymContext.jsx';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [userInfo, setUserInfo] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();
    const { gymIdentifier, gymUrlIdentifier, clearGymInfo } = useGym();

    useEffect(() => {
        const user = authService.getCurrentUser();
        if (user) { setUserInfo(user); }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        if (!gymIdentifier) throw new Error("No se ha identificado el gimnasio.");
        
        const data = await authService.login({ email, password }, gymIdentifier);
        setUserInfo(data);
        // Navegamos al dashboard con la URL correcta
        navigate(`/gym/${gymUrlIdentifier}/dashboard`);
    };

    const logout = () => {
        authService.logout();
        setUserInfo(null);
        clearGymInfo();
        navigate('/'); // Al cerrar sesión, volvemos a la raíz (página de identificación)
    };

    const value = { userInfo, loading, login, logout };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
