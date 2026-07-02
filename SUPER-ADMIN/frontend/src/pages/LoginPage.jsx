// src/pages/LoginPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import authService from '../services/authService';
import '../styles/LoginPage.css'

function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState(''); // Variable 'password' para la contraseña
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);
        try {
            await authService.login(email, password);
            navigate('/clients');
        } catch (err) {
            setError(err || 'Error de inicio de sesión. Credenciales inválidas.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-wrapper">
            <div className="login-container glass-panel">
                <div className="login-header">
                    <h1 className="login-title">Super Admin</h1>
                    <p className="login-subtitle">Inicia sesión en tu cuenta para continuar</p>
                </div>
                
                <form onSubmit={handleSubmit} className="login-form">
                    {error && <p className="login-error">{error}</p>}
                    
                    <div className="login-form-group">
                        <label htmlFor="email" className="login-label">Correo Electrónico</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="modern-input"
                            placeholder="tucorreo@ejemplo.com"
                        />
                    </div>
                    
                    <div className="login-form-group">
                        <label htmlFor="password-input" className="login-label">Contraseña</label>
                        <input
                            type="password"
                            id="password-input"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="modern-input"
                            placeholder="••••••••"
                        />
                    </div>
                    
                    <button type="submit" disabled={loading} className="btn-primary" style={{ marginTop: '0.5rem' }}>
                        {loading ? 'Iniciando sesión...' : 'Ingresar al sistema'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default LoginPage;