// src/pages/ClientsListPage.jsx
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import clientService from '../services/clientService';
import authService from '../services/authService';
import '../styles/ClientListPage.css'
function ClientsListPage() {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const navigate = useNavigate();

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

    if (loading) return <p>Cargando gimnasios...</p>;
    if (error) return <p className="clients-error">Error: {error}</p>; // Aplica la clase CSS

    return (
        <div className="clients-container"> {/* Aplica la clase CSS */}
            <h1 className="clients-title">Lista Clientes</h1> {/* Aplica la clase CSS */}
            <div className="clients-actions"> {/* Aplica la clase CSS */}
                <Link to="/clients/new" className="clients-button">Añadir Nuevo Gimnasio</Link> {/* Aplica la clase CSS */}
                <button onClick={handleLogout} className="clients-button clients-logout-button">Cerrar Sesión</button> {/* Aplica las clases CSS */}
            </div>
            {clients.length === 0 ? (
                <p>No hay gimnasios registrados.</p>
            ) : (
                <table className="clients-table"> 
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Estado</th>
                            <th>Email Admin</th>
                            <th>Client ID</th>
                            <th>Client URL</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.map((client) => (
                                <tr key={client._id}>
                                <td>{client.nombre}</td>
                                <td>{client.estadoSuscripcion}</td>
                                <td>{client.emailContacto}</td>
                                <td className="id-column">{client.clientId}</td> {/* Aplica la clase CSS */}
                                <td>{client.urlIdentifier}</td>
                                <td className="actions-column"> {/* Aplica la clase CSS */}
                                    <Link to={`/clients/${client._id}/edit`} className="clients-button clients-edit-button">Editar</Link> {/* Aplica las clases CSS */}
                                    <button onClick={() => handleDelete(client._id)} className="clients-button clients-delete-button">Eliminar</button> {/* Aplica las clases CSS */}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            )}
        </div>
    );
}

export default ClientsListPage;