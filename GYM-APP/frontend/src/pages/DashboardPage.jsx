import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import { jwtDecode } from 'jwt-decode';

// --- PASO 1: IMPORTAMOS apiClient EN LUGAR DE axios ---
import apiClient from '../services/api'; 

// Importar los componentes modulares
import ClientManagement from '../components/dashboard/ClientManagement';
import ClassTypeManagement from '../components/dashboard/ClassTypeManagement';
import ClassManagement from '../components/dashboard/ClassManagement';
import MetricsManagement from '../components/dashboard/MetricsDashboard';

import '../styles/Dashboard.css';
import NotificationAdminPage from '../components/dashboard/NotificationAdmin';

// --- PASO 2: HEMOS ELIMINADO getAuthHeaders() y GYM_APP_API_BASE_URL PORQUE YA NO SON NECESARIOS ---
// El apiClient se encarga de todo eso automáticamente.


function DashboardPage() {
    const navigate = useNavigate();
    const [userEmail, setUserEmail] = useState('');
    const [userName, setUserName] = useState('');
    const [activeSection, setActiveSection] = useState('clients');

    const [classTypes, setClassTypes] = useState([]);

    const fetchClassTypes = async () => {
        try {
            
            
            // --- PASO 3: LA PETICIÓN AHORA ES MÁS SIMPLE Y USA apiClient ---
            // Ya no necesita headers manuales, apiClient los añade por nosotros.
            const response = await apiClient.get('/tipos-clase');
            
            if (response.data && Array.isArray(response.data.tiposClase)) {
                setClassTypes(response.data.tiposClase);
                
            } else {
                console.error('[DashboardPage] API for tipos-clase returned non-array data:', response.data);
                setClassTypes([]);
            }
        } catch (error) {
            console.error('[DashboardPage] Error al obtener tipos de clase:', error.response?.data?.message || error.message);
            setClassTypes([]);
        }
    };

    useEffect(() => {
        const currentUser = authService.getCurrentUser();
        if (!currentUser || !currentUser.token) {
            console.log("No hay usuario logueado, redirigiendo.");
            navigate('/login'); // Redirige si no hay usuario
            return; // Detiene la ejecución del efecto
        }

        try {
            const decodedToken = jwtDecode(currentUser.token);
            setUserEmail(decodedToken.email || 'Email no disponible');
            setUserName(decodedToken.nombre || 'Usuario');
            fetchClassTypes();
        } catch (e) {
            console.error("Token inválido:", e);
            authService.logout();
            navigate('/login');
        }
    }, [navigate]);

    const handleLogout = () => {
        authService.logout();
        navigate('/');
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
                    <li className={activeSection === 'notification' ? 'active' : ''} onClick={() => setActiveSection('notification')}>
                        Gestión de Notificaciones
                    </li>
                    <li className={activeSection === 'metrics' ? 'active' : ''} onClick={() => setActiveSection('metrics')}>
                        Métricas
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
                        activeSection === 'notification' ? 'Gestión de Notificaciones' : 'Dashboard'
                    }</h2>
                </header>
                <div className="dashboard-content-area">
                    {activeSection === 'clients' && <ClientManagement classTypes={classTypes} fetchClassTypes={fetchClassTypes} />}
                    {activeSection === 'class-types' && <ClassTypeManagement classTypes={classTypes} fetchClassTypes={fetchClassTypes} />}
                    {activeSection === 'classes' && <ClassManagement classTypes={classTypes} fetchClassTypes={fetchClassTypes} />}
                    {activeSection === 'metrics' && <MetricsManagement />}
                    {activeSection === 'notification' && <NotificationAdminPage/>}
                </div>
            </main>
        </div>
    );
}

export default DashboardPage;