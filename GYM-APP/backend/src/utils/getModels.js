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
import getScoreboardModel from '../models/Scoreboard.js';





const getModels = (dbConnection) => {
    if (!dbConnection) {
        throw new Error('La conexión a la base de datos no está disponible.');
    }

    const { Scoreboard, ScoreboardEntry } = getScoreboardModel(dbConnection);
    
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
        Scoreboard,
        ScoreboardEntry

        
    };

    return models;
};

export default getModels;