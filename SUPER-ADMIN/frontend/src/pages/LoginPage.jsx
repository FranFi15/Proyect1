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
        <div className="login-container"> {/* Aplica la clase CSS */}
            <h1 className="login-title">Iniciar Sesión</h1> {/* Aplica la clase CSS */}
            <form onSubmit={handleSubmit} className="login-form"> {/* Aplica la clase CSS */}
                {error && <p className="login-error">{error}</p>} {/* Aplica la clase CSS */}
                <div className="login-form-group"> {/* Aplica la clase CSS */}
                    <label htmlFor="email" className="login-label">Email:</label> {/* Aplica la clase CSS */}
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="login-input" // Aplica la clase CSS
                    />
                </div>
                <div className="login-form-group"> {/* Aplica la clase CSS */}
                    <label htmlFor="password-input" className="login-label">Contraseña:</label> {/* Aplica la clase CSS */}
                    <input
                        type="password"
                        id="password-input" // Cambia el ID para evitar conflictos si usas 'password' en otro lado
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="login-input" // Aplica la clase CSS
                    />
                </div>
                <button type="submit" disabled={loading} className="login-button"> {/* Aplica la clase CSS */}
                    {loading ? 'Iniciando...' : 'Iniciar Sesión'}
                </button>
            </form>
        </div>
    );
}

export default LoginPage;