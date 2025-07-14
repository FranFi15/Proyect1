import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../../services/api';
import Notification from '../common/Notification';
import ConfirmationModal from '../common/ConfirmationModal';
import CreditLogModal from './CreditLogModal';

function ClientManagement({ classTypes: initialClassTypes }) {
    const [clients, setClients] = useState([]);
    // Usamos el prop para el estado inicial, pero lo mantenemos en un estado local para poder actualizarlo.
    const [classTypes, setClassTypes] = useState(initialClassTypes || []);
    const [showAddForm, setShowAddForm] = useState(false);
    const [showEditForm, setShowEditForm] = useState(false);
    const [editingClient, setEditingClient] = useState(null);
    const [showPlanForm, setShowPlanForm] = useState(false);
    const [clientToManagePlan, setClientToManagePlan] = useState(null);
    const [newClientData, setNewClientData] = useState({
        nombre: '', apellido: '', email: '', contraseña: '', dni: '',
        fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', direccion: '', numeroTelefono: '', obraSocial: '', roles: ['cliente'],
    });
    const [planData, setPlanData] = useState({
        tipoClaseId: '', creditsToAdd: 0, isSubscription: false, autoRenewAmount: 8,
    });
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ show: false, message: '', onConfirm: null });
    const [massEnrollFilters, setMassEnrollFilters] = useState({ tipoClaseId: '', diasDeSemana: [], fechaInicio: '', fechaFin: '' });
    const [availableSlots, setAvailableSlots] = useState([]);
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isLoadingSlots, setIsLoadingSlots] = useState(false);
    const [viewingLogsFor, setViewingLogsFor] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    const showNotification = (message, type = 'success', duration = 4000) => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), duration);
    };
    const askConfirmation = (message, onConfirm) => setConfirmation({ show: true, message, onConfirm });
    const closeConfirmation = () => setConfirmation({ show: false, message: '', onConfirm: null });
    const handleConfirm = () => { if (confirmation.onConfirm) confirmation.onConfirm(); closeConfirmation(); };

    // --- CORRECCIÓN 1: Unificar la carga de datos ---
    const fetchAllData = useCallback(async () => {
        try {
            const [usersResponse, classTypesResponse] = await Promise.all([
                apiClient.get('/users'),
                apiClient.get('/tipos-clase') // Ahora también cargamos los tipos de clase
            ]);
            setClients(Array.isArray(usersResponse.data) ? usersResponse.data : []);
            setClassTypes(classTypesResponse.data.tiposClase || []);
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al cargar los datos.', 'error');
        }
    }, []);

    useEffect(() => {
        fetchAllData();
    }, [fetchAllData]);

    const handleNewClientChange = (e) => {
        const { name, value, type, selectedOptions } = e.target;
        if (name === 'roles') {
            const selectedRoles = Array.from(selectedOptions, option => option.value);
            setNewClientData(prevData => ({ ...prevData, roles: selectedRoles }));
        } else {
            setNewClientData(prevData => ({ ...prevData, [name]: value }));
        }
    };

    const handleAddClientSubmit = async (e) => {
        e.preventDefault();
        try {
            await apiClient.post('/auth/register', newClientData);
            showNotification('Socio registrado exitosamente!', 'success');
            setShowAddForm(false);
            setNewClientData({ nombre: '', apellido: '', email: '', contraseña: '', dni: '', fechaNacimiento: '', sexo: 'Otro', telefonoEmergencia: '', direccion: '', numeroTelefono: '', obraSocial: ''});
            fetchAllData();
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
                const { _id, ...updateData } = editingClient;
                await apiClient.put(`/users/${_id}`, updateData);
                showNotification('Socio actualizado exitosamente!', 'success');
                setShowEditForm(false);
                setEditingClient(null);
                fetchAllData();
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
                fetchAllData();
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

        const selectedTypeData = classTypes.find(ct => ct._id === planData.tipoClaseId);
        const availableCredits = selectedTypeData ? selectedTypeData.creditosDisponibles : 0;
        const creditsNum = Number(planData.creditsToAdd);

        if (creditsNum > 0 && creditsNum > availableCredits) {
            showNotification(`No puedes asignar más de los créditos disponibles (${availableCredits}). Crea más clases para aumentar el límite.`, 'error');
            return;
        }

        const payload = {
            tipoClaseId: planData.tipoClaseId,
            creditsToAdd: creditsNum,
            isSubscription: planData.isSubscription,
            autoRenewAmount: Number(planData.autoRenewAmount) || 0,
        };
        
        askConfirmation("¿Confirmas los cambios en el plan de este socio?", async () => {
            try {
                await apiClient.put(`/users/${clientToManagePlan._id}/plan`, payload);
                showNotification('Plan del socio actualizado!', 'success');
                setShowPlanForm(false);
                // --- CORRECCIÓN 2: Llamar a la función que recarga TODO ---
                fetchAllData();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al actualizar el plan.', 'error');
            }
        });
    };
    
    const handleRemoveSubscription = (tipoClaseId) => {
        if (!clientToManagePlan) return;
        const tipoClaseNombre = classTypes.find(t => t._id === tipoClaseId)?.nombre || 'esta';
        askConfirmation(`¿Seguro que quieres eliminar la suscripción automática para "${tipoClaseNombre}"?`, async () => {
            try {
                await apiClient.delete(`/users/${clientToManagePlan._id}/subscription/${tipoClaseId}`);
                showNotification('Suscripción eliminada.', 'success');
                fetchAllData();
                setShowPlanForm(false);
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al eliminar la suscripción.', 'error');
            }
        });
    };

    const handleMassEnrollFilterChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'diasDeSemana') {
            const updatedDays = checked
                ? [...massEnrollFilters.diasDeSemana, value]
                : massEnrollFilters.diasDeSemana.filter(day => day !== value);
            setMassEnrollFilters(prev => ({ ...prev, diasDeSemana: updatedDays }));
        } else {
            setMassEnrollFilters(prev => ({ ...prev, [name]: value }));
        }
        setAvailableSlots([]);
        setSelectedSlot(null);
    };

    const findAvailableSlots = async (e) => {
        e.preventDefault();
        const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters;
        if (!tipoClaseId || diasDeSemana.length === 0 || !fechaInicio || !fechaFin) {
            showNotification('Por favor, completa todos los campos del filtro.', 'error');
            return;
        }
        setIsLoadingSlots(true);
        setAvailableSlots([]);
        setSelectedSlot(null);
        try {
            const response = await apiClient.get('/classes/available-slots', {
                params: { tipoClaseId, diasDeSemana: diasDeSemana.join(','), fechaInicio, fechaFin }
            });
            if (response.data.length === 0) {
                showNotification('No se encontraron horarios disponibles para esa combinación.', 'warning');
            }
            setAvailableSlots(response.data);
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al buscar horarios.', 'error');
        } finally {
            setIsLoadingSlots(false);
        }
    };

    const handleMassEnrollSubmit = async (e) => {
        e.preventDefault();
        if (!clientToManagePlan || !selectedSlot) {
            showNotification('Por favor, selecciona un cliente y un horario.', 'error');
            return;
        }
        const { tipoClaseId, diasDeSemana, fechaInicio, fechaFin } = massEnrollFilters;
        const { horaInicio, horaFin } = selectedSlot;
        askConfirmation(`¿Inscribir a ${clientToManagePlan.nombre} en todas las clases de los ${diasDeSemana.join(', ')} a las ${horaInicio}?`, async () => {
            try {
                const response = await apiClient.post(`/users/${clientToManagePlan._id}/subscribe-to-plan`, {
                    tipoClaseId, diasDeSemana, fechaInicio, fechaFin, horaInicio, horaFin,
                });
                showNotification(response.data.message || 'El socio ha sido inscrito en el plan correctamente.', 'success');
                setShowPlanForm(false);
                fetchAllData();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al procesar la inscripción en el plan.', 'error');
            }
        });
    };

    const handleRemoveFixedPlan = (userId, planId) => {
        askConfirmation('¿Seguro que quieres quitar este plan de horario fijo?', async () => {
            try {
                await apiClient.delete(`/users/${userId}/fixed-plan/${planId}`);
                showNotification('Plan de horario fijo eliminado.', 'success');
                fetchAllData();
                setShowPlanForm(false);
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al quitar el plan.', 'error');
            }
        });
    };

    const filteredClients = clients.filter(client =>
        `${client.nombre} ${client.apellido}`.toLowerCase().includes(searchTerm.toLowerCase()) ||
        client.email.toLowerCase().includes(searchTerm.toLowerCase())
    );

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
                        <select name="roles" multiple value={newClientData.roles|| []} onChange={handleNewClientChange} className="form-multiselect">
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
                        <input type="text" name="nombre" placeholder="Nombre" value={editingClient.nombre || ''} onChange={handleEditingClientChange} required />
                        <input type="text" name="apellido" placeholder="Apellido" value={editingClient.apellido || ''} onChange={handleEditingClientChange} required />
                        <input type="email" name="email" placeholder="Email" value={editingClient.email || ''} onChange={handleEditingClientChange} required />
                        <input type="text" name="dni" placeholder="DNI" value={editingClient.dni || ''} onChange={handleEditingClientChange} required />
                        <label>Fecha de Nacimiento:</label>
                        <input type="date" name="fechaNacimiento" value={editingClient.fechaNacimiento || ''} onChange={handleEditingClientChange} required />
                        <label>Sexo:</label>
                        <select name="sexo" value={editingClient.sexo} onChange={handleEditingClientChange}>
                            <option value="Otro">Otro</option>
                            <option value="Masculino">Masculino</option>
                            <option value="Femenino">Femenino</option>
                        </select>
                        <input type="text" name="telefonoEmergencia" placeholder="Teléfono de Emergencia" value={editingClient.telefonoEmergencia || ''} onChange={handleEditingClientChange} required />
                        <input type="text" name="direccion" placeholder="Dirección" value={editingClient.direccion || ''} onChange={handleEditingClientChange} />
                        <input type="text" name="numeroTelefono" placeholder="Número de Teléfono" value={editingClient.numeroTelefono || ''} onChange={handleEditingClientChange} />
                        <input type="text" name="obraSocial" placeholder="Obra Social" value={editingClient.obraSocial || ''} onChange={handleEditingClientChange} />
                        
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
                        
                        <fieldset className="plan-section">
                            <legend>Suscripciones Automáticas</legend>
                            {(clientToManagePlan.monthlySubscriptions && clientToManagePlan.monthlySubscriptions.length > 0) ? (
                                <ul className="subscription-list">
                                    {clientToManagePlan.monthlySubscriptions.map(sub => (
                                        <li key={sub._id} className="subscription-item">
                                            <span>&#10004; {sub.tipoClase?.nombre || 'Clase desconocida'} ({sub.autoRenewAmount} créditos/mes)</span>
                                            <button onClick={() => handleRemoveSubscription(sub.tipoClase?._id)} className="btn btn-sm danger">Quitar</button>
                                        </li>
                                    ))}
                                </ul>
                            ) : <p className="no-data-message">Este socio no tiene suscripciones automáticas.</p>}
                        </fieldset>
                        <fieldset className="plan-section">
                            <legend>Planes por Horario Fijo</legend>
                            {(clientToManagePlan.planesFijos && clientToManagePlan.planesFijos.length > 0) ? (
                                <ul className="subscription-list">
                                    {clientToManagePlan.planesFijos.map(plan => (
                                        <li key={plan._id} className="subscription-item">
                                            <span>
                                                &#128197; {plan.tipoClase?.nombre}: {plan.diasDeSemana.join(', ')} a las {plan.horaInicio}
                                            </span>
                                            <button onClick={() => handleRemoveFixedPlan(clientToManagePlan._id, plan._id)} className="btn btn-sm danger">Quitar</button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <p className="no-data-message">Este socio no tiene planes de horario fijo.</p>
                            )}
                        </fieldset>

                        <form onSubmit={handlePlanSubmit}>
                            <fieldset className="plan-section">
                                <legend>Carga de Créditos y Suscripción</legend>
                                <label>Tipo de Clase:</label>
                                <select name="tipoClaseId" value={planData.tipoClaseId} onChange={handlePlanChange} required>
                                    <option value="">-- Selecciona un tipo --</option>
                                    {(classTypes || []).map(type => 
                                        <option key={type._id} value={type._id}>{type.nombre}</option>
                                    )}
                                </select>

                                {planData.tipoClaseId && (
                                    <p className="available-credits-text">
                                        Créditos disponibles para asignar: <strong>{classTypes.find(t => t._id === planData.tipoClaseId)?.creditosDisponibles || 0}</strong>
                                    </p>
                                )}

                                <label>Modificar Créditos (ej: 10 para añadir, -5 para quitar):</label>
                                <input type="number" name="creditsToAdd" value={planData.creditsToAdd} onChange={handlePlanChange} />
                                
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
                                <div className="modal-actions">
                                    <button type="submit" className="btn success">Guardar Cambios</button>
                                </div>
                            </fieldset>
                        </form>

                    {/* --- 3. FORMULARIO DE INSCRIPCIÓN MASIVA --- */}
                    <fieldset className="plan-section">
                            <legend>Inscripción Masiva por Horario</legend>
                            
                            <form onSubmit={findAvailableSlots}>
                                <p><strong>Paso 1:</strong> Filtra para encontrar los horarios disponibles.</p>
                                <label>Tipo de Clase:</label>
                                <select name="tipoClaseId" value={massEnrollFilters.tipoClaseId} onChange={handleMassEnrollFilterChange} required>
                                    <option value="">-- Selecciona un tipo --</option>
                                    {(classTypes || []).map(type => <option key={type._id} value={type._id}>{type.nombre}</option>)}
                                </select>

                                <label>Días de la Semana:</label>
                                <div className="checkbox-group">
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                                        <label key={day} className="checkbox-label">
                                            <input type="checkbox" name="diasDeSemana" value={day} checked={massEnrollFilters.diasDeSemana.includes(day)} onChange={handleMassEnrollFilterChange} /> {day}
                                        </label>
                                    ))}
                                </div>

                                <label>Desde:</label>
                                <input type="date" name="fechaInicio" value={massEnrollFilters.fechaInicio} onChange={handleMassEnrollFilterChange} required />
                                <label>Hasta:</label>
                                <input type="date" name="fechaFin" value={massEnrollFilters.fechaFin} onChange={handleMassEnrollFilterChange} required />

                                <div className="modal-actions">
                                    <button type="submit" className="btn info" disabled={isLoadingSlots}>
                                        {isLoadingSlots ? 'Buscando...' : 'Buscar Horarios'}
                                    </button>
                                </div>
                            </form>
                            
                            {availableSlots.length > 0 && (
                                <form onSubmit={handleMassEnrollSubmit} className="slots-selection">
                                    <p><strong>Paso 2:</strong> Selecciona el horario a inscribir.</p>
                                    <div className="radio-group">
                                        {availableSlots.map((slot, index) => (
                                            <label key={index} className="radio-label">
                                                <input type="radio" name="selectedSlot" value={index}
                                                    checked={selectedSlot?.horaInicio === slot.horaInicio}
                                                    onChange={() => setSelectedSlot(slot)} />
                                                {slot.horaInicio} - {slot.horaFin}
                                            </label>
                                        ))}
                                    </div>
                                    
                                    <div className="modal-actions">
                                        <button type="submit" className="btn accent" disabled={!selectedSlot}>
                                            Inscribir en Horario Seleccionado
                                        </button>
                                    </div>
                                </form>
                            )}
                        </fieldset>

                        <div className="modal-actions">
                            <button type="button" onClick={() => setShowPlanForm(false)} className="btn">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {viewingLogsFor && (
                <CreditLogModal
                    client={viewingLogsFor}
                    onClose={() => setViewingLogsFor(null)}
                />
            )}

            <input
                type="text"
                placeholder="Buscar por nombre o email..."
                className="search-input"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
            />

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre Completo</th>
                            <th>Email</th>
                            <th>Créditos</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {filteredClients.map(client => (
                            <tr key={client._id}>
                                <td>{client.nombre} {client.apellido}</td>
                                <td>{client.email}</td>
                                <td>
                                    {Object.entries(client.creditosPorTipo || {}).map(([typeId, amount]) => {
                                        const typeName = (classTypes || []).find(t => t._id === typeId)?.nombre || 'Desconocido';
                                        return <div key={typeId}>{typeName}: {amount}</div>;
                                    })}
                                </td>
                                <td>
                                    <button onClick={() => setViewingLogsFor(client)} className="btn btn-sm secondary">Historial</button>
                                    <button onClick={() => handleOpenPlanForm(client)} className="btn btn-sm info">Plan/Créditos</button>
                                    <button onClick={() => handleEditClient(client)} className="btn btn-sm primary">Editar</button>
                                    <button onClick={() => handleDeleteClient(client._id)} className="btn btn-sm danger">Eliminar</button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            

            {/* --- RENDERIZADO DEL NUEVO MODAL --- */}
            {viewingLogsFor && (
                <CreditLogModal
                    client={viewingLogsFor}
                    onClose={() => setViewingLogsFor(null)}
                />
            )}
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false, message: '', type: '' })} />
            <ConfirmationModal show={confirmation.show} message={confirmation.message} onConfirm={handleConfirm} onCancel={closeConfirmation} />
        </div>
    );
}

export default ClientManagement;