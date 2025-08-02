// admin-panel-backend/controllers/clientController.js
import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { randomBytes, randomUUID } from 'crypto';
dotenv.config();



const registerClient = asyncHandler(async (req, res) => {
    // Añadimos primaryColor
    const { nombre, emailContacto, urlIdentifier, logoUrl, primaryColor } = req.body;

    if (!nombre || !emailContacto || !urlIdentifier) {
        res.status(400);
        throw new Error('Por favor, introduce todos los campos requeridos.');
    }

    const client = new Client({
        nombre,
        emailContacto,
        urlIdentifier,
        logoUrl,
        primaryColor, // Guardamos el color
    });
    
    // ... (resto de la lógica para la connectionStringDB)
    const mongoHost = process.env.MONGO_DB_HOST;
    if (!mongoHost) {
        res.status(500);
        throw new Error('La configuración del host de la base de datos no está definida en el servidor.');
    }
    const uniqueDbSuffix = client.clientId.substring(0, 8);
    const tenantDbName = `${urlIdentifier.replace(/-/g, '_')}_${uniqueDbSuffix}`;
    client.connectionStringDB = `${mongoHost}/${tenantDbName}?retryWrites=true&w=majority`;


    try {
        const createdClient = await client.save();
        res.status(201).json(createdClient);
    } catch (error) {
        // ... (manejo de errores)
    }
});

const getClientById = asyncHandler(async (req, res) => {
    try {
        const client = await Client.findById(req.params.id);
        if (!client) {
            res.status(404);
            throw new Error('Gimnasio no encontrado.');
        }
        res.json(client);
    } catch (error) {
        console.error('Error al obtener gimnasio por ID:', error);
        if (error.name === 'CastError') {
            res.status(400);
            throw new Error('ID de gimnasio inválido.');
        }
        res.status(500);
        throw new Error('Error interno del servidor al obtener gimnasio.');
    }
});

const updateClient = asyncHandler(async (req, res) => {
    // Añadimos primaryColor
    const { nombre, emailContacto, estadoSuscripcion, logoUrl, primaryColor } = req.body;

    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            res.status(404);
            throw new Error('Gimnasio no encontrado.');
        }

        if (nombre !== undefined) client.nombre = nombre;
        if (emailContacto !== undefined) client.emailContacto = emailContacto;
        if (estadoSuscripcion !== undefined) client.estadoSuscripcion = estadoSuscripcion;
        if (logoUrl !== undefined) client.logoUrl = logoUrl;
        if (primaryColor !== undefined) client.primaryColor = primaryColor; // Actualizamos el color

        await client.save();
        res.json({ message: 'Gimnasio actualizado exitosamente.', client });
    } catch (error) {
        // ... (manejo de errores)
    }
});


const updateClientStatus = asyncHandler(async (req, res) => {
    const { clientId } = req.params; // Este 'clientId' contiene el _id de MongoDB.
    const { estado } = req.body;

    if (!estado || !['activo', 'inactivo', 'periodo_prueba', 'vencido', 'cancelado'].includes(estado)) {
        res.status(400);
        throw new Error('Estado de suscripción inválido.');
    }

    // CORRECCIÓN: Se busca por _id en lugar de por clientId.
    const client = await Client.findByIdAndUpdate(
        clientId,
        { estadoSuscripcion: estado },
        { new: true, runValidators: true }
    );

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    res.status(200).json({
        message: `Estado de suscripción actualizado a '${estado}' para ${client.nombre}.`,
        client: {
            clientId: client.clientId,
            nombre: client.nombre,
            estadoSuscripcion: client.estadoSuscripcion
        }
    });
});

