// GYM-APP/backend/src/cron/creditResetJob.js

import cron from 'node-cron';
import getDbConnection from '../config/mongoConnectionManager.js'; 
import getModels from '../utils/getModels.js';
// Importamos el identificador desde nuestro archivo de configuración


/**
 * Resetea los créditos para el gimnasio actual en el que se está ejecutando este backend.
 */
export const resetCreditsForCurrentGym = async () => {
  // Usamos la variable GYM_ID (gymIdentifier) importada desde el archivo de configuración.
  const gymIdentifier = "hola";

  if (!gymIdentifier || gymIdentifier === 'default_gym_id') {
    console.error(`[${new Date().toISOString()}] ERROR CRÍTICO: El GYM_ID (gymIdentifier) no está configurado en 'src/config/gymConfig.js'. No se puede ejecutar el reseteo de créditos.`);
    return;
  }

  try {
    // Usamos el gymIdentifier para obtener el objeto de conexión a la base de datos.
    const dbConnection = await getDbConnection(gymIdentifier);

    // Pasamos la conexión a getModels para obtener el modelo User.
    const { User } = getModels(dbConnection);
    
    // Ejecutamos la operación de reseteo:
    // Para todos los usuarios con rol 'cliente', establece creditosPorTipo a un objeto vacío.
    const result = await User.updateMany(
      { roles: 'cliente' },
      { $set: { creditosPorTipo: {} } }
    );

    console.log(`[${new Date().toISOString()}] Reseteo de créditos para gym '${gymIdentifier}' completado. Usuarios afectados: ${result.modifiedCount}`);
  } catch (error) {
    console.error(`[${new Date().toISOString()}] Error reseteando créditos para gym '${gymIdentifier}':`, error);
  }
};

/**
 * Programa la tarea para que se ejecute a las 23:59 del último día de cada mes.
 */
export const scheduleMonthlyCreditReset = () => {
  // CORRECCIÓN: Se ejecuta todos los días a las 23:59. La lógica interna decide si es fin de mes.
  // Esto evita el uso del carácter no estándar 'L' que causa el error.
  cron.schedule('59 23 * * *', async () => {
    const today = new Date();
    const tomorrow = new Date();
    tomorrow.setDate(today.getDate() + 1);

    // Si el día de mañana es 1, significa que hoy es el último día del mes.
    if (tomorrow.getDate() === 1) {
      console.log(`--- Es fin de mes (${today.toLocaleDateString()}), iniciando reseteo mensual de créditos ---`);
      await resetCreditsForCurrentGym();
      console.log('--- Tarea programada de reseteo mensual de créditos finalizada ---');
    }
  }, {
    timezone: "America/Argentina/Buenos_Aires" // Asegúrate de que la zona horaria sea la correcta para tu negocio.
  });

  console.log('=> Tarea de reseteo mensual de créditos programada exitosamente.');
};