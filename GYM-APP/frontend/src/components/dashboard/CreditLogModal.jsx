import React, { useState, useEffect } from 'react';
import apiClient from '../../services/api';
import '../../styles/CreditLogModal.css'; // Crearemos este archivo para estilos

function CreditLogModal({ client, onClose }) {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                setLoading(true);
                const { data } = await apiClient.get(`/credit-logs/${client._id}`);
                setLogs(data);
            } catch (error) {
                console.error("Error fetching credit logs:", error);
                // Aquí podrías mostrar una notificación de error
            } finally {
                setLoading(false);
            }
        };

        if (client) {
            fetchLogs();
        }
    }, [client]);

    const getReasonText = (reason) => {
        const reasons = {
            'ajuste_manual_admin': 'Ajuste Manual',
            'inscripcion_clase': 'Inscripción a Clase',
            'reembolso_anulacion': 'Reembolso por Anulación',
            'compra_pack': 'Compra de Pack',
            'renovacion_suscripcion': 'Renovación de Suscripción',
            'reembolso_cancelacion_admin': 'Reembolso por Cancelación Admin',
        };
        return reasons[reason] || reason;
    }

    return (
        <div className="modal-overlay">
            <div className="modal-content credit-log-modal">
                <button onClick={onClose} className="modal-close-btn">&times;</button>
                <h4>Historial de Créditos de {client.nombre} {client.apellido}</h4>
                {loading ? (
                    <p>Cargando historial...</p>
                ) : (
                    <div className="table-responsive">
                        <table className="data-table">
                            <thead>
                                <tr>
                                    <th>Fecha</th>
                                    <th>Cantidad</th>
                                    <th>Tipo de Crédito</th>
                                    <th>Nuevo Saldo</th>
                                    <th>Razón</th>
                                    <th>Detalles</th>
                                    <th>Admin</th>
                                </tr>
                            </thead>
                            <tbody>
                                {logs.length > 0 ? logs.map(log => (
                                    <tr key={log._id}>
                                        <td>{new Date(log.createdAt).toLocaleString()}</td>
                                        <td className={log.amount > 0 ? 'amount-positive' : 'amount-negative'}>
                                            {log.amount > 0 ? `+${log.amount}` : log.amount}
                                        </td>
                                        <td>{log.tipoClase?.nombre || 'N/A'}</td>
                                        <td>{log.newBalance}</td>
                                        <td>{getReasonText(log.reason)}</td>
                                        <td>{log.details || '-'}</td>
                                        <td>{log.admin ? `${log.admin.nombre} ${log.admin.apellido}` : 'Sistema'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="7">No hay registros para mostrar.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}

export default CreditLogModal;

