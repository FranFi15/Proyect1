// src/pages/Auth/LoginPage.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import authService from '../../services/authService';
import '../../styles/Auth.css';

function LoginPage() {
    const navigate = useNavigate();
    const { gymIdentifier } = useParams(); // Capturamos el identificador del gym de la URL

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (!gymIdentifier) {
            setError("URL inválida. No se ha especificado un identificador de gimnasio.");
        } else {
            setError(null);
        }
    }, [gymIdentifier]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!gymIdentifier) {
            setError("No se puede iniciar sesión sin un identificador de gimnasio en la URL.");
            return;
        }
        setError(null);
        setLoading(true);

        try {
            const credentials = {
                email,
                contraseña: password,
            };

            // Pasamos el identificador del gimnasio al servicio de autenticación
            await authService.login(credentials, gymIdentifier);

            navigate('/dashboard');
        } catch (err) {
            setError(err || 'Error al iniciar sesión. Verifica tus credenciales.');
            console.error('Error de login en LoginPage:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">Iniciar Sesión</h2>
                <h3 style={{color: '#555', marginTop: '-20px', marginBottom: '20px'}}>Gimnasio: {gymIdentifier}</h3>
                {error && <p className="auth-error">{error}</p>}
                <form onSubmit={handleSubmit} className="auth-form" key={gymIdentifier}>
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
                    <button type="submit" disabled={loading || !gymIdentifier} className="auth-button">
                        {loading ? 'Iniciando Sesión...' : 'Iniciar Sesión'}
                    </button>
                </form>
                <p className="auth-link-text">
                    ¿No tienes una cuenta? <span onClick={() => navigate(`/gym/${gymIdentifier}/register`)} className="auth-link">Regístrate aquí</span>
                </p>
            </div>
        </div>
    );
}

export default LoginPage;