// src/components/dashboard/ClientManagement.jsx
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import authService from '../../services/authService'; 
import Notification from '../common/Notification';
import ConfirmationModal from '../common/ConfirmationModal';

// URL base de tu backend de la app del gimnasio
const GYM_APP_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

// ClientManagement ahora recibe classTypes y fetchClassTypes de DashboardPage
function ClientManagement({ classTypes, fetchClassTypes }) { 
    const [clients, setClients] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [showAddCreditsForm, setShowAddCreditsForm] = useState(false);
    const [clientToAddCredits, setClientToAddCredits] = useState(null);
    const [newClientData, setNewClientData] = useState({
        nombre: '', apellido: '', email: '', contraseña: '', dni: '',
        fechaNacimiento: '', sexo: '', telefonoEmergencia: '', direccion: '', numeroTelefono: '', obraSocial: ''
    });
    const [creditsData, setCreditsData] = useState({
        tipoClaseId: '', cantidad: 0
    });
    const [showSubscriptionForm, setShowSubscriptionForm] = useState(false);
    const [clientToManageSubscription, setClientToManageSubscription] = useState(null);
    const [subscriptionFormData, setSubscriptionFormData] = useState([]);

    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ show: false, message: '', onConfirm: null });

     const showNotification = (message, type = 'success', duration = 4000) => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), duration);
    };
    const askConfirmation = (message, onConfirm) => {
        setConfirmation({ show: true, message, onConfirm });
    };
    const closeConfirmation = () => {
        setConfirmation({ show: false, message: '', onConfirm: null });
    };
    const handleConfirm = () => {
        if (confirmation.onConfirm) {
            confirmation.onConfirm();
        }
        closeConfirmation();
    };

    useEffect(() => {
        fetchClients();
    }, []);

    const fetchClients = async () => {
        try {
            const response = await axios.get(`${GYM_APP_API_BASE_URL}/users`, { headers: authService.getAuthHeaders() });
            setClients(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al obtener socios.', 'error');
            setClients([]);
        }
    };


    const handleNewClientChange = (e) => {
        setNewClientData({ ...newClientData, [e.target.name]: e.target.value });
    };

    const handleAddClientSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.post(`${GYM_APP_API_BASE_URL}/auth/register`, newClientData, { headers: authService.getAuthHeaders() });
            showNotification('Socio registrado exitosamente!', 'success');
            setShowAddForm(false);
            setNewClientData({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: '', telefonoEmergencia: '', direccion: '', numeroTelefono: '', obraSocial: ''});
            fetchClients();
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al registrar socio.', 'error');
        }
    };

    const handleEditClient = (client) => {
        setEditingClient({
            ...client,
            fechaNacimiento: client.fechaNacimiento ? client.fechaNacimiento.substring(0, 10) : ''
        });
        setShowEditForm(true);
    };

    const handleUpdateClientSubmit = async (e) => {
        e.preventDefault();
        askConfirmation("¿Estás seguro de que quieres guardar los cambios?", async () => {
            try {
                const { contraseña, ...updateData } = editingClient;
                await axios.put(`${GYM_APP_API_BASE_URL}/users/${editingClient._id}`, updateData, { headers: authService.getAuthHeaders() });
                showNotification('Socio actualizado exitosamente!', 'success');
                setShowEditForm(false);
                setEditingClient(null);
                fetchClients();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al actualizar socio.', 'error');
            }
        });
    };

    const handleDeleteClient = (clientId) => {
        askConfirmation('¡Cuidado! Esta acción es irreversible. ¿Estás seguro de que quieres eliminar este socio?', async () => {
            try {
                await axios.delete(`${GYM_APP_API_BASE_URL}/users/${clientId}`, { headers: authService.getAuthHeaders() });
                showNotification('Socio eliminado exitosamente.', 'success');
                fetchClients();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al eliminar socio.', 'error');
            }
        });
    };

    const handleAddCredits = (client) => {
        setClientToAddCredits(client);
        setShowAddCreditsForm(true);
        setCreditsData({ tipoClaseId: '', cantidad: 0 });
    };

    const handleCreditsChange = (e) => {
        const { name, value } = e.target;
        if (name === 'cantidad') {
            setCreditsData({ ...creditsData, [name]: parseInt(value, 10) || 0 });
        } else {
            setCreditsData({ ...creditsData, [name]: value });
        }
    };

    const handleAddCreditsSubmit = async (e) => {
        e.preventDefault();
        try {
            await axios.put(`${GYM_APP_API_BASE_URL}/users/${clientToAddCredits._id}/credits`, creditsData, { headers: authService.getAuthHeaders() });
            showNotification(`Créditos añadidos a ${clientToAddCredits.nombre}!`, 'success');
            setShowAddCreditsForm(false);
            setClientToAddCredits(null);
            fetchClients();
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al añadir créditos.', 'error');
        }
    };

    
    const handleManageSubscription = (client) => {
        setClientToManageSubscription(client);
        const existingSubscriptions = Array.isArray(client.monthlySubscriptions)
            ? client.monthlySubscriptions.map(sub => ({
                // Asegúrate de que tipoClase sea el ID si está populado o el propio ID
                tipoClaseId: sub.tipoClase?._id || sub.tipoClase || '',
                status: sub.status || 'manual',
                autoRenewAmount: sub.autoRenewAmount || 0,
            }))
            : [];
        
        setSubscriptionFormData(existingSubscriptions);
        setShowSubscriptionForm(true);
    };

    const addSubscriptionEntry = () => {
        setSubscriptionFormData(prev => [...prev, { tipoClaseId: '', status: 'manual', autoRenewAmount: 0 }]);
    };

    const handleSubscriptionEntryChange = (index, e) => {
        const { name, value } = e.target;
        const newFormData = [...subscriptionFormData];

        if (name === 'autoRenewAmount') {
            newFormData[index][name] = parseInt(value, 10) || 0;
        } else if (name === 'status') {
            const newStatus = value;
            newFormData[index][name] = newStatus;
            if (newStatus === 'automatica' && (newFormData[index].autoRenewAmount <= 0 || !newFormData[index].autoRenewAmount)) {
                newFormData[index].autoRenewAmount = 1;
            } else if (newStatus === 'manual') {
                 newFormData[index].autoRenewAmount = 0;
            }
        } else {
            newFormData[index][name] = value;
        }
        setSubscriptionFormData(newFormData);
        console.log('[ClientManagement] handleSubscriptionEntryChange - new formData:', newFormData);
    };

    const removeSubscriptionEntry = (index) => {
        setSubscriptionFormData(prev => prev.filter((_, i) => i !== index));
    };

     const handleSubscriptionSubmit = async (e) => {
        e.preventDefault();
        askConfirmation("¿Confirmas los cambios en la suscripción de este socio?", async () => {
            const filteredSubscriptions = subscriptionFormData.filter(sub => sub.tipoClaseId);
            const url = `${GYM_APP_API_BASE_URL}/users/${clientToManageSubscription._id}/subscription`;
            try {
                await axios.put(url, { monthlySubscriptions: filteredSubscriptions }, { headers: authService.getAuthHeaders() });
                showNotification('Suscripción actualizada exitosamente!', 'success');
                setShowSubscriptionForm(false);
                setClientToManageSubscription(null);
                fetchClients();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al actualizar suscripción.', 'error');
            }
        });
    };

    return (
        <div className="dashboard-section">
        <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false })} />
            <ConfirmationModal show={confirmation.show} message={confirmation.message} onConfirm={handleConfirm} onCancel={closeConfirmation} />
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn primary mb-4">
                {showAddForm ? 'Cancelar' : 'Registrar Nuevo Socio'}
            </button>

            {showAddForm && (
                <form onSubmit={handleAddClientSubmit} className="form-card">
                    <h4>Registrar Nuevo Socio</h4>
                    <input type="text" name="nombre" placeholder="Nombre" value={newClientData.nombre} onChange={handleNewClientChange} required />
                    <input type="text" name="apellido" placeholder="Apellido" value={newClientData.apellido} onChange={handleNewClientChange} required />
                    <input type="email" name="email" placeholder="Email" value={newClientData.email} onChange={handleNewClientChange} required />
                    <input type="password" name="contraseña" placeholder="Contraseña" value={newClientData.contraseña} onChange={handleNewClientChange} required />
                    <input type="text" name="dni" placeholder="DNI" value={newClientData.dni} onChange={handleNewClientChange} required />
                    <label htmlFor="fechaNacimiento">Fecha de Nacimiento:</label>
                    <input type="date" name="fechaNacimiento" value={newClientData.fechaNacimiento} onChange={handleNewClientChange} required />
                    <label htmlFor="sexo">Sexo:</label>
                    <select name="sexo" id="sexo" value={newClientData.sexo} onChange={handleNewClientChange}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro</option>
                    </select>
                    <input type="text" name="telefonoEmergencia" placeholder="Teléfono de Emergencia" value={newClientData.telefonoEmergencia} onChange={handleNewClientChange} required />
                    <input type="text" name="direccion" placeholder="Dirección (Opcional)" value={newClientData.direccion} onChange={handleNewClientChange} />
                    <input type="text" name="numeroTelefono" placeholder="Número de Teléfono (Opcional)" value={newClientData.numeroTelefono} onChange={handleNewClientChange} />
                    <input type="text" name="obraSocial" placeholder="Obra Social (Opcional)" value={newClientData.obraSocial} onChange={handleNewClientChange} />
                    <button type="submit" className="btn success">Registrar Socio</button>
                </form>
            )}

            {showEditForm && editingClient && (
                <form onSubmit={handleUpdateClientSubmit} className="form-card">
                    <h4>Editar Socio: {editingClient.nombre} {editingClient.apellido}</h4>
                    <input type="text" name="nombre" value={editingClient.nombre} onChange={(e) => setEditingClient({ ...editingClient, nombre: e.target.value })} required />
                    <input type="text" name="apellido" value={editingClient.apellido} onChange={(e) => setEditingClient({ ...editingClient, apellido: e.target.value })} required />
                    <input type="email" name="email" value={editingClient.email} onChange={(e) => setEditingClient({ ...editingClient, email: e.target.value })} required />
                    <input type="text" name="dni" value={editingClient.dni} onChange={(e) => setEditingClient({ ...editingClient, dni: e.target.value })} required />
                    <label htmlFor="fechaNacimientoEdit">Fecha de Nacimiento:</label>
                    <input type="date" name="fechaNacimiento" id="fechaNacimientoEdit" value={editingClient.fechaNacimiento ? editingClient.fechaNacimiento.substring(0, 10) : ''} onChange={(e) => setEditingClient({ ...editingClient, fechaNacimiento: e.target.value })} required />
                    <select name="sexo" id="sexoEdit" value={editingClient.sexo || ''} onChange={(e) => setEditingClient({ ...editingClient, sexo: e.target.value })}>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                        <option value="Otro">Otro</option>
                    </select>
                    <input type="text" name="telefonoEmergencia" value={editingClient.telefonoEmergencia} onChange={(e) => setEditingClient({ ...editingClient, telefonoEmergencia: e.target.value })} required />
                    <input type="text" name="direccion" value={editingClient.direccion} onChange={(e) => setEditingClient({ ...editingClient, direccion: e.target.value })} />
                    <input type="text" name="numeroTelefono" value={editingClient.numeroTelefono} onChange={(e) => setEditingClient({ ...editingClient, numeroTelefono: e.target.value })} />
                    <input type="text" name="obraSocial" value={editingClient.obraSocial} onChange={(e) => setEditingClient({ ...editingClient, obraSocial: e.target.value })} />
                    
                    {/* Selector de roles */}
                    <label htmlFor="roles">Roles:</label>
                    <select
                        id="roles"
                        name="roles"
                        multiple
                        value={editingClient.roles || []} // Asegura que `value` sea un array
                        onChange={(e) => {
                            const selectedRoles = Array.from(e.target.options)
                                .filter(option => option.selected)
                                .map(option => option.value);
                            setEditingClient({ ...editingClient, roles: selectedRoles });
                        }}
                    >
                        <option value="cliente">Cliente</option>
                        <option value="admin">Administrador</option>
                        <option value="profesor">Profesor</option>
                    </select>

                    <button type="submit" className="btn primary">Actualizar Socio</button>
                    <button type="button" onClick={() => setShowEditForm(false)} className="btn danger">Cancelar</button>
                </form>
            )}

            {showAddCreditsForm && clientToAddCredits && (
                <form onSubmit={handleAddCreditsSubmit} className="form-card">
                    <h4>Añadir Créditos a {clientToAddCredits.nombre} {clientToAddCredits.apellido}</h4>
                    <label htmlFor="tipoClaseIdCredits">Tipo de Clase:</label>
                    <select id="tipoClaseIdCredits" name="tipoClaseId" value={creditsData.tipoClaseId} onChange={handleCreditsChange} required>
                        <option value="">Selecciona un tipo de clase</option>
                        {/* Usa la prop classTypes aquí */}
                        {(Array.isArray(classTypes) ? classTypes : []).map(type => (
                            <option key={type._id} value={type._id}>{type.nombre}</option>
                        ))}
                    </select>
                    <label htmlFor="cantidadCredits">Cantidad de Créditos:</label>
                    <input type="number" name="cantidad" id="cantidadCredits" value={creditsData.cantidad} onChange={handleCreditsChange} required min="1" />
                    <button type="submit" className="btn success">Añadir Créditos</button>
                    <button type="button" onClick={() => setShowAddCreditsForm(false)} className="btn danger">Cancelar</button>
                </form>
            )}

            {showSubscriptionForm && clientToManageSubscription && (
                <form onSubmit={handleSubscriptionSubmit} className="form-card">
                    <h4>Gestionar Suscripción de {clientToManageSubscription.nombre} {clientToManageSubscription.apellido}</h4>
                    
                    {subscriptionFormData.map((subEntry, index) => (
                        <div key={index} className="subscription-entry-card form-card" style={{ marginBottom: '15px' }}>
                            <h5>Suscripción {index + 1}</h5>
                            <label htmlFor={`subTipoClase-${index}`}>Tipo de Clase:</label>
                            <select
                                id={`subTipoClase-${index}`}
                                name="tipoClaseId"
                                value={subEntry.tipoClaseId}
                                onChange={(e) => handleSubscriptionEntryChange(index, e)}
                                required
                            >
                                <option value="">Selecciona un tipo de clase</option>
                                {/* Usa la prop classTypes aquí */}
                                {(Array.isArray(classTypes) ? classTypes : []).map(type => (
                                    <option key={type._id} value={type._id}>{type.nombre}</option>
                                ))}
                            </select>

                            <label htmlFor={`subStatus-${index}`}>Estado de Suscripción:</label>
                            <select
                                id={`subStatus-${index}`}
                                name="status"
                                value={subEntry.status}
                                onChange={(e) => handleSubscriptionEntryChange(index, e)}
                                required
                            >
                                <option value="manual">Manual</option>
                                <option value="automatica">Automático</option>
                            </select>

                            {subEntry.status === 'automatica' && (
                                <>
                                    <label htmlFor={`autoRenewAmount-${index}`}>Cantidad de Recarga Automática:</label>
                                    <input
                                        type="number"
                                        id={`autoRenewAmount-${index}`}
                                        name="autoRenewAmount"
                                        value={subEntry.autoRenewAmount}
                                        onChange={(e) => handleSubscriptionEntryChange(index, e)}
                                        required={subEntry.status === 'automatica'}
                                        min="1"
                                    />
                                </>
                            )}
                            <button type="button" onClick={() => removeSubscriptionEntry(index)} className="btn btn-sm danger" style={{ marginTop: '10px' }}>
                                Eliminar Suscripción
                            </button>
                        </div>
                    ))}
                    
                    <button type="button" onClick={addSubscriptionEntry} className="btn info" style={{ marginBottom: '20px' }}>
                        Añadir Nueva Suscripción
                    </button>

                    <button type="submit" className="btn primary">Actualizar Suscripción</button>
                    <button type="button" onClick={() => setShowSubscriptionForm(false)} className="btn danger">Cancelar</button>
                </form>
            )}


            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre Completo</th>
                            <th>Email</th>
                            <th>DNI</th>
                            <th>Edad</th>
                            <th>Sexo</th>
                            <th>Créditos</th>
                            <th>Suscripciones</th>
                            <th>Roles</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.length === 0 ? (
                            <tr><td colSpan="8">No hay socios registrados.</td></tr>
                        ) : (
                            clients.map(client => (
                                <tr key={client._id}>
                                    <td>{client.nombre} {client.apellido}</td>
                                    <td>{client.email}</td>
                                    <td>{client.dni}</td>
                                    <td>{client.edad || 'N/A'}</td>
                                    <td>{client.sexo || 'N/A'}</td>
                                    <td>
                                        {client.creditosPorTipo && Object.keys(client.creditosPorTipo).map(typeId => {
                                            // Busca el nombre del tipo de clase usando las classTypes de las props
                                            const typeName = (Array.isArray(classTypes) ? classTypes : []).find(t => t._id === typeId)?.nombre || typeId;
                                            return <div key={typeId}>{typeName}: {client.creditosPorTipo[typeId]}</div>;
                                        })}
                                    </td>
                                    <td>
                                        {client.monthlySubscriptions && Array.isArray(client.monthlySubscriptions) ? (
                                            client.monthlySubscriptions.map(sub => (
                                                <div key={sub._id || sub.tipoClase?._id || sub.tipoClase}>
                                                    {/* Asegúrate de que sub.tipoClase.nombre exista o usa classTypes de las props */}
                                                    {sub.tipoClase?.nombre || (Array.isArray(classTypes) ? classTypes.find(t => t._id === sub.tipoClase)?.nombre : sub.tipoClase) || 'N/A'}: {sub.status === 'automatic' ? `Auto (${sub.autoRenewAmount} créditos)` : 'Manual'}
                                                </div>
                                            ))
                                        ) : 'N/A'}
                                    </td>
                                    <td>{client.roles.join(', ')}</td>
                                    <td>
                                        <button onClick={() => handleEditClient(client)} className="btn btn-sm primary">Editar</button>
                                        <button onClick={() => handleAddCredits(client)} className="btn btn-sm info">Créditos</button>
                                        <button onClick={() => handleManageSubscription(client)} className="btn btn-sm accent">Suscripción</button>
                                        <button onClick={() => handleDeleteClient(client._id)} className="btn btn-sm danger">Eliminar</button>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

export default ClientManagement;
