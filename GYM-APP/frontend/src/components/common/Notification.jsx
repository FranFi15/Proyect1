// RUTA: frontend/src/components/common/Notification.jsx

import React from 'react';
import '../../styles/Notification.css'; // Importamos su propia hoja de estilos

const Notification = ({ message, type, onClose }) => {
    // Si no hay mensaje, el componente no muestra nada.
    if (!message) {
        return null;
    }

    return (
        <div className={`notification notification-${type}`}>
            <span>{message}</span>
            <button onClick={onClose} className="notification-close">&times;</button>
        </div>
    );
};

export default Notification;