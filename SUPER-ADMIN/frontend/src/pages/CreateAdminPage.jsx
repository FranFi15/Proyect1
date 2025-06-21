// superadmin-frontend/src/pages/CreateAdminPage.jsx
import React, { useState } from 'react';
import adminCreationService from '../services/adminCreationService';
import '../styles/LoginPage.css'; // Puedes reutilizar los estilos si quieres

function CreateAdminPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('superadmin'); // Por si quieres crear otros roles
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');
        try {
            const data = await adminCreationService.createTempAdmin(email, password, role);
            setMessage(data.message || 'Administrador creado con éxito.');
            setEmail('');
            setPassword('');
        } catch (err) {
            setError(err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="login-container">
            <h1 className="login-title">Crear SuperAdmin (TEMPORAL)</h1>
            <p style={{color: 'red', fontWeight: 'bold'}}>¡ADVERTENCIA: Eliminar esta ruta después de crear el admin!</p>
            <form onSubmit={handleSubmit} className="login-form">
                {message && <p style={{ color: 'green' }}>{message}</p>}
                {error && <p className="login-error">{error}</p>}
                <div className="login-form-group">
                    <label htmlFor="email" className="login-label">Email:</label>
                    <input
                        type="email"
                        id="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className="login-input"
                    />
                </div>
                <div className="login-form-group">
                    <label htmlFor="password-input" className="login-label">Contraseña:</label>
                    <input
                        type="password"
                        id="password-input"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        className="login-input"
                    />
                </div>
                {/* Puedes añadir un selector de rol si quieres, pero para superadmin lo fijo */}
                {/* <div className="login-form-group">
                    <label htmlFor="role" className="login-label">Rol:</label>
                    <select
                        id="role"
                        value={role}
                        onChange={(e) => setRole(e.target.value)}
                        className="login-input"
                    >
                        <option value="superadmin">SuperAdmin</option>
                        <option value="admin">Admin</option>
                    </select>
                </div> */}
                <button type="submit" disabled={loading} className="login-button">
                    {loading ? 'Creando...' : 'Crear Admin'}
                </button>
            </form>
        </div>
    );
}

export default CreateAdminPage;
