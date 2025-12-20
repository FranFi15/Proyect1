import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import authService from '../services/authService';
import settingsService from '../services/settingsService';
import '../styles/ClientListPage.css';

// --- LOGICA DE PRECIOS ACTUALIZADA (Escalones Fijos) ---
const calculateTotalPrice = (client, universalPrices) => {
    const clientCount = client.clientCount || 0;
    
    // ESCALÓN 2: Si supera los 100 clientes
    if (clientCount > 100) {
        return universalPrices.unlimitedPrice || 0;
    }

    // ESCALÓN 1: Si tiene entre 0 y 100 clientes (Precio Fijo Base)
    return universalPrices.basePrice || 0;
};

const formatCurrency = (amount) => {
    if (typeof amount !== 'number') return amount;
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(amount);
};

// --- GESTOR DE PRECIOS GLOBALES ---
const UniversalPricingManager = ({ prices, onSave }) => {
    const [isEditing, setIsEditing] = useState(false);
    
    // Inicializamos el estado local
    const [localPrices, setLocalPrices] = useState({
        basePrice: 0,      // Precio fijo hasta 100
        unlimitedPrice: 0, // Precio fijo más de 100
        ...prices 
    });

    useEffect(() => {
        setLocalPrices(prev => ({ ...prev, ...prices }));
    }, [prices]);

    const handleSave = () => {
        onSave(localPrices);
        setIsEditing(false);
    };

    return (
        <div className="pricing-manager">
            <h2>Configuración de Precios (Planes)</h2>
            <div className="pricing-display">
                
                {/* PRECIO BASE (0-100) */}
                <div className="price-item">
                    <span className="price-label">Plan Base (0-100 clientes):</span>
                    {isEditing ? (
                        <input 
                            type="number" 
                            className="clients-filter-input"
                            value={localPrices.basePrice}
                            onChange={(e) => setLocalPrices({...localPrices, basePrice: Number(e.target.value)})}
                        />
                    ) : (
                        <span className="price-value">{formatCurrency(localPrices.basePrice)}</span>
                    )}
                    <span style={{fontSize: '0.8em', color: '#777'}}>Precio Fijo Mensual</span>
                </div>

                {/* PRECIO ILIMITADO (>100) */}
                <div className="price-item">
                    <span className="price-label">Plan Ilimitado (+100 clientes):</span>
                      {isEditing ? (
                        <input 
                            type="number" 
                            className="clients-filter-input"
                            value={localPrices.unlimitedPrice}
                            onChange={(e) => setLocalPrices({...localPrices, unlimitedPrice: Number(e.target.value)})}
                        />
                    ) : (
                        <span className="price-value">{formatCurrency(localPrices.unlimitedPrice)}</span>
                    )}
                    <span style={{fontSize: '0.8em', color: '#777'}}>Precio Fijo Mensual</span>
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
    
    // Estado inicial de precios
    const [universalPrices, setUniversalPrices] = useState({ basePrice: 0, unlimitedPrice: 0 });

    const fetchData = async () => {
        try {
            const [clientsData, settingsData] = await Promise.all([
                clientService.getClients(),
                settingsService.getSettings()
            ]);
            setClients(clientsData);
            // Aseguramos que settingsData tenga las keys correctas, si no, usa 0
            setUniversalPrices({
                basePrice: settingsData.basePrice || 0,
                unlimitedPrice: settingsData.unlimitedPrice || 0
            });
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
            await settingsService.updateSettings(newPrices);
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
            const searchMatch = client.nombre.toLowerCase().includes(searchTerm.toLowerCase());
            return statusMatch && searchMatch;
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
            </div>

            {filteredAndSortedClients.length === 0 ? (
                <p>No hay clientes que coincidan con los filtros.</p>
            ) : (
                <table className="clients-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Estado</th>
                            <th>Clientes (Actual)</th>
                            <th>Total a Facturar</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                    {filteredAndSortedClients.map((client) => {
                        const totalPrice = calculateTotalPrice(client, universalPrices);
                        const isUnlimited = (client.clientCount || 0) > 100;

                        return (
                            <tr key={client._id}>
                                <td>{client.nombre}</td>
                                <td>{client.estadoSuscripcion}</td>
                                <td>
                                    {client.clientCount || 0}
                                    {isUnlimited ? 
                                        <span style={{color: '#007e3d', fontWeight: 'bold', marginLeft: 5}}> (Ilimitado)</span> 
                                        : 
                                        <span style={{color: '#aaa', fontSize: '0.9em'}}> / 100</span>
                                    }
                                </td>
                                <td>
                                    {formatCurrency(totalPrice)}
                                </td>
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