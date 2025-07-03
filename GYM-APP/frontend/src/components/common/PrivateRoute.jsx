import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext.jsx';

const PrivateRoute = () => {
    const { userInfo } = useAuth();

    // Si hay información del usuario, permite el acceso a la ruta hija (Outlet).
    // Si no, redirige a la página de login.
    return userInfo ? <Outlet /> : <Navigate to="/login" replace />;
};

export default PrivateRoute;