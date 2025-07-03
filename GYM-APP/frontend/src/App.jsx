import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './contexts/AuthContext.jsx';

// Páginas
import GymIdentifierPage from './pages/Auth/GymIdentifierPage';
import LoginPage from './pages/Auth/LoginPage';
import RegisterPage from './pages/Auth/RegisterPage';
import DashboardPage from './pages/DashboardPage';

// Componentes de Lógica
import PrivateRoute from './components/common/PrivateRoute.jsx';

function App() {
  const { userInfo } = useAuth();

  return (
    <Routes>
      {/* La ruta raíz ahora es la página de identificación */}
      {/* Si el usuario ya está logueado, lo mandamos al dashboard */}
      <Route 
        path="/" 
        element={userInfo ? <Navigate to="/dashboard" /> : <GymIdentifierPage />} 
      />

      {/* Rutas públicas que no requieren autenticación */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />

      {/* Envolvemos las rutas protegidas con PrivateRoute */}
      <Route element={<PrivateRoute />}>
        <Route path="/dashboard" element={<DashboardPage />} />
        {/* Aquí puedes añadir más rutas protegidas, ej: /profile */}
      </Route>

      {/* Cualquier otra ruta no definida redirige a la raíz */}
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
