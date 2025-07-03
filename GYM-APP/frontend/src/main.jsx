import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router } from 'react-router-dom'; // 1. Importamos el Router aquí
import App from './App.jsx';
import { GymProvider } from './contexts/GymContext.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import './App.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router>
      <GymProvider>
        <AuthProvider>
          <App />
        </AuthProvider>
      </GymProvider>
    </Router>
  </React.StrictMode>,
);
