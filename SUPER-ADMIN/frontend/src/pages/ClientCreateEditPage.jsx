// src/pages/ClientCreateEditPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import '../styles/ClientCreateEditPage.css';

// Función para convertir un string a un formato amigable para URL (slug)
const generateUrlIdentifier = (name) => {
    return name
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-')
        .replace(/[^\w-]+/g, '')
        .replace(/--+/g, '-');
};

const COUNTRY_TIMEZONE_MAP = {
    'Argentina': 'America/Argentina/Buenos_Aires',
    'Uruguay': 'America/Montevideo',
    'Chile': 'America/Santiago',
    'Paraguay': 'America/Asuncion',
    'Bolivia': 'America/La_Paz',
    'Venezuela': 'America/Caracas',
    'Puerto Rico': 'America/Puerto_Rico',
    'República Dominicana': 'America/Santo_Domingo',
    'Colombia': 'America/Bogota',
    'Perú': 'America/Lima',
    'Ecuador': 'America/Guayaquil',
    'Panamá': 'America/Panama',
    'México (Centro/CDMX)': 'America/Mexico_City',
    'México (Quintana Roo/Cancún)': 'America/Cancun',
    'México (Pacífico/Tijuana)': 'America/Tijuana',
    'Costa Rica': 'America/Costa_Rica',
    'Guatemala': 'America/Guatemala',
    'Honduras': 'America/Tegucigalpa',
    'El Salvador': 'America/El_Salvador',
    'Nicaragua': 'America/Managua',
    'EE.UU. (Este - Miami/NYC)': 'America/New_York',
    'EE.UU. (Central - Texas/Chicago)': 'America/Chicago',
    'EE.UU. (Montaña - Denver)': 'America/Denver',
    'EE.UU. (Pacífico - LA/California)': 'America/Los_Angeles'
};

function ClientCreateEditPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    const [client, setClient] = useState({
        nombre: '',
        emailContacto: '',
        urlIdentifier: '', 
        logoUrl: '', 
        primaryColor: '#150224',
        estadoSuscripcion: 'periodo_prueba', 
        type: 'turno', // Valor por defecto fijo
        pais: 'Argentina',
        timezone: 'America/Argentina/Buenos_Aires',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const isEditing = Boolean(id);

    useEffect(() => {
        if (id) { 
            setLoading(true);
            clientService.getClientById(id)
                .then(data => {
                    setClient({
                        nombre: data.nombre,
                        emailContacto: data.emailContacto,
                        urlIdentifier: data.urlIdentifier, 
                        logoUrl: data.logoUrl,
                        primaryColor: data.primaryColor,
                        estadoSuscripcion: data.estadoSuscripcion,
                        type: 'turno', // Forzamos turno aunque venga otra cosa, para estandarizar
                        pais: data.pais || 'Argentina',
                        timezone: data.timezone || 'America/Argentina/Buenos_Aires',
                    });
                })
                .catch(err => setError(err.message))
                .finally(() => setLoading(false));
        }
    }, [id]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'nombre' && !isEditing) {
            const newIdentifier = generateUrlIdentifier(value);
            setClient(prevClient => ({ 
                ...prevClient, 
                nombre: value,
                urlIdentifier: newIdentifier 
            }));
        } else if (name === 'pais') {
            const defaultTz = COUNTRY_TIMEZONE_MAP[value] || client.timezone;
            setClient(prevClient => ({
                ...prevClient,
                pais: value,
                timezone: defaultTz
            }));
        } else {
            setClient(prevClient => ({ ...prevClient, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

       const payload = {
            nombre: client.nombre,
            emailContacto: client.emailContacto,
            urlIdentifier: client.urlIdentifier,
            logoUrl: client.logoUrl,
            primaryColor: client.primaryColor,
            estadoSuscripcion: client.estadoSuscripcion,
            type: 'turno', // Siempre enviamos 'turno'
            pais: client.pais,
            timezone: client.timezone,
        };

        try {
            if (isEditing) {
                await clientService.updateClient(id, payload);
                alert('Cliente actualizado exitosamente.');
            } else {
                await clientService.createClient(payload);
                alert('Cliente creado exitosamente.');
            }
            navigate('/clients');
        } catch (err) {
            setError(err.message || 'Error al guardar el cliente.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing) return <p>Cargando datos...</p>;

    return (
        <div className="client-form-wrapper">
            <div className="client-form-container glass-panel">
                <h1 className="client-form-title">{isEditing ? 'Editar Cliente' : 'Crear Nuevo Cliente'}</h1>
                {error && <p className="client-error">{error}</p>}
                
                <form onSubmit={handleSubmit} className="client-form">
                    
                    <div className="form-section">
                        <h2 className="client-form-subtitle">
                            <span style={{fontSize: '1.5em'}}>🏢</span> Información del Negocio
                        </h2>
                        <div className="form-grid">
                            <div className="client-form-group">
                                <label htmlFor="nombre" className="client-label">Nombre del Negocio</label>
                                <input type="text" id="nombre" name="nombre" value={client.nombre} onChange={handleChange} required className="modern-input" placeholder="Ej. Gym Fitness" />
                            </div>
                            <div className="client-form-group">
                                <label htmlFor="urlIdentifier" className="client-label">Identificador URL (Automático)</label>
                                <input type="text" id="urlIdentifier" name="urlIdentifier" value={client.urlIdentifier} onChange={handleChange} required className={`modern-input ${!isEditing ? 'client-input-readonly' : ''}`} readOnly={!isEditing} />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2 className="client-form-subtitle">
                            <span style={{fontSize: '1.5em'}}>🌎</span> Localización & Horario
                        </h2>
                        <div className="form-grid">
                            <div className="client-form-group">
                                <label htmlFor="pais" className="client-label">País / Región</label>
                                <select id="pais" name="pais" value={client.pais} onChange={handleChange} className="modern-input client-select" required>
                                    {Object.keys(COUNTRY_TIMEZONE_MAP).map(p => (
                                        <option key={p} value={p}>{p}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="client-form-group">
                                <label htmlFor="timezone" className="client-label">Zona Horaria (Timezone)</label>
                                <input type="text" id="timezone" name="timezone" value={client.timezone} onChange={handleChange} required className="modern-input" placeholder="America/Argentina/Buenos_Aires" />
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2 className="client-form-subtitle">
                            <span style={{fontSize: '1.5em'}}>🎨</span> Personalización App
                        </h2>
                        <div className="form-grid">
                            <div className="client-form-group">
                                <label htmlFor="logoUrl" className="client-label">URL del Logo</label>
                                <input type="text" id="logoUrl" name="logoUrl" value={client.logoUrl} onChange={handleChange} className="modern-input" placeholder="https://ejemplo.com/logo.png" />
                            </div>
                            <div className="client-form-group">
                                <label htmlFor="primaryColor" className="client-label">Color Principal</label>
                                <div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
                                    <input type="color" id="primaryColor" name="primaryColor" value={client.primaryColor} onChange={handleChange} style={{height: '40px', width: '50px', border: 'none', borderRadius: '4px', background: 'transparent', cursor: 'pointer'}} />
                                    <span style={{color: 'var(--text-muted)'}}>{client.primaryColor}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="form-section">
                        <h2 className="client-form-subtitle">
                            <span style={{fontSize: '1.5em'}}>🔐</span> Administración
                        </h2>
                        <div className="form-grid">
                            <div className="client-form-group">
                                <label htmlFor="emailContacto" className="client-label">Email del Administrador (Admin App)</label>
                                <input type="email" id="emailContacto" name="emailContacto" value={client.emailContacto} onChange={handleChange} required className="modern-input" placeholder="admin@gym.com" />
                            </div>
                            {isEditing && (
                                <div className="client-form-group">
                                    <label htmlFor="estadoSuscripcion" className="client-label">Estado de Suscripción</label>
                                    <select id="estadoSuscripcion" name="estadoSuscripcion" value={client.estadoSuscripcion} onChange={handleChange} className="modern-input client-select">
                                        <option value="periodo_prueba">Periodo de Prueba</option>
                                        <option value="activo">Activo</option>
                                        <option value="inactivo">Inactivo</option>
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="form-actions">
                        <button type="button" onClick={() => navigate('/clients')} className="btn-secondary">
                            Cancelar
                        </button>
                        <button type="submit" disabled={loading} className="btn-primary">
                            {loading ? 'Guardando...' : (isEditing ? 'Actualizar Cliente' : 'Crear Cliente')}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
 
export default ClientCreateEditPage;