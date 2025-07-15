// GYM-APP/frontend/src/pages/Auth/GymIdentifierPage.jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../../contexts/AuthContext';
import '../../styles/Auth.css'; // Make sure this CSS file exists and has relevant styles


const SUPER_ADMIN_API_URL = import.meta.env.VITE_SUPERADMIN_API_URL || 'http://localhost:6001/api'; // Adjust the base URL as needed

function GymIdentifierPage() {
    const [identifier, setIdentifier] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const { setGymContext } = useAuth(); // Destructure the new function from AuthContext

    const handleContinue = async (e) => {
        e.preventDefault();
        if (!identifier) {
            setError('Por favor, introduce el código de tu gimnasio.');
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await axios.get(`${SUPER_ADMIN_API_URL}/public/gym/${identifier}`);
            
            const { clientId, gymName, logoUrl } = response.data;

            if (!clientId) {
                throw new Error("La respuesta del servidor no incluyó un ID de cliente.");
            }
            
            // Set gym context using the new function
            setGymContext({ clientId, gymName, logoUrl, gymUrlIdentifier: identifier });
            
            navigate(`/gym/${identifier}/login`); // Navigate to login page for the identified gym

        } catch (err) {
            setError(err.response?.data?.message || 'El código del gimnasio no es válido o no se pudo conectar al servidor.');
            console.error('Error al identificar gimnasio:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">Identifica tu Gimnasio</h2>
                <p className="auth-subtitle">
                    Introduce el código único proporcionado por tu gimnasio para continuar.
                </p>
                {error && <p className="auth-error">{error}</p>}
                <form onSubmit={handleContinue} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="gymIdentifier">Código del Gimnasio:</label>
                        <input
                            type="text"
                            id="gymIdentifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            required
                            className="auth-input"
                            autoCapitalize="none"
                        />
                    </div>
                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Continuando...' : 'Continuar'}
                    </button>
                </form>
            </div>
        </div>
    );
}

export default GymIdentifierPage;