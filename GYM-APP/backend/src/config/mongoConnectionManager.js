// src/config/mongoConnectionManager.js
import mongoose from 'mongoose';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config();

const gymConnections = {};

const connectToGymDB = async (clientId, apiSecretKey) => {
    // Reutilizar conexión si ya existe y está activa
    if (gymConnections[clientId] && gymConnections[clientId].readyState === 1) {
       
        return gymConnections[clientId];
    }

    try {
        const adminPanelBaseUrl = process.env.ADMIN_PANEL_API_URL;
        
        const fullApiUrl = `${adminPanelBaseUrl}/api/clients/${clientId}/db-info`;
       

        const response = await fetch(fullApiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-Api-Secret': apiSecretKey
            }
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.message || `Error al obtener info de DB para ${clientId}: ${response.status}`);
        }

        if (data.estadoSuscripcion !== 'activo' && data.estadoSuscripcion !== 'periodo_prueba') {
            throw new Error(`Suscripción inactiva para el gimnasio ${clientId}. Estado: ${data.estadoSuscripcion}`);
        }

        const connectionString = data.connectionStringDB;

        
        const gymDBConnection = await mongoose.createConnection(connectionString, {
            // useNewUrlParser y useUnifiedTopology son opciones obsoletas en Mongoose 6+
            // serverSelectionTimeoutMS es para el tiempo de espera de la topología
            serverSelectionTimeoutMS: 5000, 
            // socketTimeoutMS es para el tiempo de espera de las operaciones de socket
            socketTimeoutMS: 45000, 
            // Asegúrate de que los parámetros w y retryWrites no se dupliquen aquí
            // si ya están en la connectionString.
        });

        // Asegurarse de que la conexión esté realmente en estado 'conectado' (readyState: 1)
        // Mongoose.createConnection() ya espera que la conexión esté lista, pero
        // si hay una condición de carrera muy estrecha, este await asegura el estado 1.
        if (gymDBConnection.readyState === 2) { // Si la conexión está en estado 'connecting'
           
            await new Promise((resolve, reject) => {
                gymDBConnection.once('connected', () => {
                    resolve();
                });
                gymDBConnection.once('error', (err) => {
                    reject(err);
                });
                // Añadir un timeout adicional para esta promesa, para evitar esperas infinitas
                setTimeout(() => {
                    if (gymDBConnection.readyState !== 1) {
                        const timeoutErr = new Error(`Conexión a ${clientId} tardó demasiado en establecerse (timeout de espera explícito).`);
                        console.error(`[GYM-APP Backend] ${timeoutErr.message}`);
                        reject(timeoutErr);
                    }
                }, 7000); // Dar un poco más de tiempo que serverSelectionTimeoutMS si es necesario
            });
        }
        
        // Después de este punto, readyState debería ser 1.
        
        gymConnections[clientId] = gymDBConnection;
        return gymDBConnection;

    } catch (error) {
        // Si hay un error, eliminar la conexión de la caché si existe
        if (gymConnections[clientId]) {
            delete gymConnections[clientId];
        }
        throw error; // Relanzar el error para que el middleware o controlador lo capture
    }
};

export default connectToGymDB;
