// GYM-APP/frontend/src/components/common/PrivateRoute.jsx
import React from 'react';
import { Navigate, Outlet, useParams } from 'react-router-dom'; // Import useParams
import { useAuth } from '../../contexts/AuthContext.jsx';

const PrivateRoute = () => {
    const { userInfo } = useAuth();
    const { gymIdentifier } = useParams(); // Get the gymIdentifier from the URL parameters

    // If the user is not authenticated:
    if (!userInfo) {
        return <Navigate to={gymIdentifier ? `/gym/${gymIdentifier}/login` : "/"} replace />;
    }

    return <Outlet />;
};

export default PrivateRoute;