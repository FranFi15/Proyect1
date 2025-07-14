// src/pages/Auth/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom'; // No longer need useParams
import { useAuth } from '../../contexts/AuthContext'; // Import useAuth hook
import '../../styles/Auth.css';

function LoginPage() {
    const navigate = useNavigate();
    // Removed useParams as gymIdentifier is now managed by AuthContext
    const { login, gymName, gymLogo, gymUrlIdentifier } = useAuth(); 

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        // Redirect if gymUrlIdentifier is not set in context
        if (!gymUrlIdentifier) {
            navigate('/'); // Go back to gym identifier page
        }
    }, [gymUrlIdentifier, navigate]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!gymUrlIdentifier) {
            setError("No se puede iniciar sesión sin un identificador de gimnasio.");
            // This error should ideally be caught by the useEffect redirect, but good for a double check.
            return;
        }
        setError(null);
        setLoading(true);

        try {
            // Call the login function from AuthContext
            await login(email, password);
            navigate(`/gym/${gymUrlIdentifier}/dashboard`);

        } catch (err) {
            setError(err.message || 'Error al iniciar sesión. Verifica tus credenciales.');
            console.error('Error de login en LoginPage:', err);
        } finally {
            setLoading(false);
        }
    };

    if (!gymUrlIdentifier) {
        // Optionally render a loading state or nothing while redirecting
        return null; 
    }

    return (
        <div className="auth-container">
            <div className="auth-card">
                {gymLogo && <img src={gymLogo} alt="Gym Logo" className="auth-logo" />}
                <h2 className="auth-title">Iniciar Sesión</h2>
                {error && <p className="auth-error">{error}</p>}
                <form onSubmit={handleSubmit} className="auth-form" key={gymUrlIdentifier}>
                    <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input
                            type="email"
                            id="email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="auth-input"
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Contraseña:</label>
                        <input
                            type="password"
                            id="password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            required
                            className="auth-input"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
                <p className="auth-link-text">
                    ¿No tienes una cuenta? <span onClick={() => navigate(`/gym/${gymUrlIdentifier}/register`)} className="auth-link">Regístrate aquí</span>
                </p>
            </div>
        </div>
    );
}

export default LoginPage;