import cron from 'node-cron';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, format, differenceInYears } from 'date-fns';
import { es } from 'date-fns/locale'; 
import { sendEmailWithAttachment } from '../services/emailService.js';
import connectToGymDB from '../config/mongoConnectionManager.js';
import getModels from '../utils/getModels.js';


const getAllActiveClients = async () => {
    try {
        const adminApiUrl = process.env.ADMIN_PANEL_API_URL;
        if (!adminApiUrl) {
            throw new Error('La URL del ADMIN_PANEL_API_URL no está configurada en el .env');
        }
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;
        if (!internalApiKey) {
            throw new Error('La clave INTERNAL_ADMIN_API_KEY no está configurada en el .env');
        }

        const response = await axios.get(`${adminApiUrl}/api/clients/internal/all-clients`, {
             headers: { 'x-internal-api-key': internalApiKey }
        });

        if (!response.data || !Array.isArray(response.data)) {
            throw new Error('La respuesta del panel de administración no es un array de clientes válido.');
        }

        return response.data.filter(client => client.estadoSuscripcion === 'activo' || client.estadoSuscripcion === 'periodo_prueba');
    } catch (error) {
        console.error("Error crítico al obtener la lista de clientes activos:", error.response?.data || error.message);
        throw new Error('No se pudo obtener la lista de clientes del panel de administración.');
    }
};


const generateMonthlyReportAndCleanup = async (gymDB, clientId) => {
    const { Clase, User } = getModels(gymDB);

    const now = new Date();
    const previousMonth = subMonths(now, 1);
    const startDate = startOfMonth(previousMonth);
    const endDate = endOfMonth(previousMonth);

    try {
        const classesToArchive = await Clase.find({
            fecha: { $gte: startDate, $lte: endDate },
        }).populate('profesor tipoClase usuariosInscritos');

        // Si no hay clases para archivar, no hacemos nada.
        if (classesToArchive.length === 0) {
            console.log(`[${clientId}] No hay clases del mes anterior para generar reporte.`);
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'GymApp Admin';
        workbook.created = new Date();
        
        // ---> Se vuelve a crear una única hoja con el detalle
        const detailSheet = workbook.addWorksheet(`Reporte Clases ${format(previousMonth, 'MMMM-yyyy', { locale: es })}`);

        detailSheet.columns = [
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
        
        detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } };

        for (const clase of classesToArchive) {
            const baseRowData = {
                fecha: format(new Date(clase.fecha), 'dd/MM/yyyy'),
                nombre: clase.nombre,
                tipo: clase.tipoClase?.nombre || 'N/A',
                horario: `${clase.horaInicio} - ${clase.horaFin}`,
                profesor: clase.profesor ? `${clase.profesor.nombre} ${clase.profesor.apellido}` : 'No asignado',
                inscriptos: clase.usuariosInscritos.length,
                capacidad: clase.capacidad,
            };

            if (clase.usuariosInscritos && clase.usuariosInscritos.length > 0) {
                clase.usuariosInscritos.forEach(user => {
                    detailSheet.addRow({
                        ...baseRowData,
                        clienteNombre: user ? `${user.nombre} ${user.apellido}` : 'Usuario eliminado',
                        clienteEmail: user ? user.email : 'N/A',
                        clienteDNI: user ? user.dni : 'N/A',
                    });
                });
            } else {
                 detailSheet.addRow({
                    ...baseRowData,
                    clienteNombre: 'Sin inscriptos',
                });
            }
        }

        const buffer = await workbook.xlsx.writeBuffer();

        const adminUser = await User.findOne({ roles: 'admin' });
        if (!adminUser) {
            console.error(`[${clientId}] No se encontró un usuario admin para enviar el reporte.`);
            return;
        }

        const monthNameInSpanish = format(previousMonth, 'MMMM yyyy', { locale: es });

        await sendEmailWithAttachment({
            to: adminUser.email,
            subject: `Reporte Mensual de Clases - ${monthNameInSpanish}`,
            html: `<p>Adjunto se encuentra el reporte de todas las clases y sus asistentes para el mes de <strong>${monthNameInSpanish}</strong>. Estas clases serán eliminadas de la base de datos.</p>`,
            attachments: [{
                filename: `reporte-clases-${format(previousMonth, 'yyyy-MM')}.xlsx`,
                content: buffer,
            }]
        });

        const classIdsToDelete = classesToArchive.map(c => c._id);
        if (classIdsToDelete.length > 0) {
            await Clase.deleteMany({ _id: { $in: classIdsToDelete } });
        }

    } catch (error) {
        console.error(`[${clientId}] Error durante la tarea de reporte y limpieza mensual:`, error);
    }
};

const masterCronJob = async () => {
    
    // --- AJUSTE PARA PRUEBAS ---
    // Para probar con un solo cliente, usa esta línea y asegúrate de que DEFAULT_CLIENT_ID esté en tu .env
    const allClients = [{ clientId: process.env.DEFAULT_CLIENT_ID }]; 
    
    // --- CÓDIGO DE PRODUCCIÓN ---
    // Cuando estés listo para producción, comenta la línea de arriba y descomenta la siguiente.
    // const allClients = await getAllActiveClients(); 

    if (!allClients || allClients.length === 0) {
        return;
    }
    
    for (const client of allClients) {
        if (!client.clientId) {
            continue;
        }
        try {
            const gymDB = await connectToGymDB(client.clientId);
            await generateMonthlyReportAndCleanup(gymDB, client.clientId);
        } catch (error) {
            console.error(`Error procesando el gimnasio ${client.clientId}:`, error);
        }
    }
};

/**
 * Programa la tarea para que se ejecute a la 1 AM del primer día de cada mes.
 */
const scheduleMonthlyCleanup = () => {
    cron.schedule('0 1 1 * *', masterCronJob, {
        scheduled: true,
        timezone: "America/Argentina/Buenos_Aires"
    });
};

export { scheduleMonthlyCleanup, generateMonthlyReportAndCleanup, masterCronJob };
