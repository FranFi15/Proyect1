import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import authService from '../services/authService';
import '../styles/ClientListPage.css';

const calculateTotalPrice = (client) => {
    const { 
        clientCount = 0, 
        clientLimit = 100, 
        basePrice = 0, 
        pricePerBlock = 0 
    } = client;

    if (clientCount <= clientLimit) {
        return basePrice;
    }

    const extraClients = clientCount - clientLimit;
    const extraBlocks = Math.ceil(extraClients / 100);

    return basePrice + (extraBlocks * pricePerBlock);
};

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
    }).format(amount);
};

function ClientsListPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('todos');

    useEffect(() => {
        const fetchClients = async () => {
            try {
                const data = await clientService.getClients();
                setClients(data);
            } catch (err) {
                setError(err || 'Error al cargar los clientes.');
                if (err && (String(err).includes('No autorizado') || String(err).includes('Token'))) {
                    authService.logout();
                    navigate('/login');
                }
            } finally {
                setLoading(false);
            }
        };

        if (authService.getToken()) {
            fetchClients();
        } else {
            navigate('/login');
        }
    }, [navigate]);

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
                            // --- ¡CORRECCIÓN AQUÍ! ---
                            // Se llama a la función para CADA cliente y se guarda en una variable
                            const totalPrice = calculateTotalPrice(client);
                            return (
                                <tr key={client._id}>
                                    <td>{client.nombre}</td>
                                    <td>{client.estadoSuscripcion}</td>
                                    <td className="id-column">{client.clientCount || 0} / {client.clientLimit || 100}</td>
                                    <td className="id-column">{formatCurrency(totalPrice)}</td>
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