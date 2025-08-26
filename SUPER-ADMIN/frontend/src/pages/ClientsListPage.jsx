// src/pages/ClientsListPage.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import authService from '../services/authService';
import settingsService from '../services/settingsService'; // Asumimos que este servicio existe
import '../styles/ClientListPage.css';

// --- FUNCIÓN DE CÁLCULO DE PRECIO ACTUALIZADA ---
const calculateTotalPrice = (client, universalPrices) => {
    if (client.type === 'turno') {
        const clientCount = client.clientCount || 0;
        const pricePerClient = universalPrices.pricePerClient || 0;
        return clientCount * pricePerClient;
    }
    
    if (client.type === 'restaurante') {
        return universalPrices.restaurantPrice || 0;
    }

    return 'N/A';
};

const formatCurrency = (amount) => {
    if (typeof amount !== 'number') {
        return amount;
    }
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

// --- NUEVO COMPONENTE PARA GESTIONAR PRECIOS GLOBALES ---
const UniversalPricingManager = ({ prices, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    const [localPrices, setLocalPrices] = useState(prices);

    useEffect(() => {
        setLocalPrices(prices);
    }, [prices]);

    const handleSave = () => {
        onSave(localPrices);
        setIsEditing(false);
    };

    return (
        <div className="pricing-manager">
            <h2>Precios Universales</h2>
            <div className="pricing-display">
                <div className="price-item">
                    <span className="price-label">Precio por Cliente (Gimnasios):</span>
                    {isEditing ? (
                        <input 
                            type="number" 
                            className="clients-filter-input"
                            value={localPrices.pricePerClient}
                            onChange={(e) => setLocalPrices({...localPrices, pricePerClient: Number(e.target.value)})}
                        />
                    ) : (
                        <span className="price-value">{formatCurrency(prices.pricePerClient)}</span>
                    )}
                </div>
                <div className="price-item">
                    <span className="price-label">Precio Fijo Mensual (Restaurantes):</span>
                     {isEditing ? (
                        <input 
                            type="number" 
                            className="clients-filter-input"
                            value={localPrices.restaurantPrice}
                            onChange={(e) => setLocalPrices({...localPrices, restaurantPrice: Number(e.target.value)})}
                        />
                    ) : (
                        <span className="price-value">{formatCurrency(prices.restaurantPrice)}</span>
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
    const [typeFilter, setTypeFilter] = useState('todos');
    const [universalPrices, setUniversalPrices] = useState({ pricePerClient: 0, restaurantPrice: 0 });

    const fetchData = async () => {
        try {
            const [clientsData, settingsData] = await Promise.all([
                clientService.getClients(),
                settingsService.getSettings() // Asume que este endpoint existe
            ]);
            setClients(clientsData);
            setUniversalPrices(settingsData);
        } catch (err) {
            setError(err.message || 'Error al cargar los datos.');
            if (String(err.message).includes('No autorizado') || String(err.message).includes('Token')) {
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

    const handleSavePrices = async (newPrices) => {
        try {
            await settingsService.updateSettings(newPrices); // Asume que este endpoint existe
            setUniversalPrices(newPrices);
            alert('Precios actualizados exitosamente.');
        } catch (err) {
            setError(err.message || 'No se pudieron guardar los precios.');
        }
    };

    const handleDelete = async (id) => {
        if (window.confirm('¿Estás seguro de que quieres eliminar este cliente?')) {
            try {
                await clientService.deleteClient(id);
                setClients(clients.filter(client => client._id !== id));
                alert('Cliente eliminado exitosamente.');
            } catch (err) {
                setError(err.message || 'Error al eliminar el cliente.');
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
            const typeMatch = typeFilter === 'todos' || client.type === typeFilter;
            const searchMatch = client.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            return statusMatch && searchMatch && typeMatch;
        })
        .sort((a, b) => a.nombre.localeCompare(b.nombre));

    if (loading) return <p>Cargando clientes...</p>;
    if (error) return <p className="clients-error">Error: {error}</p>;

    return (
        <div className="clients-container">
            <h1 className="clients-title">Lista de Clientes</h1>
            <div className="clients-actions">
                <Link to="/clients/new" className="clients-button">Añadir Nuevo Cliente</Link>
                <button onClick={handleLogout} className="clients-button clients-logout-button">Cerrar Sesión</button>
            </div>
            
            <UniversalPricingManager prices={universalPrices} onSave={handleSavePrices} />
            
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
                <select
                    value={typeFilter}
                    onChange={(e) => setTypeFilter(e.target.value)}
                    className="clients-filter-select"
                >
                    <option value="todos">Todos los tipos</option>
                    <option value="turno">Gimnasios</option>
                    <option value="restaurante">Restaurantes</option>
                </select>
            </div>

            {filteredAndSortedClients.length === 0 ? (
                <p>No hay clientes que coincidan con los filtros.</p>
            ) : (
                <table className="clients-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Tipo</th>
                            <th>Estado</th>
                            <th>Clientes (Actual)</th>
                            <th>Total a Facturar</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    {filteredAndSortedClients.map((client) => {
                        const totalPrice = calculateTotalPrice(client, universalPrices);
                        return (
                            <tr key={client._id}>
                                <td>{client.nombre}</td>
                                <td style={{textTransform: 'capitalize'}}>{client.type}</td>
                                <td>{client.estadoSuscripcion}</td>
                                <td>{client.type === 'turno' ? (client.clientCount || 0) : 'N/A'}</td>
                                <td>{formatCurrency(totalPrice)}</td>
                                <td className="actions-column">
                                    <Link to={`/clients/${client._id}/edit`} className="clients-button clients-edit-button">Editar</Link>
                                    <button onClick={() => handleDelete(client._id)} className="clients-button clients-delete-button">Eliminar</button>
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
