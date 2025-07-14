// src/components/dashboard/ClassManagement.jsx
import React, { useEffect, useState } from 'react';
import apiClient from '../../services/api'; 
import authService from '../../services/authService';
import ClassCalendar from '../common/ClassCalendar'; 
import Notification from '../common/Notification';
import ConfirmationModal from '../common/ConfirmationModal';

// Array de colores para asignar a los tipos de clase en el calendario y lista.
// Estos corresponden a las variables CSS --class-type-color-X definidas en Dashboard.css
const CLASS_TYPE_COLORS = [
    'var(--class-type-color-1)',
    'var(--class-type-color-2)',
    'var(--class-type-color-3)',
    'var(--class-type-color-4)',
    'var(--class-type-color-5)',
    'var(--class-type-color-6)',
    'var(--class-type-color-7)',
    'var(--class-type-color-8)',
    'var(--class-type-color-9)',
    'var(--class-type-color-10)',
];

const classTypeColorMap = new Map();
let colorIndex = 0;

function getColorForClassType(typeId) {
    if (!typeId) return '#ffffff'; // Fallback a blanco si no hay ID de tipo de clase
    if (!classTypeColorMap.has(typeId)) {
        classTypeColorMap.set(typeId, CLASS_TYPE_COLORS[colorIndex % CLASS_TYPE_COLORS.length]);
        colorIndex++;
    }
    return classTypeColorMap.get(typeId);
}

