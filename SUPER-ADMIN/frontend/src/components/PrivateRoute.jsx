// src/components/PrivateRoute.jsx
import React from 'react';
import { Navigate } from 'react-router-dom';
import authService from '../services/authService';

const PrivateRoute = ({ children }) => {
    // Verifica si hay un token de superadmin en el localStorage
    const isAuthenticated = authService.getToken();

    if (!isAuthenticated) {
        // Si no está autenticado, redirige a la página de login
        return <Navigate to="/login" />;
    }

    // Si está autenticado, renderiza los componentes hijos (la ruta protegida)
    return children;
};

export default PrivateRoute;