const getClientDbInfo = asyncHandler(async (req, res) => {
    const { clientId } = req.params; // Este 'clientId' contiene el _id de MongoDB.
    const apiSecretKey = req.headers['x-api-secret'];

    if (!apiSecretKey) {
        res.status(401);
        throw new Error('Acceso no autorizado. Se requiere una API secret key.');
    }

    // CORRECCIÓN: Se busca por _id y luego se compara la clave secreta.
    const client = await Client.findById(clientId);

    if (!client || client.apiSecretKey !== apiSecretKey) {
        res.status(404);
        throw new Error('Cliente o API secret key inválida.');
    }

    res.status(200).json({
        clientId: client.clientId,
        connectionStringDB: client.connectionStringDB,
        estadoSuscripcion: client.estadoSuscripcion
    });
});


const getAllInternalClients = asyncHandler(async (req, res) => {

    try {
        const clients = await Client.find({}); // Obtiene todos los clientes
        const safeClients = clients.map(client => ({
            _id: client._id,
            nombre: client.nombre,
            emailContacto: client.emailContacto,
            clientId: client.clientId,
            apiSecretKey: client.apiSecretKey, // Incluye para que el cron job pueda usarlas
            estadoSuscripcion: client.estadoSuscripcion,
            fechaInicioSuscripcion: client.fechaInicioSuscripcion,
            fechaVencimientoSuscripcion: client.fechaVencimientoSuscripcion,
            createdAt: client.createdAt
        }));
        res.status(200).json(safeClients); // Envía los clientes como JSON
    } catch (error) {
        console.error('[Admin Panel - Internal Clients] Error al obtener clientes internos:', error);
        res.status(500);
        throw new Error('Error interno del servidor al obtener clientes internos.');
    }
});



const getClients = asyncHandler(async (req, res) => {
    try {
        const clients = await Client.find({});
        const safeClients = clients.map(client => ({
            _id: client._id,
            nombre: client.nombre,
            emailContacto: client.emailContacto,
            clientId: client.clientId,
            estadoSuscripcion: client.estadoSuscripcion,
            fechaInicioSuscripcion: client.fechaInicioSuscripcion,
            fechaVencimientoSuscripcion: client.fechaVencimientoSuscripcion,
            createdAt: client.createdAt
        }));
        res.status(200).json(safeClients);
    } catch (error) {
        console.error('Error al obtener clientes:', error);
        res.status(500);
        throw new Error('Error interno del servidor al obtener clientes.');
    }
});


const deleteClient = asyncHandler(async (req, res) => {
    try {
        const client = await Client.findByIdAndDelete(req.params.id);

        if (!client) {
            res.status(404);
            throw new Error('Gimnasio no encontrado.');
        }

        res.json({ message: 'Gimnasio eliminado exitosamente.' });
    } catch (error) {
        console.error('Error al eliminar gimnasio:', error);
        if (error.name === 'CastError') {
            res.status(400);
            throw new Error('ID de gimnasio inválido.');
        }
        res.status(500);
        throw new Error('Error interno del servidor al eliminar gimnasio.');
    }
});

const getClientInternalDbInfo = asyncHandler(async (req, res) => {
    const { clientId } = req.params; // Este 'clientId' contiene el _id de MongoDB.
    
    // CORRECCIÓN: Se usa findById para buscar por el _id de MongoDB.
    const client = await Client.findById(clientId);

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    res.status(200).json({
        clientId: client.clientId, // Devolvemos el clientId real (UUID)
        connectionStringDB: client.connectionStringDB,
        estadoSuscripcion: client.estadoSuscripcion
    });
});

const getInternalDbInfo = asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);

    if (client) {
        const connectionString = client.connectionStringDB;
        if (!connectionString) {
            res.status(500);
            throw new Error(`El cliente con ID ${req.params.id} fue encontrado, pero no tiene una cadena de conexión (connectionStringDB) configurada.`);
        }
        res.json({
            dbConnectionString: connectionString
        });
    } else {
        res.status(404);
        throw new Error('Cliente no encontrado');
    }
});



export {
    registerClient,
    getClientById,
    updateClient,
    updateClientStatus,
    getClientDbInfo,
    getClients,
    deleteClient,
    getAllInternalClients, 
    getClientInternalDbInfo,
    getInternalDbInfo,
};