// ClassManagement ahora recibe classTypes y fetchClassTypes como props
function ClassManagement({ classTypes, fetchClassTypes }) { 
    const [classes, setClasses] = useState([]);
    const [teachers, setTeachers] = useState([]); 
    const [showForm, setShowForm] = useState(false);
    const [editingClass, setEditingClass] = useState(null);
    const [formData, setFormData] = useState({
    tipoClase: '', 
    nombre: '',
    fecha: '', // Para clases libres
    horaInicio: '', 
    horaFin: '', 
    capacidad: 0,
    profesor: '', 
    tipoInscripcion: 'libre',
    diaDeSemana: [], 
    fechaInicio: '', 
    fechaFin: '',    
});
    const [activeTab, setActiveTab] = useState('calendar');

    const [groupedClasses, setGroupedClasses] = useState([]);

    const [showBulkEditModal, setShowBulkEditModal] = useState(false);
    const [editingGroup, setEditingGroup] = useState(null);
    const [bulkUpdates, setBulkUpdates] = useState({ profesor: '', horaInicio: '', horaFin: '' });

    const [showRosterModal, setShowRosterModal] = useState(false);
    const [viewingClassRoster, setViewingClassRoster] = useState(null);

    const [showExtendModal, setShowExtendModal] = useState(false);
    const [extendingGroup, setExtendingGroup] = useState(null);
    const [extendUntilDate, setExtendUntilDate] = useState('');
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ show: false, message: '', onConfirm: null });
    const [showCancelModal, setShowCancelModal] = useState(false);
    const [showCancelDayModal, setShowCancelDayModal] = useState(false);
    const [classToCancel, setClassToCancel] = useState(null);
    const [showReactivateModal, setShowReactivateModal] = useState(false); // Nuevo estado para modal de reactivar
    const [classToReactivate, setClassToReactivate] = useState(null); // Nuevo estado para clase a reactivar

    const [dayToManage, setDayToManage] = useState('');

    const daysOfWeekOptions = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];

     const showNotification = (message, type = 'success', duration = 4000) => {
        setNotification({ show: true, message, type });
        setTimeout(() => setNotification({ show: false, message: '', type: '' }), duration);
    };

    const askConfirmation = (message, onConfirm) => setConfirmation({ show: true, message, onConfirm });
    
    const closeConfirmation = () => setConfirmation({ show: false, message: '', onConfirm: null });
    
    const handleConfirm = () => {
        if (confirmation.onConfirm) confirmation.onConfirm();
        closeConfirmation();
    }


    useEffect(() => {
        fetchClasses();
        fetchTeachers(); 
        fetchGroupedClasses();
    }, []); 

    const fetchClasses = async () => {
        try {
            const response = await apiClient.get('/classes');
            setClasses(response.data);

        } catch (error) {
            console.error('[ClassManagement] Error al obtener clases:', error.response?.data?.message || error.message);
            setClasses([]); 
        }
    };

    const fetchTeachers = async () => {
        try {
            const response = await apiClient.get('/users?role=profesor');
            if (Array.isArray(response.data)) {
                setTeachers(response.data)
            } else {
                console.error('[ClassManagement] API for teachers returned non-array data:', response.data);
                setTeachers([]); 
            }
        } catch (error) {
            console.error('[ClassManagement] Error al obtener profesores:', error.response?.data?.message || error.message);
            setTeachers([]); 
        }
    };

    const fetchGroupedClasses = async () => {
        try {
             const response = await apiClient.get('/classes/grouped');
            setGroupedClasses(response.data);
        } catch (error) {
            console.error('Error al obtener clases agrupadas:', error.response?.data?.message || error.message);
        }
    };

    const handleChange = (e) => {
        const { name, value, type, checked } = e.target;
        let newValue = value;

        if (name === 'capacidad') {
            newValue = parseInt(value, 10) || 0; 
        } else if (name === 'diaDeSemana') {
            newValue = checked
                ? [...formData.diaDeSemana, value]
                : formData.diaDeSemana.filter(day => day !== value);
        } else if (name === 'tipoInscripcion') {
            setFormData(prevFormData => ({
                ...prevFormData,
                [name]: newValue,
                fecha: '', 
                horaInicio: '', 
                horaFin: '',       
                horarioFijo: '', 
                diaDeSemana: [], 
            }));
            return; 
        }

        setFormData(prevFormData => ({ ...prevFormData, [name]: newValue }));
    };

    const handleAddSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...formData };
        if (!payload.profesor) delete payload.profesor;
        try {
             await apiClient.post('/classes', payload);
            showNotification('Clase/s creada/s exitosamente.', 'success');
            setShowForm(false);
            setFormData({ /* ...reset... */ });
            fetchClasses();
            fetchGroupedClasses();
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al añadir clase', 'error');
        }
    };

    const handleEdit = (classItem) => {
        setEditingClass(classItem);
        const formattedDate = classItem.fecha ? new Date(classItem.fecha).toISOString().substring(0, 10) : ''; 
        
        let itemDiaDeSemana = Array.isArray(classItem.diaDeSemana) ? classItem.diaDeSemana : [];

        let initialHoraInicio = classItem.horaInicio || '';
        let initialHoraFin = classItem.horaFin || '';

        if (classItem.tipoInscripcion === 'fijo' && classItem.horarioFijo && (!classItem.horaInicio || !classItem.horaFin)) {
            const timeParts = classItem.horarioFijo.split(' - ').map(s => s.trim());
            if (timeParts.length === 2) {
                initialHoraInicio = timeParts[0];
                initialHoraFin = timeParts[1];
            }
        }

        setFormData({
            tipoClase: classItem.tipoClase?._id || '', 
            nombre: classItem.nombre,
            fecha: formattedDate,
            horaInicio: initialHoraInicio, 
            horaFin: initialHoraFin, 
            capacidad: classItem.capacidad || 0, 
            profesor: classItem.profesor?._id || '', 
            tipoInscripcion: classItem.tipoInscripcion,
            horarioFijo: classItem.horarioFijo || '', 
            diaDeSemana: itemDiaDeSemana, 
        });
        setShowForm(true);
    };

    const handleUpdateSubmit = async (e) => {
        e.preventDefault();
        const payload = { ...formData };

        if (payload.tipoInscripcion === 'fijo') {
            delete payload.fecha;
            payload.horarioFijo = `${payload.horaInicio} - ${payload.horaFin}`; 
        } else { 
            delete payload.horarioFijo;
            delete payload.diaDeSemana;
        }
        try {
            await apiClient.put(`/classes/${editingClass._id}`, payload);
            setShowForm(false);
            setEditingClass(null);
            setFormData({ 
                tipoClase: '', nombre: '', fecha: '', horaInicio: '', horaFin: '', 
                capacidad: 0, profesor: '', tipoInscripcion: 'libre', horarioFijo: '', diaDeSemana: []
            }); 
            fetchClasses();
            fetchGroupedClasses();
        } catch (error) {
            console.error('[ClassManagement] Error al actualizar clase:', error.response?.data?.message || error.message);
        }
    };



    const handleCancelClass = (classItem) => {
        setClassToCancel(classItem);
        setShowCancelModal(true);
    };

    const confirmCancelClass = async (refundCredits) => {
        if (!classToCancel) return;

        try {
             await apiClient.put(`/classes/${classToCancel._id}/cancel`, { refundCredits });
            setShowCancelModal(false);
            setClassToCancel(null);
            fetchClasses(); 
        } catch (error) {
            console.error('[ClassManagement] Error al cancelar clase:', error.response?.data?.message || error.message);
        }
    };

    const handleReactivateClass = (classItem) => {
        setClassToReactivate(classItem);
        setShowReactivateModal(true);
    };

    const confirmReactivateClass = async () => {
        if (!classToReactivate) return;
        try {
           await apiClient.put(`/classes/${classToReactivate._id}/reactivate`, {});
            setShowReactivateModal(false);
            setClassToReactivate(null);
            fetchClasses(); // Refetch classes to update the calendar
        } catch (error) {
            console.error('[ClassManagement] Error al reactivar clase:', error.response?.data?.message || error.message);
        }
    };

    const handleDelete = (classId) => {
        askConfirmation('¿Seguro que quieres eliminar esta clase permanentemente?', async () => {
            try {
                await apiClient.delete(`/classes/${classId}`);
                showNotification('Clase eliminada.', 'success');
                fetchClasses();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al eliminar.', 'error');
            }
        });
    };

     const handleOpenBulkEditModal = (group) => {
        setEditingGroup(group);
        setBulkUpdates({ profesor: '', horaInicio: group.horaInicio, horaFin: group.horaFin, diasDeSemana: [...group.diasDeSemana] });
        setShowBulkEditModal(true);
    };
    const handleOpenExtendModal = (group) => {
    setExtendingGroup(group); 
    setShowExtendModal(true);  
    setExtendUntilDate('');  
};

     const handleBulkUpdateChange = (e) => {
        const { name, value, type, checked } = e.target;
        if (name === 'diasDeSemana') {
            const newDays = checked 
                ? [...bulkUpdates.diasDeSemana, value] 
                : bulkUpdates.diasDeSemana.filter(day => day !== value);
            setBulkUpdates(prev => ({ ...prev, diasDeSemana: newDays }));
        } else {
            setBulkUpdates(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleBulkUpdate = async () => {
    if (!editingGroup) return;
    const updates = Object.fromEntries(Object.entries(bulkUpdates).filter(([key, value]) => {
        if (typeof value === 'string') {
            return value.trim() !== ''; // Para texto (profesor, horaInicio, horaFin)
        }
        if (Array.isArray(value)) {
            return value.length > 0; // Para el array de diasDeSemana
        }
        return value != null; // Para cualquier otro tipo en el futuro
    }));

    if (Object.keys(updates).length === 0) {
        return alert('Por favor, ingresa al menos un campo para actualizar.');
    }

    const filters = {
        nombre: editingGroup.nombre,
        tipoClase: editingGroup.tipoClase._id,
        horaInicio: editingGroup.horaInicio,
        fechaDesde: new Date().toISOString().substring(0, 10),
    };

    askConfirmation('¿Actualizar todas las instancias futuras de este grupo?', async () => {
            try {
                const response = await apiClient.put('/classes/bulk-update', { filters, updates });
                showNotification(response.data.message, 'success');
                setShowBulkEditModal(false);
                fetchClasses();
                fetchGroupedClasses();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al actualizar.', 'error');
            }
        });
};


    const handleBulkDelete = (group) => {
        const filters = {
        nombre: group.nombre,
        tipoClase: group.tipoClase._id, 
        horaInicio: group.horaInicio,
    };
        askConfirmation(`¡CUIDADO! Se eliminarán ${group.cantidadDeInstancias} clases. ¿Continuar?`, async () => {
            try {
                const response = await apiClient.post('/classes/bulk-delete', { filters });
                showNotification(response.data.message, 'success');
                fetchClasses();
                fetchGroupedClasses();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al eliminar en lote.', 'error');
            }
        });
    };

    const handleExtendSubmit = async () => {
        if (!extendingGroup || !extendUntilDate) {
            return alert('Por favor, selecciona una fecha para extender las clases.');
        }

        const filters = {
            nombre: extendingGroup.nombre,
            tipoClase: extendingGroup.tipoClase._id,
            horaInicio: extendingGroup.horaInicio,
        };

        const extension = { fechaFin: extendUntilDate };

        askConfirmation('¿Confirmas la extensión de estas clases?', async () => {
            try {
                const response = await apiClient.post('/classes/bulk-extend', { filters, extension });
                showNotification(response.data.message, 'success');
                setShowExtendModal(false);
                fetchClasses();
                fetchGroupedClasses();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al extender.', 'error');
            }
        });
    };
     const handleCancelDay = () => { 
        if (!dayToManage) { 
            showNotification('Por favor, selecciona una fecha primero.', 'error'); 
            return; 
        } 
        setShowCancelDayModal(true); 
    };

    const confirmCancelDay = async (refundCredits) => {
        if (!dayToManage) return;

        try {
            const response = await apiClient.post('/classes/cancel-day', { 
                date: dayToManage, 
                refundCredits: refundCredits // Pasa la opción de reembolso a la API
            });
            showNotification(response.data.message, 'success');
            fetchClasses(); // Actualiza la lista de clases
        } catch (error) {
            showNotification(error.response?.data?.message || 'Error al cancelar el día.', 'error');
        } finally {
            setShowCancelDayModal(false); // Cierra el modal
        }
    };

    const handleReactivateDay = () => {
        if (!dayToManage) {
            showNotification('Por favor, selecciona una fecha primero.', 'error');
            return;
        }
        askConfirmation(
            `¿Seguro que quieres reactivar TODAS las clases canceladas del día ${dayToManage}?`,
            async () => {
                try {
                    const response = await apiClient.post('/classes/reactivate-day', { date: dayToManage });
                    showNotification(response.data.message, 'success');
                    fetchClasses(); // Actualizamos la lista de clases
                } catch (error) {
                    showNotification(error.response?.data?.message || 'Error al reactivar el día.', 'error');
                }
            }
        );
    };

    const handleViewRoster = async (classId) => {
    try {
        const response = await apiClient.get(`/classes/${classId}`);
        setViewingClassRoster(response.data);
        setShowRosterModal(true);
    } catch (error) {
        showNotification('Error al obtener los detalles de la clase.', 'error');
    }
};
    

    return (
        <div className="dashboard-section">
             <button onClick={() => setActiveTab('calendar')} className={`btn ${activeTab === 'calendar' ? 'primary' : 'secondary'}`}>Ver Calendario</button>
            <button onClick={() => setActiveTab('bulk')} className={`btn ${activeTab === 'bulk' ? 'primary' : 'secondary'}`}>Gestionar Clases Fijas</button>
            <button onClick={() => setActiveTab('day-management')} className={`btn ${activeTab === 'day-management' ? 'primary' : 'secondary'}`}>Cancelar Día</button>
           
            {activeTab === 'calendar' && (
                <>
                    <button onClick={() => { setShowForm(!showForm); setEditingClass(null); }} className="btn primary1">
                        {showForm ? 'Cancelar' : 'Añadir Nuevas Clases'}
                    </button>
                    {showForm && (
                        <form onSubmit={editingClass ? handleUpdateSubmit : handleAddSubmit} className="form-card">
                            <h4>{editingClass ? 'Editar Clase' : 'Añadir Nueva Clase'}</h4>
                            <input type="text" name="nombre" placeholder="Nombre de la clase" value={formData.nombre} onChange={handleChange} required />
                            <select name="tipoClase" value={formData.tipoClase} onChange={handleChange} required>
                                <option value="">Selecciona un tipo</option>
                                {(classTypes || []).map(type => <option key={type._id} value={type._id}>{type.nombre}</option>)}
                            </select>
                            <select name="profesor" value={formData.profesor} onChange={handleChange}>
                                <option value="">Selecciona un profesor (opcional)</option>
                                {teachers.map(teacher => <option key={teacher._id} value={teacher._id}>{teacher.nombre} {teacher.apellido}</option>)}
                            </select>
                            <input type="number" name="capacidad" placeholder="Capacidad" value={formData.capacidad} onChange={handleChange} required min="1" />
                            <select name="tipoInscripcion" value={formData.tipoInscripcion} onChange={handleChange} required>
                                <option value="libre">Libre (Fecha Única)</option>
                                <option value="fijo">Fijo (Recurrente)</option>
                            </select>
                            {formData.tipoInscripcion === 'fijo' ? (
                                <>
                                    <label>Horario Fijo:</label>
                                    <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleChange} required />
                                    <input type="time" name="horaFin" value={formData.horaFin} onChange={handleChange} required />
                                    <label>Generar desde:</label>
                                    <input type="date" name="fechaInicio" value={formData.fechaInicio} onChange={handleChange} required />
                                    <label>Generar hasta:</label>
                                    <input type="date" name="fechaFin" value={formData.fechaFin} onChange={handleChange} required />
                                    <label>Días de la Semana:</label>
                                    <div className="flex flex-wrap gap-2 mb-4">{daysOfWeekOptions.map(day => <label key={day} className="flex items-center space-x-2"><input type="checkbox" name="diaDeSemana" value={day} checked={formData.diaDeSemana.includes(day)} onChange={handleChange}/><span>{day}</span></label>)}</div>
                                </>
                            ) : (
                                <>
                                    <label>Fecha:</label>
                                    <input type="date" name="fecha" value={formData.fecha} onChange={handleChange} required />
                                    <label>Horario:</label>
                                    <input type="time" name="horaInicio" value={formData.horaInicio} onChange={handleChange} required />
                                    <input type="time" name="horaFin" value={formData.horaFin} onChange={handleChange} required />
                                </>
                            )}
                            <button type="submit" className="btn success">{editingClass ? 'Actualizar' : 'Añadir'}</button>
                        </form>
                    )}
                    <div style={{marginTop: '2rem'}}>
                        <ClassCalendar classes={classes} onEditClass={handleEdit} onCancelClass={handleCancelClass} onDeleteClass={handleDelete} onReactivateClass={handleReactivateClass} classTypes={classTypes} getColorForClassType={getColorForClassType} onViewRoster={handleViewRoster} />
                    </div>
                </>
            )}

            {activeTab === 'bulk' && (
                <div className="table-responsive" style={{marginTop: '1rem'}}>
                    <h4>Grupos de Clases Fijas Futuras</h4>
                    <p>Desde aquí podés editar o eliminar todas las instancias futuras de un grupo de clases.</p>
                    <table className="data-table">
                        <thead>
                            <tr>
                                <th>Nombre Clase</th>
                                <th>Tipo</th>
                                <th>Horario</th>
                                <th>Días</th>
                                <th>Profesor Actual</th>
                                <th>Próximas Clases</th>
                                <th>Acciones</th>
                            </tr>
                        </thead>
                        <tbody>
                            {groupedClasses.length > 0 ? groupedClasses.map((group, index) => (
                                <tr key={index}>
                                    <td>{group.nombre}</td>
                                    <td>{group.tipoClase?.nombre || 'N/A'}</td>
                                    <td>{group.horaInicio} - {group.horaFin}</td>
                                    <td>{group.diasDeSemana.sort().join(', ')}</td>
                                    <td>{group.profesor ? `${group.profesor.nombre} ${group.profesor.apellido}` : 'No asignado'}</td>
                                    <td>{group.cantidadDeInstancias}</td>
                                    <td>
                                        <button onClick={() => handleOpenBulkEditModal(group)} className="btn btn-sm primary">Editar</button>
                                        <button onClick={() => handleOpenExtendModal(group)} className="btn btn-sm success">Extender</button>
                                        <button onClick={() => handleBulkDelete(group)} className="btn btn-sm danger">Eliminar</button>
                                    </td>
                                </tr>
                            )) : (
                                <tr><td colSpan="7" style={{textAlign: 'center'}}>No hay grupos de clases fijas futuras para mostrar.</td></tr>
                            )}
                        </tbody>
                    </table>
                </div>
            )}

            {activeTab === 'day-management' && (
                <div className="day-management-section">
                    <h4>Gestión por Día Completo</h4>
                    <p>Selecciona una fecha para cancelar o reactivar todas sus clases por un evento especial o feriado.</p>
                    <div className="day-management-controls">
                        <input 
                            type="date" 
                            value={dayToManage}
                            onChange={(e) => setDayToManage(e.target.value)}
                            className="form-input"
                        />
                        <button onClick={handleCancelDay} className="btn danger">Cancelar Día</button>
                        <button onClick={handleReactivateDay} className="btn primary1">Reactivar Día</button>
                    </div>
                </div>
            )}
            {showCancelDayModal && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h4>Confirmar Cancelación de Día</h4>
                        <p>¿Estás seguro de que quieres cancelar TODAS las clases del día <strong>{dayToManage}</strong>?</p>
                        <p>Esta acción es irreversible.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                            <button onClick={() => confirmCancelDay(true)} className="btn success">Sí, con reembolso</button>
                            <button onClick={() => confirmCancelDay(false)} className="btn warning">Sí, sin reembolso</button>
                            <button onClick={() => setShowCancelDayModal(false)} className="btn danger">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}
            
            {showBulkEditModal && editingGroup && (
                <div className="modal-overlay">
                    <div className="modal-content" style={{textAlign: 'left'}}>
                        <h4>Editar Grupo: "{editingGroup.nombre}" de las {editingGroup.horaInicio}</h4>
                        <p>Los cambios se aplicarán a todas las instancias futuras de este grupo.</p>
                        <div className="form-card" style={{ boxShadow: 'none', border: 'none', padding: 0 }}>
                            <label>Nuevo Horario de Inicio:</label>
                            <input type="time" name="horaInicio" value={bulkUpdates.horaInicio} onChange={handleBulkUpdateChange} />
                            
                            <label>Nuevo Horario de Fin:</label>
                            <input type="time" name="horaFin" value={bulkUpdates.horaFin} onChange={handleBulkUpdateChange} />
                            
                            <label>Nuevo Profesor:</label>
                            <select name="profesor" value={bulkUpdates.profesor} onChange={handleBulkUpdateChange}>
                                <option value="">-- No cambiar --</option>
                                {teachers.map(t => <option key={t._id} value={t._id}>{t.nombre} {t.apellido}</option>)}
                            </select>
                             <label>Nuevos Días de la Semana:</label>
                        <div>
                            {daysOfWeekOptions.map(day => (
                                <label key={day}>
                                    <input
                                        type="checkbox"
                                        name="diasDeSemana"
                                        value={day}
                                        checked={bulkUpdates.diasDeSemana.includes(day)}
                                        onChange={handleBulkUpdateChange}
                                    /> {day}
                                </label>
                            ))}
                        </div>
                        </div>
                        <div className="modal-actions" style={{ marginTop: '20px', justifyContent: 'center' }}>
                            <button onClick={handleBulkUpdate} className="btn success">Guardar Cambios</button>
                            <button onClick={() => setShowBulkEditModal(false)} className="btn danger">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
             {showExtendModal && extendingGroup && (
                 <div className="modal-overlay">
                    <div className="modal-content" style={{textAlign: 'left'}}>
                        <h4>Extender Clases de "{extendingGroup.nombre}"</h4>
                        <p>Las clases se crearán con la misma configuración (horario, profesor, etc.) hasta la fecha que elijas.</p>
                        <label>Extender hasta:</label>
                        <input 
                            type="date" 
                            value={extendUntilDate} 
                            onChange={(e) => setExtendUntilDate(e.target.value)}
                        />
                         <div className="modal-actions" style={{ marginTop: '20px', justifyContent: 'center' }}>
                            <button onClick={handleExtendSubmit} className="btn success">Confirmar Extensión</button>
                            <button onClick={() => setShowExtendModal(false)} className="btn danger">Cancelar</button>
                        </div>
                    </div>
                 </div>
            )}
            {showCancelModal && classToCancel && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h4>Confirmar Cancelación de Clase</h4>
                        <p>¿Estás seguro de que quieres cancelar la clase "{classToCancel.nombre}" del {classToCancel.fecha ? new Date(classToCancel.fecha).toLocaleDateString('es-AR') : 'N/A'}?</p>
                        <p>¿Deseas devolver los créditos a los usuarios inscritos?</p>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                            <button onClick={() => confirmCancelClass(true)} className="btn success">Sí, con reembolso</button>
                            <button onClick={() => confirmCancelClass(false)} className="btn warning">No, sin reembolso</button>
                            <button onClick={() => { setShowCancelModal(false); setClassToCancel(null); }} className="btn danger">Cerrar</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Nuevo Modal de confirmación para reactivar clase */}
            {showReactivateModal && classToReactivate && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <h4>Confirmar Reactivación de Clase</h4>
                        <p>¿Estás seguro de que quieres reactivar la clase "{classToReactivate.nombre}" del {classToReactivate.fecha ? new Date(classToReactivate.fecha).toLocaleDateString('es-AR') : 'N/A'}?</p>
                        <p>La clase volverá a estar activa y disponible para nuevas inscripciones. Los usuarios previamente inscritos no se restaurarán automáticamente.</p>
                        <div style={{ display: 'flex', justifyContent: 'space-around', marginTop: '20px' }}>
                            <button onClick={confirmReactivateClass} className="btn success">Sí, Reactivar</button>
                            <button onClick={() => { setShowReactivateModal(false); setClassToReactivate(null); }} className="btn danger">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
            {showRosterModal && viewingClassRoster && (
            <div className="modal-overlay">
                <div className="modal-content form-card" style={{ maxWidth: '800px', minWidth: '600px' }}>
                    <h4>Inscriptos en: {viewingClassRoster.nombre}</h4>
                    <p>
                        {new Date(viewingClassRoster.fecha).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })}
                        {' de '}
                        {viewingClassRoster.horaInicio} a {viewingClassRoster.horaFin}
                    </p>
                    
                    <div className="table-responsive" style={{ marginTop: '20px' }}>
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Nombre y Apellido</th>
                                    <th>Edad</th>
                                    <th>Sexo</th>
                                    <th>Tel. Emergencia</th>
                                    <th>Obra Social</th>
                                </tr>
                            </thead>
                            <tbody>
                                {viewingClassRoster.usuariosInscritos.length > 0 ? (
                                    viewingClassRoster.usuariosInscritos.map(user => (
                                        <tr key={user._id}>
                                            <td>{user.nombre} {user.apellido}</td>
                                            <td>{user.edad}</td>
                                            <td>{user.sexo}</td>
                                            <td>{user.telefonoEmergencia}</td>
                                            <td>{user.obraSocial || 'N/A'}</td>
                                        </tr>
                                    ))
                                ) : (
                                    <tr>
                                        <td colSpan="5" style={{ textAlign: 'center' }}>No hay socios inscriptos en esta clase.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div className="modal-actions">
                        <button onClick={() => setShowRosterModal(false)} className="btn">Cerrar</button>
                    </div>
                </div>
            </div>
        )}
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false })} />
            <ConfirmationModal show={confirmation.show} message={confirmation.message} onConfirm={handleConfirm} onCancel={closeConfirmation} />
        </div>
    );
}

export default ClassManagement;
