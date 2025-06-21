// src/pages/DashboardPage.jsx
import React, { useEffect, useState } from 'react';
import { useNavigate, Navigate } from 'react-router-dom';
import authService from '../services/authService';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios'; // Importar axios para fetching global

// Importar los componentes modulares
import ClientManagement from '../components/dashboard/ClientManagement';
import ClassTypeManagement from '../components/dashboard/ClassTypeManagement';
import ClassManagement from '../components/dashboard/ClassManagement';
import MetricsManagement from '../components/dashboard/MetricsDashboard';

import '../styles/Dashboard.css';

// URL base de tu backend de la app del gimnasio (para uso en DashboardPage)
const GYM_APP_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// Headers para peticiones autenticadas (reutilizado de otros componentes)
const getAuthHeaders = () => {
    const user = authService.getCurrentUser();
    if (user && user.token) {
        const clientId = import.meta.env.VITE_CLIENT_ID;
        const apiSecret = import.meta.env.VITE_API_SECRET;
        return {
            'x-client-id': clientId,
            'x-api-secret': apiSecret,
            'Authorization': `Bearer ${user.token}`
        };
    }
    return {};
};

// Componente para proteger rutas (mantener aquí si no está en App.jsx)
const PrivateRoute = ({ children, currentUser }) => {
    return currentUser ? children : <Navigate to="/login" />;
};


// ====================================================================================
// COMPONENTE PRINCIPAL DASHBOARD
// ====================================================================================

function DashboardPage() {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [activeSection, setActiveSection] = useState('clients'); // Estado para la sección activa

    // Estado centralizado para los tipos de clase
    const [classTypes, setClassTypes] = useState([]);

    // Función para obtener los tipos de clase (será pasada a componentes hijos)
    const fetchClassTypes = async () => {
        try {
            console.log('[DashboardPage] Fetching class types...');
            const response = await axios.get(`${GYM_APP_API_BASE_URL}/tipos-clase`, { headers: getAuthHeaders() });
            if (response.data && Array.isArray(response.data.tiposClase)) {
                setClassTypes(response.data.tiposClase);
                console.log('[DashboardPage] Class types fetched successfully:', response.data.tiposClase.length);
            } else {
                console.error('[DashboardPage] API for tipos-clase returned non-array data in .tiposClase property:', response.data);
                setClassTypes([]);
            }
        } catch (error) {
            console.error('[DashboardPage] Error al obtener tipos de clase:', error.response?.data?.message || error.message);
            setClassTypes([]);
        }
    };

    useEffect(() => {
        const currentUser = authService.getCurrentUser();

        if (currentUser && currentUser.token) {
            try {
                const decodedToken = jwtDecode(currentUser.token);
                setUserEmail(decodedToken.email || 'Email no disponible');
                setUserName(decodedToken.nombre || decodedToken.name || 'Usuario');

                // Llama a fetchClassTypes al montar el DashboardPage
                fetchClassTypes();

            } catch (e) {
                console.error("Error al decodificar el token JWT o token inválido:", e);
                setUserEmail('Usuario desconocido');
                setUserName('Desconocido');
                authService.logout();
                navigate('/login');
            }
        } else {
            console.log("No hay usuario logueado o token no disponible, redirigiendo a /login.");
            navigate('/login');
        }
    }, [navigate]); // Dependencias de useEffect

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    return (
        <div className="dashboard-layout">
            <nav className="dashboard-sidebar">
                <h1 className="sidebar-title">GYM ADMIN</h1>
                <div className="sidebar-user-info">
                    <span>Bienvenido,</span>
                    <strong>{userName || userEmail}</strong>
                </div>
                <ul className="sidebar-menu">
                    <li className={activeSection === 'clients' ? 'active' : ''} onClick={() => setActiveSection('clients')}>
                        Gestionar Socios
                    </li>
                    <li className={activeSection === 'class-types' ? 'active' : ''} onClick={() => setActiveSection('class-types')}>
                        Gestionar Tipos de Clase
                    </li>
                    <li className={activeSection === 'classes' ? 'active' : ''} onClick={() => setActiveSection('classes')}>
                        Gestionar Clases
                    </li>
                    <li className={activeSection === 'metrics' ? 'active' : ''} onClick={() => setActiveSection('metrics')}>
                        Ver Métricas
                    </li>
                </ul>
                <button onClick={handleLogout} className="logout-button sidebar-logout">Cerrar Sesión</button>
            </nav>

            <main className="dashboard-main-content">
                <header className="dashboard-header">
                    <h2>{
                        activeSection === 'clients' ? 'Gestión de Socios' :
                        activeSection === 'class-types' ? 'Gestión de Tipos de Clase' :
                        activeSection === 'classes' ? 'Gestión de Clases' :
                        activeSection === 'metrics' ? 'Métricas del Gimnasio' : 'Dashboard'
                    }</h2>
                </header>
                <div className="dashboard-content-area">
                    {/* Pasa classTypes y fetchClassTypes a ClientManagement */}
                    {activeSection === 'clients' && <ClientManagement classTypes={classTypes} fetchClassTypes={fetchClassTypes} />}
                    {/* Pasa classTypes y fetchClassTypes a ClassTypeManagement */}
                    {activeSection === 'class-types' && <ClassTypeManagement classTypes={classTypes} fetchClassTypes={fetchClassTypes} />}
                    {/* Pasa classTypes y fetchClassTypes a ClassManagement */}
                    {activeSection === 'classes' && <ClassManagement classTypes={classTypes} fetchClassTypes={fetchClassTypes} />}
                    {activeSection === 'metrics' && <MetricsManagement />}
                </div>
            </main>
        </div>
    );
}

export default DashboardPage;
