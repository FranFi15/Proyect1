import cron from 'node-cron';
import ExcelJS from 'exceljs';
import axios from 'axios';
import { startOfMonth, endOfMonth, subMonths, format } from 'date-fns';
import { es } from 'date-fns/locale'; 
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
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

        // ---> 2. Obtenemos TODOS los usuarios para las estadísticas de edad y género
        const allUsers = await User.find({});

        // Modificamos la condición para que no se detenga si solo hay usuarios pero no clases
        if (classesToArchive.length === 0 && allUsers.length === 0) {
            console.log(`[${clientId}] No hay clases ni usuarios para generar reporte.`);
            return;
        }

        const workbook = new ExcelJS.Workbook();
        workbook.creator = 'GymApp Admin';
        workbook.created = new Date();

        // ---> 3. Creamos la PRIMERA HOJA para el Dashboard con los gráficos
        const dashboardSheet = workbook.addWorksheet('Dashboard');
        dashboardSheet.addRow(['Reporte Mensual General - ' + format(previousMonth, 'MMMM yyyy', { locale: es })]).font = { size: 16, bold: true };
        dashboardSheet.mergeCells('A1:L1');
        dashboardSheet.getRow(1).alignment = { horizontal: 'center' };
        dashboardSheet.addRow([]); // Fila vacía para espaciar

        // ---> 4. Bloque completo para CALCULAR TODAS LAS ESTADÍSTICAS
        // 4.1. Género
        const genderStats = allUsers.reduce((acc, user) => {
            acc[user.sexo || 'No especificado'] = (acc[user.sexo || 'No especificado'] || 0) + 1;
            return acc;
        }, {});

        // 4.2. Edad
        const ageStats = allUsers.reduce((acc, user) => {
            if (user.fechaNacimiento) {
                const age = differenceInYears(now, new Date(user.fechaNacimiento));
                if (age < 20) acc['< 20']++; else if (age <= 29) acc['20-29']++;
                else if (age <= 39) acc['30-39']++; else if (age <= 49) acc['40-49']++;
                else acc['50+']++;
            }
            return acc;
        }, { '< 20': 0, '20-29': 0, '30-39': 0, '40-49': 0, '50+': 0 });

        // 4.3. Clases por Profesor
        const teacherStats = classesToArchive.reduce((acc, c) => {
            const teacherName = c.profesor ? `${c.profesor.nombre} ${c.profesor.apellido}` : 'No asignado';
            acc[teacherName] = (acc[teacherName] || 0) + 1;
            return acc;
        }, {});

        // 4.4. Clases por Tipo
        const classTypeStats = classesToArchive.reduce((acc, c) => {
            const typeName = c.tipoClase?.nombre || 'Sin Tipo';
            acc[typeName] = (acc[typeName] || 0) + 1;
            return acc;
        }, {});
        
        // 4.5. Ocupación por Tipo de Clase
        const occupancyByType = classesToArchive.reduce((acc, c) => {
            const typeName = c.tipoClase?.nombre || 'Sin Tipo';
            if (!acc[typeName]) {
                acc[typeName] = { attendees: 0, capacity: 0 };
            }
            acc[typeName].attendees += c.usuariosInscritos.length;
            acc[typeName].capacity += c.capacidad;
            return acc;
        }, {});

        const occupancyPercentages = Object.entries(occupancyByType).map(([name, data]) => ({
            name,
            percentage: data.capacity > 0 ? (data.attendees / data.capacity) * 100 : 0
        }));

        // ---> 5. Bloque completo para GENERAR LAS IMÁGENES de los gráficos
        const chartJSNodeCanvas = new ChartJSNodeCanvas({ width: 600, height: 400, backgroundColour: '#ffffff' });
        const generateChart = async (config) => {
            const buffer = await chartJSNodeCanvas.renderToBuffer(config);
            return workbook.addImage({ buffer, extension: 'png' });
        };

        const genderChartId = await generateChart({ type: 'pie', data: { labels: Object.keys(genderStats), datasets: [{ data: Object.values(genderStats), backgroundColor: ['#36A2EB', '#FF6384', '#FFCE56'] }] }, options: { plugins: { title: { display: true, text: 'Distribución por Género' } } } });
        const ageChartId = await generateChart({ type: 'bar', data: { labels: Object.keys(ageStats), datasets: [{ label: 'Cantidad de Usuarios', data: Object.values(ageStats), backgroundColor: '#4BC0C0' }] }, options: { plugins: { title: { display: true, text: 'Distribución por Edad' } } } });
        const teacherChartId = await generateChart({ type: 'bar', data: { labels: Object.keys(teacherStats), datasets: [{ label: 'Clases Dictadas', data: Object.values(teacherStats), backgroundColor: '#FF9F40' }] }, options: { plugins: { title: { display: true, text: 'Clases por Profesor' } } } });
        const classTypeChartId = await generateChart({ type: 'bar', data: { labels: Object.keys(classTypeStats), datasets: [{ label: 'Cantidad de Clases', data: Object.values(classTypeStats), backgroundColor: '#9966FF' }] }, options: { plugins: { title: { display: true, text: 'Cantidad de Clases por Tipo' } } } });
        const occupancyChartId = await generateChart({ type: 'bar', data: { labels: occupancyPercentages.map(i => i.name), datasets: [{ label: '% Ocupación', data: occupancyPercentages.map(i => i.percentage), backgroundColor: '#C9CBCF' }] }, options: { plugins: { title: { display: true, text: 'Ocupación por Tipo de Clase' } }, scales: { y: { ticks: { callback: (value) => value + '%' } } } } });

        // ---> 6. Bloque para POSICIONAR los gráficos en la hoja 'Dashboard'
        dashboardSheet.addImage(genderChartId, 'A3:F18');
        dashboardSheet.addImage(ageChartId, 'G3:L18');
        dashboardSheet.addImage(teacherChartId, 'A20:F35');
        dashboardSheet.addImage(classTypeChartId, 'G20:L35');
        dashboardSheet.addImage(occupancyChartId, 'A37:F52');

        // ---> 7. Creamos la SEGUNDA HOJA para el detalle, usando tu código original
        const detailSheet = workbook.addWorksheet(`Detalle Clases ${format(previousMonth, 'MMMM-yyyy', { locale: es })}`);

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

        // ---> 8. El resto de tu código para generar el buffer y enviar el email se mantiene igual
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
