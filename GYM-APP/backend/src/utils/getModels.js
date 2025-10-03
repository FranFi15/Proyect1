import getUserModel from '../models/User.js';
import getClassModel from '../models/Clase.js';
import getTipoClaseModel from '../models/TipoClase.js';
import getNotificationModel from '../models/Notification.js';
import getConfiguracionModel from '../models/Configuracion.js';
import getCreditLogModel from '../models/CreditLog.js';
import getTransactionsModel from '../models/Transaction.js';
import getTrainingPlanModel from '../models/TrainingPlan.js';
import getTrainingTemplateModel from '../models/TrainingTemplate.js';
import getSettingsModel from '../models/Settings.js';
import getEjercicioModel from '../models/Ejercicio.js';
import getPlanModel from '../models/Plan.js';
import getFeedbackEjercicioModel from '../models/FeedbackEjercicio.js';



const getModels = (dbConnection) => {
    if (!dbConnection) {
        throw new Error('La conexión a la base de datos no está disponible.');
    }
    
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
        Settings: getSettingsModel(dbConnection),
        Ejercicio: getEjercicioModel(dbConnection),
        Plan: getPlanModel(dbConnection),
        FeedbackEjercicio: getFeedbackEjercicioModel(dbConnection),
    };

    return models;
};

export default getModels;