// src/pages/Auth/RegisterPage.jsx
import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom'; // 1. Importar useParams
import authService from '../../services/authService';
import '../../styles/Auth.css';

function RegisterPage() {
    const navigate = useNavigate();
    const { gymIdentifier } = useParams(); // 2. Capturar el identificador del gym de la URL

    // (Todos tus otros estados para los campos del formulario se mantienen igual)
    const [nombre, setNombre] = useState('');
    const [apellido, setApellido] = useState('');
    const [email, setEmail] = useState('');
    const [contraseña, setContraseña] = useState('');
    const [confirmContraseña, setConfirmContraseña] = useState('');
    const [dni, setDni] = useState('');
    const [fechaNacimiento, setFechaNacimiento] = useState('');
    const [telefonoEmergencia, setTelefonoEmergencia] = useState('');
    const [direccion, setDireccion] = useState('');
    const [numeroTelefono, setNumeroTelefono] = useState('');
    const [obraSocial, setObraSocial] = useState('');
    const [sexo, setSexo] = useState('');

    const [error, setError] = useState(null);
    const [loading, setLoading] = useState(false);

   const handleSubmit = async (e) => {
    e.preventDefault();
    if (contraseña !== confirmContraseña) {
        setError('Las contraseñas no coinciden');
        return;
    }
    setLoading(true);
    setError(null);
    try {
        await authService.registerAdmin({
            nombre,
            apellido,
            fechaNacimiento,
            email,
            contraseña,
            dni,
            telefonoEmergencia,
            direccion,
            numeroTelefono,
            obraSocial,
            sexo,
        }, gymIdentifier);

        alert('¡Administrador registrado exitosamente!');
      
        navigate(`/gym/${gymIdentifier}/dashboard`);

    } catch (err) {
        setError(err.message || 'Error en el registro.');
        console.error('Error de registro:', err);
    } finally {
        setLoading(false);
    }

};
    return (
        <div className="auth-container">
            <div className="auth-card">
                <h2 className="auth-title">Registro de Nuevo Socio</h2>
                <h3 style={{color: '#555', marginTop: '-20px', marginBottom: '20px'}}>Gimnasio: {gymIdentifier}</h3>
                {error && <p className="error-message">{error.message || 'Ocurrió un error inesperado.'}</p>}
                <form onSubmit={handleSubmit} className="auth-form">
                    {/* (Todos tus inputs del formulario se mantienen igual) */}
                    <div className="form-group">
                        <label htmlFor="nombre">Nombre:</label>
                        <input type="text" id="nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="apellido">Apellido:</label>
                        <input type="text" id="apellido" value={apellido} onChange={(e) => setApellido(e.target.value)} required className="auth-input" />
                    </div>
                     <div className="form-group">
                        <label htmlFor="email">Email:</label>
                        <input type="email" id="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="dni">DNI:</label>
                        <input type="text" id="dni" value={dni} onChange={(e) => setDni(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="fechaNacimiento">Fecha de Nacimiento:</label>
                        <input type="date" id="fechaNacimiento" value={fechaNacimiento} onChange={(e) => setFechaNacimiento(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                       <label htmlFor="sexo">Sexo:</label>
                    <select name="sexo" id="sexo" value={sexo} onChange={(e) => setSexo(e.target.value)} className="auth-input">
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro</option>
                    </select>
                    </div>
                    <div className="form-group">
                        <label htmlFor="password">Contraseña:</label>
                        <input type="password" id="password" value={contraseña} onChange={(e) => setContraseña(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="confirmPassword">Confirmar Contraseña:</label>
                        <input type="password" id="confirmPassword" value={confirmContraseña} onChange={(e) => setConfirmContraseña(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="telefonoEmergencia">Teléfono de Emergencia:</label>
                        <input type="text" id="telefonoEmergencia" value={telefonoEmergencia} onChange={(e) => setTelefonoEmergencia(e.target.value)} required className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="direccion">Dirección:</label>
                        <input type="text" id="direccion" value={direccion} onChange={(e) => setDireccion(e.target.value)} className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="numeroTelefono">Número de Teléfono (opcional):</label>
                        <input type="text" id="numeroTelefono" value={numeroTelefono} onChange={(e) => setNumeroTelefono(e.target.value)} className="auth-input" />
                    </div>
                    <div className="form-group">
                        <label htmlFor="obraSocial">Obra Social (opcional):</label>
                        <input type="text" id="obraSocial" value={obraSocial} onChange={(e) => setObraSocial(e.target.value)} className="auth-input" />
                    </div>

                    <button type="submit" disabled={loading} className="auth-button">
                        {loading ? 'Registrando...' : 'Registrarse'}
                    </button>
                </form>
                <p className="auth-link-text">
                    ¿Ya tienes una cuenta? <span onClick={() => navigate(`/gym/${gymIdentifier}/login`)} className="auth-link">Inicia Sesión aquí</span>
                </p>
            </div>
        </div>
    );
}

export default RegisterPage;