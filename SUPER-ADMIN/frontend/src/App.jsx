// src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import CreateAdminPage from './pages/CreateAdminPage'; // Asegúrate de que la ruta sea correcta
import LoginPage from './pages/LoginPage';
import ClientsListPage from './pages/ClientsListPage';
import ClientCreateEditPage from './pages/ClientCreateEditPage';
import PrivateRoute from './components/PrivateRoute'; // Importa el nuevo componente PrivateRoute
import './styles/global.css'; // Asegúrate de que tus estilos globales estén importados

function App() {
    return (
        <Router>
            <Routes>
                <Route path="/" element={<Navigate to="/clients" />} />
                <Route path="/login" element={<LoginPage />} />
                <Route path="/create-admin" element={<CreateAdminPage />} /> 
                <Route path="/clients" element={<PrivateRoute><ClientsListPage /></PrivateRoute>}/>
                <Route path="/clients/new" element={<PrivateRoute><ClientCreateEditPage /></PrivateRoute>}/>
                <Route  path="/clients/:id/edit" element={<PrivateRoute><ClientCreateEditPage /></PrivateRoute>}/>
            </Routes>
        </Router>
    );
}

export default App;