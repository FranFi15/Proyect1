import getUserModel from '../models/User.js';
import getClassModel from '../models/Clase.js';
import getTipoClaseModel from '../models/TipoClase.js';
import getNotificationModel from '../models/Notification.js';
import getConfiguracionModel from '../models/Configuracion.js';
import getCreditLogModel from '../models/CreditLog.js';
import getTransactionsModel from '../models/Transaction.js';
import getTrainingPlanModel from '../models/TrainingPlan.js';
import getTrainingTemplateModel from '../models/TrainingTemplate.js';


/**
 * Initializes and returns all necessary models for a given database connection.
 * This ensures that all models are registered on the connection before any
 * operation, especially ones involving Mongoose's .populate().
 *
 * @param {mongoose.Connection} dbConnection The tenant-specific database connection.
 * @returns {object} An object containing all registered Mongoose models.
 */
const getModels = (dbConnection) => {
    if (!dbConnection) {
        throw new Error('La conexión a la base de datos no está disponible.');
    }
    
    // Al llamar a cada factory, Mongoose registra el modelo en la conexión si no existe,
    // o devuelve el ya existente. Esto prepara la conexión para cualquier consulta.
    const models = {
        User: getUserModel(dbConnection),
        Clase: getClassModel(dbConnection),
        TipoClase: getTipoClaseModel(dbConnection),
        Notification: getNotificationModel(dbConnection),
        Configuracion: getConfiguracionModel(dbConnection),
        CreditLog: getCreditLogModel(dbConnection),
        Transaction: getTransactionsModel(dbConnection),
        TrainingPlan: getTrainingPlanModel(dbConnection),
        TrainingTemplate: getTrainingTemplateModel(dbConnection),
    };

    return models;
};

export default getModels;