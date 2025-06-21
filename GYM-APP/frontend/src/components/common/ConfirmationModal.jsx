// frontend/src/components/common/ConfirmationModal.jsx
import React from 'react';
import '../../styles/Dashboard.css'; // Sigue usando los estilos generales de modal

const ConfirmationModal = ({ show, message, title = "Confirmar Acción", onConfirm, onCancel }) => {
    if (!show) {
        return null;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h4>{title}</h4>
                <p>{message}</p>
                <div className="modal-actions">
                    <button onClick={onConfirm} className="btn success">Confirmar</button>
                    <button onClick={onCancel} className="btn danger">Cancelar</button>
                </div>
            </div>
        </div>
    );
};

export default ConfirmationModal;