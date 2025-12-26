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
        const internalApiKey = process.env.INTERNAL_ADMIN_API_KEY;

        if (!adminApiUrl || !internalApiKey) {
            throw new Error('Variables de entorno del Admin Panel no configuradas.');
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
        throw error; // Relanzamos el error para que el runner principal lo maneje
    }
};

const generateMonthlyReportAndCleanup = async (dbConnection, clientId) => {
    const { Clase, User } = getModels(dbConnection);

    const now = new Date();
    const previousMonth = subMonths(now, 1);
    const startDate = startOfMonth(previousMonth);
    const endDate = endOfMonth(previousMonth);

    try {
        const classesToArchive = await Clase.find({
            fecha: { $gte: startDate, $lte: endDate },
        }).populate('profesor profesores tipoClase usuariosInscritos');

        // Si no hay clases para archivar, no hacemos nada.
        if (classesToArchive.length === 0) {
            console.log(`[${clientId}] No hay clases del mes anterior para generar reporte.`);
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'GymApp Admin';
        workbook.created = new Date();
        
        const detailSheet = workbook.addWorksheet(`Reporte Clases ${format(previousMonth, 'MMMM-yyyy', { locale: es })}`);

        detailSheet.columns = [
            { header: 'Fecha', key: 'fecha', width: 15 },
            { header: 'Nombre del Turno', key: 'nombre', width: 30 },
            { header: 'Tipo de Clase', key: 'tipo', width: 25 },
            { header: 'Horario', key: 'horario', width: 15 },
            { header: 'Profesores', key: 'profesor', width: 40 },
            { header: 'Inscriptos', key: 'inscriptos', width: 10 },
            { header: 'Capacidad', key: 'capacidad', width: 10 },
            { header: 'Cliente Nombre', key: 'clienteNombre', width: 30 },
            { header: 'Cliente Email', key: 'clienteEmail', width: 35 },
            { header: 'Cliente DNI', key: 'clienteDNI', width: 15 },
        ];
        
        detailSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
        detailSheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF2F4F4F' } };

        for (const clase of classesToArchive) {

            let nombresProfesores = 'No asignado';

            if (clase.profesores && clase.profesores.length > 0) {
                nombresProfesores = clase.profesores
                    .filter(p => p) 
                    .map(p => `${p.nombre} ${p.apellido}`)
                    .join(', ');
            } else if (clase.profesor) {
                nombresProfesores = `${clase.profesor.nombre} ${clase.profesor.apellido}`;
            }

            const baseRowData = {
                fecha: format(new Date(clase.fecha), 'dd/MM/yyyy'),
                nombre: clase.nombre,
                tipo: clase.tipoClase?.nombre || 'N/A',
                horario: `${clase.horaInicio} - ${clase.horaFin}`,
                profesor: nombresProfesores,
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
            console.log(`[MonthlyReport - ${clientId}] Se eliminaron ${classIdsToDelete.length} clases antiguas.`);
        }

    } catch (error) {
        console.error(`[${clientId}] Error durante la tarea de reporte y limpieza mensual:`, error);
    }
};

const masterCronJob = async () => {
    console.log('[MonthlyReport] Iniciando job de reporte y limpieza mensual...');
    try {
        const allClients = await getAllActiveClients(); 

        if (!allClients || allClients.length === 0) {
            console.log('[MonthlyReport] No hay clientes activos para procesar.');
            return;
        }
        
        for (const client of allClients) {
            if (!client.clientId) continue;

            try {
                const { connection } = await connectToGymDB(client.clientId);            
                console.log(`[MonthlyReport - ${client.clientId}] Procesando reporte...`);
                await generateMonthlyReportAndCleanup(connection, client.clientId);

            } catch (error) {
                console.error(`[MonthlyReport] Error procesando el gimnasio ${client.clientId}:`, error.message);
            }
        }
    } catch (error) {
        console.error('[MonthlyReport] Error fatal en la tarea principal:', error.message);
    }
    console.log('[MonthlyReport] Job de reporte y limpieza finalizado.');
};

const scheduleMonthlyCleanup = () => {
    cron.schedule('0 1 1 * *', masterCronJob, {
        scheduled: true,
        timezone: "America/Argentina/Buenos_Aires"
    });
    console.log('🕒 Cron Job de reporte y limpieza mensual programado.');
};

export { scheduleMonthlyCleanup, generateMonthlyReportAndCleanup, masterCronJob, getAllActiveClients };
