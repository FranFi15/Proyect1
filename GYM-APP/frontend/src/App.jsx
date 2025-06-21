// src/App.jsx
import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import authService from './services/authService';

const PrivateRoute = ({ children, currentUser }) => {
    return currentUser ? children : <Navigate to="/" />;
};

function App() {
    const [currentUser, setCurrentUser] = useState(authService.getCurrentUser());

    useEffect(() => {
        const handleAuthChange = () => {
            setCurrentUser(authService.getCurrentUser());
        };
        window.addEventListener('authChange', handleAuthChange);
        return () => {
            window.removeEventListener('authChange', handleAuthChange);
        };
    }, []);

    return (
        <Router>
            <Routes>
                {/* Rutas dinámicas que capturan el identificador del gimnasio */}
                <Route path="/gym/:gymIdentifier/login" element={<LoginPage />} />
                <Route path="/gym/:gymIdentifier/register" element={<RegisterPage />} />

                <Route
                    path="/dashboard"
                    element={
                        <PrivateRoute currentUser={currentUser}>
                            <DashboardPage />
                        </PrivateRoute>
                    }
                />
                
                <Route path="/" element={
                    <div style={{ textAlign: 'center', paddingTop: '50px', fontFamily: 'Arial, sans-serif' }}>
                        <h1>Bienvenido al Sistema de Gestión de Gimnasios</h1>
                        <p>Por favor, accede a través de la URL proporcionada por tu gimnasio.</p>
                    </div>
                } />

                <Route path="*" element={<Navigate to="/" />} />
            </Routes>
        </Router>
    );
}

export default App;