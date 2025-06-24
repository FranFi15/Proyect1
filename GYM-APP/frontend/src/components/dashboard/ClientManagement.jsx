import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api';
import Notification from '../common/Notification';
import ConfirmationModal from '../common/ConfirmationModal';

function ClientManagement({ classTypes }) { 
    const [clients, setClients] = useState([]);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [showPlanForm, setShowPlanForm] = useState(false);
    const [clientToManagePlan, setClientToManagePlan] = useState(null);
    
    const [newClientData, setNewClientData] = useState({
        nombre: '', apellido: '', email: '', contraseña: '', dni: '',
        fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', direccion: '', numeroTelefono: '', obraSocial: ''
    });
    
    const [planData, setPlanData] = useState({
        tipoClaseId: '',
        creditsToAdd: 0,
        isSubscription: false,
        autoRenewAmount: 8,
    });
    
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ show: false, message: '', onConfirm: null });

    const showNotification = (message, type = 'success', duration = 4000) => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), duration);
    };
    const askConfirmation = (message, onConfirm) => setConfirmation({ show: true, message, onConfirm });
    const closeConfirmation = () => setConfirmation({ show: false, message: '', onConfirm: null });
    const handleConfirm = () => { if (confirmation.onConfirm) confirmation.onConfirm(); closeConfirmation(); };

    useEffect(() => { fetchClients(); }, []);

    const fetchClients = async () => {
        try {
            const response = await apiClient.get('/users');
            setClients(Array.isArray(response.data) ? response.data : []);
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al obtener socios.', 'error');
        }
    };

    const handleNewClientChange = (e) => setNewClientData({ ...newClientData, [e.target.name]: e.target.value });

    const handleAddClientSubmit = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/auth/register', newClientData);
            showNotification('Socio registrado exitosamente!', 'success');
            setShowAddForm(false);
            setNewClientData({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', direccion: '', numeroTelefono: '', obraSocial: ''});
            fetchClients();
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al registrar socio.', 'error');
        }
    };

    const handleEditClient = (client) => {
        setEditingClient({
            ...client,
            fechaNacimiento: client.fechaNacimiento ? new Date(client.fechaNacimiento).toISOString().substring(0, 10) : ''
        });
        setShowEditForm(true);
    };

    const handleEditingClientChange = (e) => {
        const { name, value } = e.target;
        setEditingClient(prev => ({ ...prev, [name]: value }));
    };
    
    const handleRolesChange = (e) => {
        const selectedRoles = Array.from(e.target.selectedOptions, option => option.value);
        setEditingClient(prev => ({ ...prev, roles: selectedRoles }));
    };

    const handleUpdateClientSubmit = async (e) => {
        e.preventDefault();
        askConfirmation("¿Guardar los cambios del socio?", async () => {
            try {
                const { _id, contraseña, ...updateData } = editingClient;
                await apiClient.put(`/users/${_id}`, updateData);
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
        askConfirmation('¡CUIDADO! Se eliminará permanentemente. ¿Continuar?', async () => {
            try {
                await apiClient.delete(`/users/${clientId}`);
                showNotification('Socio eliminado.', 'success');
                fetchClients();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al eliminar socio.', 'error');
            }
        });
    };
    
    const handleOpenPlanForm = (client) => {
        setClientToManagePlan(client);
        setPlanData({ tipoClaseId: '', creditsToAdd: 0, isSubscription: false, autoRenewAmount: 8 });
        setShowPlanForm(true);
    };

    const handlePlanChange = (e) => {
        const { name, value, type, checked } = e.target;
        setPlanData(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
    };

    const handlePlanSubmit = async (e) => {
        e.preventDefault();
        if (!planData.tipoClaseId) {
            return showNotification('Debes seleccionar un tipo de clase.', 'error');
        }
        const payload = {
            tipoClaseId: planData.tipoClaseId,
            creditsToAdd: Number(planData.creditsToAdd) || 0,
            isSubscription: planData.isSubscription,
            autoRenewAmount: Number(planData.autoRenewAmount) || 0,
        };
        askConfirmation("¿Confirmas los cambios en el plan de este socio?", async () => {
            try {
                await apiClient.put(`/users/${clientToManagePlan._id}/plan`, payload);
                showNotification('Plan del socio actualizado!', 'success');
                setShowPlanForm(false);
                fetchClients();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al actualizar el plan.', 'error');
            }
        });
    };

     const handleClearCredits = () => {
        if (!clientToManagePlan) return;

        askConfirmation(
            `¡CUIDADO! Se eliminarán TODOS los créditos de ${clientToManagePlan.nombre}. Esta acción no se puede deshacer. ¿Continuar?`,
            async () => {
                try {
                    await apiClient.put(`/users/${clientToManagePlan._id}/credits/clear`);
                    showNotification('Todos los créditos del socio han sido eliminados.', 'success');
                    setShowPlanForm(false); // Cierra el modal al terminar
                    fetchClients(); // Refresca la lista de clientes
                } catch (error) {
                    showNotification(error.response?.data?.message || 'Error al eliminar los créditos.', 'error');
                }
            }
        );
    };
      const handleRemoveSubscription = (tipoClaseId) => {
        if (!clientToManagePlan) return;

        const tipoClaseNombre = classTypes.find(t => t._id === tipoClaseId)?.nombre || 'esta';
        askConfirmation(
            `¿Seguro que quieres eliminar la suscripción automática para las clases de "${tipoClaseNombre}"?`,
            async () => {
                try {
                    await apiClient.delete(`/users/${clientToManagePlan._id}/subscription/${tipoClaseId}`);
                    showNotification('Suscripción eliminada.', 'success');
                    fetchClients(); // Refrescamos para ver los cambios
                } catch (error) {
                    showNotification(error.response?.data?.message || 'Error al eliminar la suscripción.', 'error');
                }
            }
        );
    };

    return (
        <div className="dashboard-section">
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
            <ConfirmationModal show={confirmation.show} message={confirmation.message} onConfirm={handleConfirm} onCancel={closeConfirmation} />
            
            <button onClick={() => setShowAddForm(!showAddForm)} className="btn primary mb-4">
                {showAddForm ? 'Cancelar' : 'Registrar Nuevo Socio'}
            </button>

            {showAddForm && (  <form onSubmit={handleAddClientSubmit} className="form-card">
                    <h4>Registrar Nuevo Socio</h4>
                    <input type="text" name="nombre" placeholder="Nombre" value={newClientData.nombre} onChange={handleNewClientChange} required />
                    <input type="text" name="apellido" placeholder="Apellido" value={newClientData.apellido} onChange={handleNewClientChange} required />
                    <input type="email" name="email" placeholder="Email" value={newClientData.email} onChange={handleNewClientChange} required />
                    <input type="password" name="contraseña" placeholder="Contraseña" value={newClientData.contraseña} onChange={handleNewClientChange} required />
                    <input type="text" name="dni" placeholder="DNI" value={newClientData.dni} onChange={handleNewClientChange} required />
                    <label>Fecha de Nacimiento:</label>
                    <input type="date" name="fechaNacimiento" value={newClientData.fechaNacimiento} onChange={handleNewClientChange} required />
                    <label>Sexo:</label>
                    <select name="sexo" value={newClientData.sexo} onChange={handleNewClientChange}>
                        <option value="Otro">Otro</option>
                        <option value="Masculino">Masculino</option>
                        <option value="Femenino">Femenino</option>
                    </select>
                    <input type="text" name="telefonoEmergencia" placeholder="Teléfono de Emergencia" value={newClientData.telefonoEmergencia} onChange={handleNewClientChange} required />
                    <input type="text" name="direccion" placeholder="Dirección (Opcional)" value={newClientData.direccion} onChange={handleNewClientChange} />
                    <input type="text" name="numeroTelefono" placeholder="Número de Teléfono (Opcional)" value={newClientData.numeroTelefono} onChange={handleNewClientChange} />
                    <input type="text" name="obraSocial" placeholder="Obra Social (Opcional)" value={newClientData.obraSocial} onChange={handleNewClientChange} />
                    <label>Roles (mantén Ctrl para seleccionar varios):</label>
                        <select name="roles" multiple value={editingClient.roles || []} onChange={handleRolesChange} className="form-multiselect">
                            <option value="cliente">Cliente</option>
                            <option value="admin">Administrador</option>
                            <option value="profesor">Profesor</option>
                        </select>
                    <button type="submit" className="btn success">Registrar Socio</button>
                </form>)}

            {showEditForm && editingClient && (
                <div className="modal-overlay">
                    <form onSubmit={handleUpdateClientSubmit} className="modal-content form-card">
                        <h4>Editar Socio: {editingClient.nombre} {editingClient.apellido}</h4>
                        <input type="text" name="nombre" placeholder="Nombre" value={editingClient.nombre} onChange={handleEditingClientChange} required />
                        <input type="text" name="apellido" placeholder="Apellido" value={editingClient.apellido} onChange={handleEditingClientChange} required />
                        <input type="email" name="email" placeholder="Email" value={editingClient.email} onChange={handleEditingClientChange} required />
                        <input type="text" name="dni" placeholder="DNI" value={editingClient.dni} onChange={handleEditingClientChange} required />
                        <label>Fecha de Nacimiento:</label>
                        <input type="date" name="fechaNacimiento" value={editingClient.fechaNacimiento} onChange={handleEditingClientChange} required />
                        <label>Sexo:</label>
                        <select name="sexo" value={editingClient.sexo} onChange={handleEditingClientChange}>
                            <option value="Otro">Otro</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Femenino">Femenino</option>
                        </select>
                        <input type="text" name="telefonoEmergencia" placeholder="Teléfono de Emergencia" value={editingClient.telefonoEmergencia} onChange={handleEditingClientChange} required />
                        <input type="text" name="direccion" placeholder="Dirección" value={editingClient.direccion} onChange={handleEditingClientChange} />
                        <input type="text" name="numeroTelefono" placeholder="Número de Teléfono" value={editingClient.numeroTelefono} onChange={handleEditingClientChange} />
                        <input type="text" name="obraSocial" placeholder="Obra Social" value={editingClient.obraSocial} onChange={handleEditingClientChange} />
                        
                        <label>Roles (mantén Ctrl para seleccionar varios):</label>
                        <select name="roles" multiple value={editingClient.roles || []} onChange={handleRolesChange} className="form-multiselect">
                            <option value="cliente">Cliente</option>
                            <option value="admin">Administrador</option>
                            <option value="profesor">Profesor</option>
                        </select>
                        
                        <div className="modal-actions">
                            <button type="submit" className="btn primary">Actualizar Socio</button>
                            <button type="button" onClick={() => setShowEditForm(false)} className="btn danger">Cancelar</button>
                        </div>
                    </form>
                </div>
            )}

            {showPlanForm && clientToManagePlan && (
                <div className="modal-overlay">
                    <div className="modal-content form-card">
                        <h4>Gestionar Plan de {clientToManagePlan.nombre} {clientToManagePlan.apellido}</h4>

                        {/* --- 1. SECCIÓN DE SUSCRIPCIONES ACTIVAS --- */}
                        <fieldset className="plan-section">
                            <legend>Suscripciones Automáticas Activas</legend>
                            {(clientToManagePlan.monthlySubscriptions && clientToManagePlan.monthlySubscriptions.length > 0) ? (
                                <ul className="subscription-list">
                                    {clientToManagePlan.monthlySubscriptions.map(sub => (
                                        <li key={sub._id} className="subscription-item">
                                            <span>&#10004; {sub.tipoClase?.nombre || 'Clase desconocida'} ({sub.autoRenewAmount} créditos/mes)</span>
                                            <button onClick={() => handleRemoveSubscription(sub.tipoClase?._id)} className="btn btn-sm danger">Quitar</button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-data-message">Este socio no tiene suscripciones automáticas.</p>
                            )}
                        </fieldset>

                        {/* --- 2. FORMULARIO PARA AÑADIR/MODIFICAR PLAN --- */}
                        <form onSubmit={handlePlanSubmit} className="add-plan-form">
                            <fieldset className="plan-section">
                                <legend>Añadir o Modificar Plan</legend>
                                <label>Selecciona un Tipo de Clase para gestionar:</label>
                                <select name="tipoClaseId" value={planData.tipoClaseId} onChange={handlePlanChange} required>
                                    <option value="">-- Selecciona un tipo --</option>
                                    {(classTypes || []).map(type => <option key={type._id} value={type._id}>{type.nombre}</option>)}
                                </select>
                            </fieldset>

                            <fieldset className="plan-section">
                                <legend>Carga Manual</legend>
                                <label>Modificar Créditos (ej: 10 para añadir, -5 para quitar):</label>
                                <input type="number" name="creditsToAdd" value={planData.creditsToAdd} onChange={handlePlanChange} />
                            </fieldset>
                            
                            <fieldset className="plan-section">
                                <legend>Suscripción Automática</legend>
                                <div className="subscription-toggle">
                                    <input type="checkbox" id="isSubscription" name="isSubscription" checked={planData.isSubscription} onChange={handlePlanChange} />
                                    <label htmlFor="isSubscription">Activar / Actualizar renovación automática</label>
                                </div>
                                {planData.isSubscription && (
                                    <div className="auto-renew-section">
                                        <label>Créditos a renovar cada mes:</label>
                                        <input type="number" name="autoRenewAmount" value={planData.autoRenewAmount} onChange={handlePlanChange} min="1" />
                                    </div>
                                )}
                            </fieldset>
                            
                            <div className="modal-actions">
                                <button type="submit" className="btn success">Guardar Cambios del Plan</button>
                            </div>
                        </form>

                         <div className="modal-actions">
                            <button type="button" onClick={() => setShowPlanForm(false)} className="btn">Cerrar</button>
                         </div>
                    </div>
                </div>
            )}

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre Completo</th>
                            <th>Email</th>
                            <th>Sexo</th>
                            <th>Créditos</th>
                            <th>Suscripciones</th>
                            <th>Roles</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {clients.map(client => (
                            <tr key={client._id}>
                                <td>{client.nombre} {client.apellido}</td>
                                <td>{client.email}</td>
                                <td>{client.sexo || 'N/A'}</td>
                                <td>
                                    {Object.entries(client.creditosPorTipo || {}).map(([typeId, amount]) => {
                                        const typeName = (classTypes || []).find(t => t._id === typeId)?.nombre || 'Desconocido';
                                        return <div key={typeId}>{typeName}: {amount}</div>;
                                    })}
                                </td>
                                <td>
                                    {(client.monthlySubscriptions || []).map(sub => {
                                        const typeName = sub.tipoClase?.nombre || 'Desconocido';
                                        return <div key={sub._id || sub.tipoClase}>&#10004; {typeName} (Auto)</div>;
                                    })}
                                </td>
                                <td>{client.roles.join(', ')}</td>
                                <td>
                                    <button onClick={() => handleOpenPlanForm(client)} className="btn btn-sm info">Plan/Créditos</button>
                                    <button onClick={() => handleEditClient(client)} className="btn btn-sm primary">Editar</button>
                                    <button onClick={() => handleDeleteClient(client._id)} className="btn btn-sm danger">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
            <ConfirmationModal show={confirmation.show} message={confirmation.message} onConfirm={handleConfirm} onCancel={closeConfirmation} />
        </div>
    );
}

export default ClientManagement;