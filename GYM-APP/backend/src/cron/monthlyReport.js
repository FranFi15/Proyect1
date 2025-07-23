import cron from 'node-cron';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { sendEmailWithAttachment } from '../services/emailService.js';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';

/**
 * Obtiene la lista de todos los IDs de clientes activos desde tu panel de administración.
 */
const getAllActiveClientIds = async () => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        if (!adminApiUrl) {
            throw new Error('La URL del ADMIN_PANEL_API_URL no está configurada en el .env');
        }
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;
        if (!internalApiKey) {
            throw new Error('La clave INTERNAL_ADMIN_API_KEY no está configurada en el .env');
        }

        const response = await axios.get(`${adminApiUrl}/api/clients/internal-active-ids`, {
            headers: { 'internal-admin-api-key': internalApiKey }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('La respuesta del admin panel no es un array de clientes válido.');
        }

        return response.data;
    } catch (error) {
        console.error("Error crítico al obtener la lista de clientes activos:", error.response?.data || error.message);
        return [];
    }
};


/**
 * Genera un reporte de Excel y elimina las clases del mes anterior para un gimnasio específico.
 */
const generateMonthlyReportAndCleanup = async (gymDB, clientId) => {
    console.log(`[${clientId}] Iniciando tarea mensual de reporte y limpieza de clases...`);

    // USAR getModels para obtener los modelos
    const { Clase, User } = getModels(gymDB); // Asegúrate de usar 'Clase' si ese es el nombre del modelo en getModels

    const now = new Date();
    const previousMonth = subMonths(now, 1);
    const startDate = startOfMonth(previousMonth);
    const endDate = endOfMonth(previousMonth);

    try {
        const classesToArchive = await Clase.find({ // Usar 'Clase' aquí
            fecha: { $gte: startDate, $lte: endDate },
        }).populate('profesor tipoClase usuariosInscritos');

        if (classesToArchive.length === 0) {
            console.log(`[${clientId}] No hay clases para archivar del mes anterior. Tarea finalizada.`);
            return;
        }

        console.log(`[${clientId}] Se encontraron ${classesToArchive.length} clases para archivar.`);

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'GymApp Admin';
        workbook.created = new Date();
        const sheet = workbook.addWorksheet(`Reporte Clases ${format(previousMonth, 'MMMM-yyyy')}`);

        sheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'Nombre del Turno', key: 'nombre', width: 30 },
            { header: 'Tipo de Clase', key: 'tipo', width: 25 },
            { header: 'Horario', key: 'horario', width: 15 },
            { header: 'Profesor', key: 'profesor', width: 30 },
            { header: 'Inscriptos', key: 'inscriptos', width: 10 },
            { header: 'Capacidad', key: 'capacidad', width: 10 },
            { header: 'Cliente Nombre', key: 'clienteNombre', width: 30 },
            { header: 'Cliente Email', key: 'clienteEmail', width: 35 },
            { header: 'Cliente DNI', key: 'clienteDNI', width: 15 },
        ];
        
        sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } };

        for (const clase of classesToArchive) {
            if (clase.usuariosInscritos && clase.usuariosInscritos.length > 0) {
                clase.usuariosInscritos.forEach(user => {
                    sheet.addRow({
                        fecha: format(new Date(clase.fecha), 'dd/MM/yyyy'),
                        nombre: clase.nombre,
                        tipo: clase.tipoClase?.nombre || 'N/A',
                        horario: `${clase.horaInicio} - ${clase.horaFin}`,
                        profesor: clase.profesor ? `${clase.profesor.nombre} ${clase.profesor.apellido}` : 'No asignado',
                        inscriptos: clase.usuariosInscritos.length,
                        capacidad: clase.capacidad,
                        clienteNombre: user ? `${user.nombre} ${user.apellido}` : 'Usuario eliminado',
                        clienteEmail: user ? user.email : 'N/A',
                        clienteDNI: user ? user.dni : 'N/A',
                    });
                });
            } else {
                 sheet.addRow({
                    fecha: format(new Date(clase.fecha), 'dd/MM/yyyy'),
                    nombre: clase.nombre,
                    tipo: clase.tipoClase?.nombre || 'N/A',
                    horario: `${clase.horaInicio} - ${clase.horaFin}`,
                    profesor: clase.profesor ? `${clase.profesor.nombre} ${clase.profesor.apellido}` : 'No asignado',
                    inscriptos: 0,
                    capacidad: clase.capacidad,
                    clienteNombre: 'Sin inscriptos',
                });
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();
        console.log(`[${clientId}] Reporte de Excel generado.`);

        const adminUser = await User.findOne({ roles: 'admin' });
        if (!adminUser) {
            console.error(`[${clientId}] No se encontró un usuario admin para enviar el reporte.`);
            return;
        }

        await sendEmailWithAttachment({
            to: adminUser.email,
            subject: `Reporte Mensual de Clases - ${format(previousMonth, 'MMMM yyyy')}`,
            html: `<p>Adjunto se encuentra el reporte de todas las clases y sus asistentes para el mes de <strong>${format(previousMonth, 'MMMM yyyy')}</strong>. Estas clases serán eliminadas de la base de datos.</p>`,
            attachments: [{
                filename: `reporte-clases-${format(previousMonth, 'yyyy-MM')}.xlsx`,
                content: buffer,
            }]
        });

        console.log(`[${clientId}] Correo con el reporte enviado exitosamente a ${adminUser.email}.`);

        const classIdsToDelete = classesToArchive.map(c => c._id);
        await Clase.deleteMany({ _id: { $in: classIdsToDelete } }); // Usar 'Clase' aquí

        console.log(`[${clientId}] ${classIdsToDelete.length} clases antiguas han sido eliminadas.`);
        console.log(`[${clientId}] Tarea mensual de reporte y limpieza completada.`);

    } catch (error) {
        console.error(`[${clientId}] Error durante la tarea de reporte y limpieza mensual:`, error);
    }
};

const masterCronJob = async () => {
    const allClients = await getAllActiveClientIds(); 

    console.log(`Iniciando CRON maestro para ${allClients.length} gimnasio(s).`);
    
    for (const client of allClients) {
        try {
            const gymDB = await connectToGymDB(client.clientId);
            await generateMonthlyReportAndCleanup(gymDB, client.clientId);
        } catch (error) {
            console.error(`Error procesando el gimnasio ${client.clientId}:`, error);
        }
    }
};

const scheduleMonthlyCleanup = () => {
    cron.schedule('0 1 1 * *', masterCronJob, {
        scheduled: true,
        timezone: "America/Argentina/Buenos_Aires"
    });
    console.log('Tarea de limpieza y reporte mensual programada para ejecutarse el 1ro de cada mes a la 1 AM.');
};

export { scheduleMonthlyCleanup, generateMonthlyReportAndCleanup };
