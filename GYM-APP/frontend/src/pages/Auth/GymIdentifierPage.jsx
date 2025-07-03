import React, { useState } from 'react';
import axios from 'axios';
// 1. Importamos el hook 'useNavigate' para poder redirigir
import { useNavigate } from 'react-router-dom';
import { useGym } from '../../contexts/GymContext.jsx';
import '../../styles/Auth.css';

const SUPER_ADMIN_API_URL = 'http://localhost:6001/api/public';

const GymIdentifierPage = () => {
    const [identifier, setIdentifier] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const { setGymInfo } = useGym();
    // 2. Obtenemos la función de navegación
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!identifier) {
            setError('Por favor, introduce el código del gimnasio.');
            return;
        }
        setLoading(true);
        setError('');

        try {
            const response = await axios.get(`${SUPER_ADMIN_API_URL}/gym/${identifier}`);
            
            if (response.data && response.data.clientId && response.data.gymName) {
                // Guardamos la información en el contexto
                setGymInfo(response.data.clientId, response.data.gymName);
                
                // 3. ¡CORRECCIÓN CLAVE! Redirigimos al usuario a la página de login.
                navigate('/login');

            } else {
                throw new Error('Respuesta inválida del servidor.');
            }
        } catch (err) {
            setError('El código del gimnasio no es válido o no se pudo conectar al servidor.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-container">
            <div className="auth-form">
                <h2>Identificar Gimnasio</h2>
                <p>Introduce el código único de tu gimnasio para continuar.</p>
                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label htmlFor="gymIdentifier">Código del Gimnasio</label>
                        <input
                            type="text"
                            id="gymIdentifier"
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            autoCapitalize="none"
                            required
                        />
                    </div>
                    {error && <p className="error-message">{error}</p>}
                    <button type="submit" className="auth-button" disabled={loading}>
                        {loading ? 'Verificando...' : 'Continuar'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default GymIdentifierPage;
