// src/pages/ClientCreateEditPage.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import authService from '../services/authService';
import '../styles/ClientCreateEditPage.css'

// Función para convertir un string a un formato amigable para URL (slug)
const generateUrlIdentifier = (name) => {
    return name
        .toString()
        .toLowerCase()
        .trim()
        .normalize('NFD') // Normaliza para separar acentos de las letras
        .replace(/[\u0300-\u036f]/g, '') // Elimina los acentos
        .replace(/\s+/g, '-') // Reemplaza espacios con -
        .replace(/[^\w-]+/g, '') // Elimina todos los caracteres no alfanuméricos excepto -
        .replace(/--+/g, '-'); // Reemplaza múltiples - con uno solo
};

function ClientCreateEditPage() {
    const { id } = useParams();
    const navigate = useNavigate();
    // --- 1. AÑADIMOS LOS NUEVOS CAMPOS AL ESTADO INICIAL ---
    const [client, setClient] = useState({
        nombre: '',
        emailContacto: '',
        urlIdentifier: '', 
        logoUrl: '', 
        primaryColor: '#150224',
        estadoSuscripcion: 'periodo_prueba', 
        // Nuevos campos con valores por defecto
        clientLimit: 100,
        basePrice: 40000,
        pricePerBlock: 15000,
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [success, setSuccess] = useState(false);
    const isEditing = Boolean(id);

    useEffect(() => {
        if (isEditing) {
            setLoading(true);
            clientService.getClientById(id)
                .then(data => {
                    // --- 2. CARGAMOS LOS NUEVOS DATOS AL EDITAR ---
                    setClient({
                        nombre: data.nombre,
                        emailContacto: data.emailContacto,
                        urlIdentifier: data.urlIdentifier || '', 
                        logoUrl: data.logoUrl || '',
                        primaryColor: data.primaryColor || '#150224',
                        estadoSuscripcion: data.estadoSuscripcion,
                        // Cargar datos existentes o usar defaults
                        clientLimit: data.clientLimit || 100,
                        basePrice: data.basePrice || 40000,
                        pricePerBlock: data.pricePerBlock || 15000,
                        // Campos informativos (no editables directamente aquí)
                        clientId: data.clientId,
                        apiSecretKey: data.apiSecretKey,
                        connectionStringDB: data.connectionStringDB,
                    });
                    setLoading(false);
                })
                .catch(err => {
                    setError(err.message || 'Error al cargar los datos del gimnasio.');
                    setLoading(false);
                    if (err && (String(err).includes('No autorizado') || String(err).includes('Token'))) {
                        authService.logout();
                        navigate('/login');
                    }
                });
        }
    }, [id, isEditing, navigate]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        
        if (name === 'nombre' && !isEditing) {
            const newIdentifier = generateUrlIdentifier(value);
            setClient(prevClient => ({ 
                ...prevClient, 
                nombre: value,
                urlIdentifier: newIdentifier 
            }));
        } else {
            setClient(prevClient => ({ ...prevClient, [name]: value }));
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        // --- 3. CREAMOS UN PAYLOAD LIMPIO PARA LA API ---
        const payload = {
            nombre: client.nombre,
            emailContacto: client.emailContacto,
            urlIdentifier: client.urlIdentifier,
            logoUrl: client.logoUrl,
            primaryColor: client.primaryColor,
            estadoSuscripcion: client.estadoSuscripcion,
            clientLimit: Number(client.clientLimit),
            basePrice: Number(client.basePrice),
            pricePerBlock: Number(client.pricePerBlock),
        };

        try {
            if (isEditing) {
                await clientService.updateClient(id, payload);
                alert('Gimnasio actualizado exitosamente.');
            } else {
                await clientService.createClient(payload);
                alert('Gimnasio creado exitosamente.');
            }
            navigate('/clients');
        } catch (err) {
            setError(err.message || 'Error al guardar el gimnasio.');
        } finally {
            setLoading(false);
        }
    };

    if (loading && isEditing) return <p>Cargando datos...</p>;

    return (
        <div className="client-form-container">
            <h1 className="client-form-title">{isEditing ? 'Editar Gimnasio' : 'Crear Nuevo Gimnasio'}</h1>
            {error && <p className="client-error">{error}</p>}
            {success && <p className="client-success">¡Operación exitosa!</p>}
            <form onSubmit={handleSubmit} className="client-form">
                <div className="client-form-group">
                    <label htmlFor="nombre" className="client-label">Nombre del Gimnasio:</label>
                    <input type="text" id="nombre" name="nombre" value={client.nombre} onChange={handleChange} required className="client-input" />
                </div>
                
                <div className="client-form-group">
                    <label htmlFor="urlIdentifier" className="client-label">Identificador para URL:</label>
                    <input
                        type="text"
                        id="urlIdentifier"
                        name="urlIdentifier"
                        value={client.urlIdentifier}
                        onChange={handleChange}
                        required
                        className="client-input"
                        readOnly={!isEditing} 
                    />
                    <h2 className="client-form-subtitle">Plan y Precios</h2>
                <div className="client-form-group">
                    <label htmlFor="clientLimit" className="client-label">Límite de Clientes (Plan Base):</label>
                    <input type="number" id="clientLimit" name="clientLimit" value={client.clientLimit} onChange={handleChange} required className="client-input" />
                </div>
                <div className="client-form-group">
                    <label htmlFor="basePrice" className="client-label">Precio Base Mensual (ARS):</label>
                    <input type="number" id="basePrice" name="basePrice" value={client.basePrice} onChange={handleChange} required className="client-input" />
                </div>
                <div className="client-form-group">
                    <label htmlFor="pricePerBlock" className="client-label">Precio por Bloque Adicional (ARS):</label>
                    <input type="number" id="pricePerBlock" name="pricePerBlock" value={client.pricePerBlock} onChange={handleChange} required className="client-input" />
                </div>
                     {!isEditing && <small>Se genera automáticamente a partir del nombre.</small>}
                </div>
                <div className="client-form-group">
                    <label htmlFor="logoUrl" className="client-label">URL del Logo:</label>
                    <input type="text" id="logoUrl" name="logoUrl" value={client.logoUrl} onChange={handleChange} className="client-input" placeholder="https://ejemplo.com/logo.png" />
                </div>
                <div className="client-form-group">
                    <label htmlFor="primaryColor" className="client-label">Color Principal de la App:</label>
                    <input type="color" id="primaryColor" name="primaryColor" value={client.primaryColor} onChange={handleChange} className="client-input-color" />
                </div>
                <div className="client-form-group">
                    <label htmlFor="emailContacto" className="client-label">Email del Administrador:</label>
                    <input type="email" id="emailContacto" name="emailContacto" value={client.emailContacto} onChange={handleChange} required className="client-input" />
                </div>
                
                {isEditing && (
                    <div className="client-form-group">
                        <label htmlFor="estadoSuscripcion" className="client-label">Estado:</label>
                        <select id="estadoSuscripcion" name="estadoSuscripcion" value={client.estadoSuscripcion} onChange={handleChange} className="client-input client-select">
                            <option value="periodo_prueba">Periodo de Prueba</option>
                            <option value="activo">Activo</option>
                            <option value="inactivo">Inactivo</option>
                        </select>
                    </div>
                )}
                <button type="submit" disabled={loading} className="client-button">
                    {loading ? 'Guardando...' : (isEditing ? 'Actualizar Gimnasio' : 'Crear Gimnasio')}
                </button>
                <button type="button" onClick={() => navigate('/clients')} className="client-button client-back-button">
                    Volver a la Lista
                </button>
            </form>
        </div>
    );
}

export default ClientCreateEditPage;