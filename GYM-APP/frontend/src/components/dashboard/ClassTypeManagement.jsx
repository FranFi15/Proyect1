import React, { useEffect, useState } from 'react';
import axios from 'axios';
import authService from '../../services/authService';
import Notification from '../common/Notification';
import ConfirmationModal from '../common/ConfirmationModal';

// URL base de tu backend de la app del gimnasio
const GYM_APP_API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api'; 

function ClassTypeManagement() {
    // --- ESTADOS DEL COMPONENTE ---
    const [classTypes, setClassTypes] = useState([]);
    const [showForm, setShowForm] = useState(false);
    const [editingClassType, setEditingClassType] = useState(null);
    const [formData, setFormData] = useState({ nombre: '', descripcion: '' });
    
    // --- ESTADOS PARA NOTIFICACIONES Y CONFIRMACIONES ---
    const [notification, setNotification] = useState({ show: false, message: '', type: '' });
    const [confirmation, setConfirmation] = useState({ show: false, message: '', onConfirm: null });

    // --- LÓGICA DE NOTIFICACIONES Y CONFIRMACIÓN ---
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
        fetchClassTypes();
    }, []);

    const fetchClassTypes = async () => {
        try {
            const response = await axios.get(`${GYM_APP_API_BASE_URL}/tipos-clase`, { headers: authService.getAuthHeaders() });
            if (response.data && Array.isArray(response.data.tiposClase)) {
                setClassTypes(response.data.tiposClase);
            } else {
                setClassTypes([]);
            }
        } catch (error) {
            showNotification('Error al obtener los tipos de clase.', 'error');
            setClassTypes([]);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleFormSubmit = async (e) => {
        e.preventDefault();
        if (editingClassType) {
            // Lógica de Actualización
            try {
                await axios.put(`${GYM_APP_API_BASE_URL}/tipos-clase/${editingClassType._id}`, formData, { headers: authService.getAuthHeaders() });
                showNotification('Tipo de clase actualizado exitosamente.', 'success');
                resetForm();
                fetchClassTypes();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al actualizar.', 'error');
            }
        } else {
            // Lógica de Creación
            try {
                await axios.post(`${GYM_APP_API_BASE_URL}/tipos-clase`, formData, { headers: authService.getAuthHeaders() });
                showNotification('Tipo de clase añadido exitosamente.', 'success');
                resetForm();
                fetchClassTypes();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al añadir.', 'error');
            }
        }
    };
    
    const handleEdit = (type) => {
        setEditingClassType(type);
        setFormData({ nombre: type.nombre, descripcion: type.descripcion || '' });
        setShowForm(true);
    };

    const resetForm = () => {
        setShowForm(false);
        setEditingClassType(null);
        setFormData({ nombre: '', descripcion: '' });
    };

    const handleDelete = (typeId) => {
        askConfirmation('¿Estás seguro? Eliminar esto podría afectar a clases existentes.', async () => {
            try {
                await axios.delete(`${GYM_APP_API_BASE_URL}/tipos-clase/${typeId}`, { headers: authService.getAuthHeaders() });
                showNotification('Tipo de clase eliminado.', 'success');
                fetchClassTypes();
            } catch (error) {
                showNotification(error.response?.data?.message || 'Error al eliminar.', 'error');
            }
        });
    };

    return (
        <div className="dashboard-section">
            <Notification message={notification.message} type={notification.type} onClose={() => setNotification({ show: false })} />
            <ConfirmationModal show={confirmation.show} message={confirmation.message} onConfirm={handleConfirm} onCancel={closeConfirmation} />
            <button onClick={() => { setShowForm(!showForm); setEditingClassType(null); setFormData({ nombre: '', descripcion: '' }); }} className="btn primary">
                {showForm ? 'Cancelar' : 'Añadir Tipo de Clase'}
            </button>

            {showForm && (
                <form onSubmit={handleFormSubmit} className="form-card">
                    <h4>{editingClassType ? 'Editar Tipo de Clase' : 'Añadir Nuevo Tipo de Clase'}</h4>
                    <input type="text" name="nombre" placeholder="Nombre del Tipo de Clase" value={formData.nombre} onChange={handleChange} required />
                    <textarea name="descripcion" placeholder="Descripción (opcional)" value={formData.descripcion} onChange={handleChange}></textarea>
                    <button type="submit" className="btn success">{editingClassType ? 'Actualizar' : 'Añadir'}</button>
                </form>
            )}

            <div className="table-responsive">
                <table className="data-table">
                    <thead>
                        <tr>
                            <th>Nombre</th>
                            <th>Descripción</th>
                            <th>Acciones</th>
                        </tr>
                    </thead>
                    <tbody>
                        {classTypes.length === 0 ? (
                            <tr><td colSpan="3">No hay tipos de clase registrados.</td></tr>
                        ) : (
                            classTypes.map(type => (
                                <tr key={type._id}>
                                    <td>{type.nombre}</td>
                                    <td>{type.descripcion}</td>
                                    <td>
                                        <button onClick={() => handleEdit(type)} className="btn btn-sm primary">Editar</button>
                                        <button onClick={() => handleDelete(type._id)} className="btn btn-sm danger">Eliminar</button>
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

export default ClassTypeManagement;