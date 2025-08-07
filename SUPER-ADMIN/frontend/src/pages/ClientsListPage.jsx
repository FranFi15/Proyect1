import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import authService from '../services/authService';
// --- ¡NUEVO IMPORT! ---
import settingsService from '../services/settingsService'; 
import '../styles/ClientListPage.css';

// --- ESTA FUNCIÓN AHORA ACEPTA LOS PRECIOS GLOBALES ---
const calculateTotalPrice = (client, universalSettings) => {
    const { clientCount = 0, clientLimit = 100 } = client;
    const { basePrice = 0, pricePerBlock = 0 } = universalSettings;

    if (clientCount <= clientLimit) {
        return basePrice;
    }

    const extraClients = clientCount - clientLimit;
    const extraBlocks = Math.ceil(extraClients / 50); // Usamos 50 como mencionaste

    return basePrice + (extraBlocks * pricePerBlock);
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

// --- NUEVO COMPONENTE PARA GESTIONAR PRECIOS ---
const UniversalPricingManager = ({ settings, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localSettings, setLocalSettings] = useState(settings);

    useEffect(() => {
        setLocalSettings(settings);
    }, [settings]);

    const handleSave = () => {
        onSave(localSettings);
        setIsEditing(false);
    };

    return (
        <div className="pricing-manager">
            <h2>Precios Universales</h2>
            <div className="pricing-display">
                <div className="price-item">
                    <span className="price-label">Precio Base Mensual:</span>
                    {isEditing ? (
                        <input 
                            type="number" 
                            className="clients-filter-input"
                            value={localSettings.basePrice}
                            onChange={(e) => setLocalSettings({...localSettings, basePrice: Number(e.target.value)})}
                        />
                    ) : (
                        <span className="price-value">{formatCurrency(settings.basePrice)}</span>
                    )}
                </div>
                <div className="price-item">
                    <span className="price-label">Precio por Bloque (50 clientes):</span>
                     {isEditing ? (
                        <input 
                            type="number" 
                            className="clients-filter-input"
                            value={localSettings.pricePerBlock}
                            onChange={(e) => setLocalSettings({...localSettings, pricePerBlock: Number(e.target.value)})}
                        />
                    ) : (
                        <span className="price-value">{formatCurrency(settings.pricePerBlock)}</span>
                    )}
                </div>
            </div>
            {isEditing ? (
                <div className="pricing-actions">
                    <button onClick={() => setIsEditing(false)} className="clients-button clients-edit-button">Cancelar</button>
                    <button onClick={handleSave} className="clients-button">Guardar Precios</button>
                </div>
            ) : (
                 <button onClick={() => setIsEditing(true)} className="clients-button clients-edit-button">Editar Precios</button>
            )}
        </div>
    );
};


function ClientsListPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');
    
    // --- NUEVO ESTADO PARA PRECIOS UNIVERSALES ---
    const [universalSettings, setUniversalSettings] = useState({ basePrice: 0, pricePerBlock: 0 });

    const fetchData = async () => {
        try {
            const [clientsData, settingsData] = await Promise.all([
                clientService.getClients(),
                settingsService.getSettings()
            ]);
            setClients(clientsData);
            setUniversalSettings(settingsData);
        } catch (err) {
            setError(err || 'Error al cargar los datos.');
            if (String(err).includes('No autorizado') || String(err).includes('Token')) {
                authService.logout();
                navigate('/login');
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (authService.getToken()) {
            fetchData();
        } else {
            navigate('/login');
        }
    }, [navigate]);

    const handleSaveSettings = async (newSettings) => {
        try {
            await settingsService.updateSettings(newSettings);
            setUniversalSettings(newSettings);
            alert('Precios actualizados exitosamente.');
        } catch (err) {
            setError(err || 'No se pudieron guardar los precios.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este gimnasio? Esto eliminará también su base de datos.')) {
            try {
                await clientService.deleteClient(id);
                setClients(clients.filter(client => client._id !== id));
                alert('Gimnasio eliminado exitosamente.');
            } catch (err) {
                setError(err || 'Error al eliminar el gimnasio.');
            }
        }
    };

    const handleLogout = () => {
        authService.logout();
        navigate('/login');
    };

    const filteredAndSortedClients = clients
        .filter(client => {
            const statusMatch = statusFilter === 'todos' || client.estadoSuscripcion === statusFilter;
            const searchMatch = client.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            return statusMatch && searchMatch;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (loading) return <p>Cargando gimnasios...</p>;
    if (error) return <p className="clients-error">Error: {error}</p>;

    return (
        <div className="clients-container">
            <h1 className="clients-title">Lista de Clientes</h1>
            <div className="clients-actions">
                <Link to="/clients/new" className="clients-button">Añadir Nuevo Gimnasio</Link>
                <button onClick={handleLogout} className="clients-button clients-logout-button">Cerrar Sesión</button>
            </div>
            <UniversalPricingManager settings={universalSettings} onSave={handleSaveSettings} />
            <div className="filters-container">
                <input
                    type="text"
                    placeholder="Buscar por nombre..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="clients-filter-input"
                />
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="clients-filter-select"
                >
                    <option value="todos">Todos los estados</option>
                    <option value="activo">Activo</option>
                    <option value="inactivo">Inactivo</option>
                    <option value="periodo_prueba">Periodo de Prueba</option>
                </select>
            </div>

            {filteredAndSortedClients.length === 0 ? (
                <p>No hay gimnasios que coincidan con los filtros.</p>
            ) : (
                <table className="clients-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Estado</th>
                            <th>Clientes (Actual/Límite)</th>
                            <th>Total a Facturar</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    {filteredAndSortedClients.map((client) => {
                        // --- EL CÁLCULO AHORA USA LOS PRECIOS UNIVERSALES ---
                        const totalPrice = calculateTotalPrice(client, universalSettings);
                        return (
                            <tr key={client._id}>
                                <td>{client.nombre}</td>
                                <td>{client.estadoSuscripcion}</td>
                                <td>{client.clientCount || 0} / {client.clientLimit || 100}</td>
                                <td>{formatCurrency(totalPrice)}</td>
                                <td className="actions-column">
                                    <Link to={`/clients/${client._id}/edit`} className="clients-button clients-edit-button">Editar</Link>
                                    <button onClick={() => {/* ... tu delete ... */}} className="clients-button clients-delete-button">Eliminar</button>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
                </table>
            )}
        </div>
    );
}

export default ClientsListPage;