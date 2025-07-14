// GYM-APP/frontend/src/pages/NotificationAdminPage.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import notificationService from '../../services/notificationService';
import userService from '../../services/userService'; 
import classService from '../../services/classService'; 
import '../../styles/NotificationPush.css'; 
import Notification from '../common/Notification';
import ConfirmationModal from '../common/ConfirmationModal';



function NotificationAdminPage() {
    const { userInfo } = useAuth();
    const [title, setTitle] = useState(''); 
    const [message, setMessage] = useState('');
    const [isImportant, setIsImportant] = useState(false);

    // Recipient selection states
    const [targetType, setTargetType] = useState('all');
    const [selectedUserId, setSelectedUserId] = useState('');
    const [selectedRoleId, setSelectedRoleId] = useState(''); 
    const [selectedClassId, setSelectedClassId] = useState('');

    // Data from API (unfiltered)
    const [allClients, setAllClients] = useState([]);
    const [allProfessors, setAllProfessors] = useState([]);
    const [allClasses, setAllClasses] = useState([]);

    // Filtering states for display
    const [userSearchTerm, setUserSearchTerm] = useState('');
    const [userFilterRole, setUserFilterRole] = useState(''); 
    const [classFilterDay, setClassFilterDay] = useState('');
    const [classFilterDate, setClassFilterDate] = useState(null); // New state for date filter (Date object)

    const [loadingData, setLoadingData] = useState(true);
    const [sending, setSending] = useState(false);
     const [notification, setNotificationState] = useState({ message: '', type: '' });
    const [modal, setModalState] = useState({
        show: false,
        message: '',
        payload: null,
    });

    // Función para mostrar notificaciones y que desaparezcan solas
    const showNotification = (message, type) => {
        setNotificationState({ message, type });
        setTimeout(() => {
            setNotificationState({ message: '', type: '' });
        }, 5000); // La notificación desaparecerá después de 5 segundos
    };

    // Fetch initial data for dropdowns
    useEffect(() => {
        const fetchDropdownData = async () => {
            try {
                setLoadingData(true);
                const [clientsData, professorsData, classesData] = await Promise.all([
                    userService.getAllUsers('cliente'),
                    userService.getAllUsers('profesor'),
                    classService.getAllClasses()
                ]);
                setAllClients(clientsData);
                setAllProfessors(professorsData);
                setAllClasses(classesData);
            } catch (err) {
                showNotification(err.message || 'Error al cargar datos', 'error');
            } finally {
                setLoadingData(false);
            }
        };

        if (userInfo?.roles.includes('admin')) {
            fetchDropdownData();
        } else {
            showNotification('Acceso denegado. Solo los administradores pueden entrar aquí.', 'error');
            setLoadingData(false);
        }
    }, [userInfo]);

    // Memoized filtered users list for display
    const filteredUsers = useMemo(() => {
        let users = [];
        if (userFilterRole === 'cliente') {
            users = allClients;
        } else if (userFilterRole === 'profesor') {
            users = allProfessors;
        } else { 
            users = [...allClients, ...allProfessors];
        }

        if (userSearchTerm) {
            const lowerCaseSearchTerm = userSearchTerm.toLowerCase();
            users = users.filter(user => 
                user.nombre.toLowerCase().includes(lowerCaseSearchTerm) ||
                user.apellido.toLowerCase().includes(lowerCaseSearchTerm) ||
                user.email.toLowerCase().includes(lowerCaseSearchTerm)
            );
        }
        return users.sort((a, b) => a.nombre.localeCompare(b.nombre));
    }, [allClients, allProfessors, userSearchTerm, userFilterRole]);

    // Memoized filtered classes list for display
    const filteredClasses = useMemo(() => {
        let classes = allClasses;

        if (classFilterDay) {
            classes = classes.filter(cls => 
                cls.diaDeSemana && cls.diaDeSemana.includes(classFilterDay)
            );
        }

        if (classFilterDate) {
            // Filter by exact date (ignoring time)
            const filterDateString = classFilterDate.toISOString().split('T')[0];
            classes = classes.filter(cls => 
                cls.fecha && cls.fecha.split('T')[0] === filterDateString
            );
        }

        return classes.sort((a, b) => new Date(a.fecha) - new Date(b.fecha));
    }, [allClasses, classFilterDay, classFilterDate]);


    const handleSubmit = (e) => {
        e.preventDefault();
        
        let payload = { title, message, isImportant, targetType };
        let confirmationMessage = '';

        switch (targetType) {
            case 'user':
                if (!selectedUserId) { showNotification('Por favor, selecciona un usuario.', 'error'); return; }
                payload.targetId = selectedUserId;
                const user = allClients.concat(allProfessors).find(u => u._id === selectedUserId);
                confirmationMessage = `¿Confirmas el envío de esta notificación al usuario ${user?.nombre} ${user?.apellido}?`;
                break;
            case 'role':
                if (!selectedRoleId) { showNotification('Por favor, selecciona un rol.', 'error'); return; }
                payload.targetRole = selectedRoleId;
                confirmationMessage = `¿Confirmas el envío de esta notificación a todos los usuarios con el rol "${selectedRoleId}"?`;
                break;
            case 'class':
                if (!selectedClassId) { showNotification('Por favor, selecciona una clase.', 'error'); return; }
                payload.targetId = selectedClassId;
                const cls = allClasses.find(c => c._id === selectedClassId);
                confirmationMessage = `¿Confirmas el envío de esta notificación a todos los inscritos en la clase "${cls?.nombre}"?`;
                break;
            case 'all':
                confirmationMessage = '¿Estás seguro de que quieres enviar esta notificación a TODOS los usuarios?';
                break;
            default:
                showNotification('Tipo de destinatario inválido.', 'error');
                return;
        }

        setModalState({ show: true, message: confirmationMessage, payload });
    };

    // 4. FUNCIÓN PARA MANEJAR LA CONFIRMACIÓN DEL ENVÍO
    const handleConfirmSend = async () => {
        if (!modal.payload) return;
        
        setSending(true);
        setModalState({ show: false, message: '', payload: null }); // Oculta el modal

        try {
            const response = await notificationService.createNotification(modal.payload);
            showNotification(response.message || 'Notificaciones enviadas con éxito.', 'success');
            // Limpiar formulario
            setTitle('');
            setMessage('');
            setIsImportant(false);
        } catch (err) {
            showNotification(err.message || 'Error al enviar notificaciones.', 'error');
            console.error('Error al enviar notificaciones.:', err);
        } finally {
            setSending(false);
        }
    };

    // 5. FUNCIÓN PARA CANCELAR DESDE EL MODAL
    const handleCancelSend = () => {
        setModalState({ show: false, message: '', payload: null });
    };

    if (!userInfo?.roles.includes('admin')) {
        return <div className="notification-admin-container"><Notification message="Acceso denegado." type="error" /></div>;
    }

    return (
        <div className="notification-admin-container">
            <Notification 
                message={notification.message} 
                type={notification.type} 
                onClose={() => setNotificationState({ message: '', type: '' })} 
            />
            <ConfirmationModal
                show={modal.show}
                title="Confirmar Envío"
                message={modal.message}
                onConfirm={handleConfirmSend}
                onCancel={handleCancelSend}
            />
            <h2>Panel de Envío de Notificaciones</h2>
            {loadingData ? (
                <p>Cargando datos...</p>
            ) : (
                <form onSubmit={handleSubmit} className="notification-form">
                    <div className="form-group">
                    <label htmlFor="title">Titulo:</label> {/* No necesitas `value` en el label */}
                    <input 
                        type="text"
                        id="title"
                        value={title} // Conecta el valor al estado
                        onChange={(e) => setTitle(e.target.value)} // Actualiza el estado al escribir
                        required // Añade validación en el navegador
                        placeholder="Título de la notificación"
                    />
                </div>
                    <div className="form-group">
                        <label htmlFor="message">Mensaje:</label>
                        <textarea
                            id="message"
                            value={message} 
                            onChange={(e) => setMessage(e.target.value)}
                            rows="4"
                            required
                            placeholder="Escribe tu mensaje aquí..."
                        ></textarea>
                    </div>

                    <div className="form-group checkbox-group">
                        <input
                            type="checkbox"
                            id="isImportant"
                            checked={isImportant}
                            onChange={(e) => setIsImportant(e.target.checked)}
                        />
                        <label htmlFor="isImportant">Marcar como Importante (activará modal en móvil)</label>
                    </div>

                    <h3>Destinatarios:</h3>
                    <div className="form-group radio-group">
                        <label>
                            <input type="radio" value="all" checked={targetType === 'all'} onChange={() => setTargetType('all')} />
                            Todos los usuarios
                        </label>
                        <label>
                            <input type="radio" value="user" checked={targetType === 'user'} onChange={() => setTargetType('user')} />
                            Usuario Específico
                        </label>
                        <label>
                            <input type="radio" value="role" checked={targetType === 'role'} onChange={() => setTargetType('role')} />
                            Rol Específico
                        </label>
                        <label>
                            <input type="radio" value="class" checked={targetType === 'class'} onChange={() => setTargetType('class')} />
                            Clase Específica
                        </label>
                    </div>

                    {targetType === 'user' && (
                        <>
                            <div className="form-group">
                                <label htmlFor="userSearchTerm">Buscar Usuario (Nombre, Apellido o Email):</label>
                                <input
                                    type="text"
                                    id="userSearchTerm"
                                    value={userSearchTerm}
                                    onChange={(e) => setUserSearchTerm(e.target.value)}
                                    placeholder="Ej: Juan Pérez, juan@example.com"
                                />
                            </div>
                            <div className="form-group">
                                <label htmlFor="userFilterRole">Filtrar por Rol:</label>
                                <select
                                    id="userFilterRole"
                                    value={userFilterRole}
                                    onChange={(e) => {
                                        setUserFilterRole(e.target.value);
                                        setSelectedUserId(''); // Clear selection when role filter changes
                                    }}
                                >
                                    <option value="">Todos (Clientes y Profesores)</option>
                                    <option value="cliente">Solo Clientes</option>
                                    <option value="profesor">Solo Profesores</option>
                                </select>
                            </div>
                            <div className="selection-list-container">
                                <label>Seleccionar Usuario:</label>
                                <ul className="selection-list user-list">
                                    {filteredUsers.length > 0 ? (
                                        filteredUsers.map(user => (
                                            <li 
                                                key={user._id} 
                                                className={`list-item ${selectedUserId === user._id ? 'selected' : ''}`}
                                                onClick={() => setSelectedUserId(user._id)}
                                            >
                                                <input
                                                    type="radio"
                                                    name="selectedUserRadio"
                                                    value={user._id}
                                                    checked={selectedUserId === user._id}
                                                    onChange={() => setSelectedUserId(user._id)}
                                                    style={{ marginRight: '10px' }}
                                                />
                                                {user.nombre} {user.apellido} ({user.email}) - {user.roles.join(', ')}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="no-results">No se encontraron usuarios</li>
                                    )}
                                </ul>
                                {targetType === 'user' && !selectedUserId && <p className="selection-hint">Por favor, selecciona un usuario de la lista.</p>}
                            </div>
                        </>
                    )}

                    {targetType === 'role' && (
                        <div className="form-group">
                            <label htmlFor="selectedRole">Seleccionar Rol:</label>
                            <select
                                id="selectedRole"
                                value={selectedRoleId}
                                onChange={(e) => setSelectedRoleId(e.target.value)}
                                required={targetType === 'role'}
                            >
                                <option value="">-- Selecciona un rol --</option>
                                <option value="profesor">Profesor</option>
                                <option value="cliente">Cliente</option>
                            </select>
                        </div>
                    )}

                    {targetType === 'class' && (
                        <>
                            <div className="form-group">
                                <label htmlFor="classFilterDay">Filtrar Clases por Día:</label>
                                <select
                                    id="classFilterDay"
                                    value={classFilterDay}
                                    onChange={(e) => setClassFilterDay(e.target.value)}
                                >
                                    <option value="">Todos los Días</option>
                                    {['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'].map(day => (
                                        <option key={day} value={day}>{day}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group">
                                <label htmlFor="classFilterDate">Filtrar Clases por Fecha:</label>
                                {/* Placeholder for DatePicker. You'll need to install a library like 'react-datepicker' */}
                                <input
                                    type="date" // HTML5 date input as a simple placeholder
                                    id="classFilterDate"
                                    value={classFilterDate ? classFilterDate.toISOString().split('T')[0] : ''}
                                    onChange={(e) => setClassFilterDate(e.target.value ? new Date(e.target.value) : null)}
                                />
                                {/* Example with react-datepicker: */}
                                {/* <DatePicker
                                    selected={classFilterDate}
                                    onChange={(date) => setClassFilterDate(date)}
                                    dateFormat="dd/MM/yyyy"
                                    placeholderText="Selecciona una fecha"
                                    className="custom-datepicker-input"
                                /> */}
                            </div>
                            <div className="selection-list-container">
                                <label>Seleccionar Clase:</label>
                                <ul className="selection-list class-list">
                                    {filteredClasses.length > 0 ? (
                                        filteredClasses.map(cls => (
                                            <li 
                                                key={cls._id} 
                                                className={`list-item ${selectedClassId === cls._id ? 'selected' : ''}`}
                                                onClick={() => setSelectedClassId(cls._id)}
                                            >
                                                <input
                                                    type="radio"
                                                    name="selectedClassRadio"
                                                    value={cls._id}
                                                    checked={selectedClassId === cls._id}
                                                    onChange={() => setSelectedClassId(cls._id)}
                                                    style={{ marginRight: '10px' }}
                                                />
                                                {cls.nombre} ({new Date(cls.fecha).toLocaleDateString()} {cls.horaInicio} - {cls.horaFin}) - {cls.diaDeSemana && cls.diaDeSemana.join(', ')}
                                            </li>
                                        ))
                                    ) : (
                                        <li className="no-results">No se encontraron clases</li>
                                    )}
                                </ul>
                                {targetType === 'class' && !selectedClassId && <p className="selection-hint">Por favor, selecciona una clase de la lista.</p>}
                            </div>
                        </>
                    )}

                    <button type="submit" disabled={sending} className="submit-button">
                        {sending ? 'Enviando...' : 'Enviar Notificaciones'}
                    </button>
                </form>
            )}
        </div>
    );
}

export default NotificationAdminPage;