// admin-panel-backend/controllers/clientController.js
import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';
import { v4 as uuidv4 } from 'uuid';
import dotenv from 'dotenv';
import { randomBytes, randomUUID } from 'crypto';
dotenv.config();



// @desc    Registrar un nuevo cliente (gimnasio)
// @route   POST /api/clients/
// @access  Private (solo para administradores del panel)
const registerClient = asyncHandler(async (req, res) => {
    const { nombre, emailContacto, urlIdentifier } = req.body;

    if (!nombre || !emailContacto || !urlIdentifier) {
        res.status(400);
        throw new Error('Por favor, introduce todos los campos requeridos.');
    }

    const client = new Client({
        nombre,
        emailContacto,
        urlIdentifier,
    });
    
    // Obtenemos el host del clúster desde las variables de entorno
    const mongoHost = process.env.MONGO_DB_HOST;
    if (!mongoHost) {
        res.status(500);
        throw new Error('La configuración del host de la base de datos no está definida en el servidor.');
    }

    // Generamos un nombre de base de datos único
    const uniqueDbSuffix = client.clientId.substring(0, 8);
    const tenantDbName = `gym_${urlIdentifier.replace(/-/g, '_')}_${uniqueDbSuffix}`;

    // Construimos la cadena de conexión para el nuevo gimnasio
    client.connectionStringDB = `${mongoHost}/${tenantDbName}?retryWrites=true&w=majority`;

    try {
        const createdClient = await client.save();
        res.status(201).json(createdClient);
    } catch (error) {
        res.status(400);
        if (error.code === 11000) {
            throw new Error('El email o el identificador de URL ya existen.');
        }
        throw error;
    }
});
// @desc    Obtener un cliente específico por su ID de MongoDB
// @route   GET /api/clients/:id
// @access  Private (solo para administradores de tu panel)
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

// @desc    Actualizar los datos de un cliente (nombre, emailContacto, estadoSuscripcion, etc.)
// @route   PUT /api/clients/:id
// @access  Private (solo para administradores de tu panel)
const updateClient = asyncHandler(async (req, res) => {
    const { nombre, emailContacto, estadoSuscripcion } = req.body;

    try {
        const client = await Client.findById(req.params.id);

        if (!client) {
            res.status(404);
            throw new Error('Gimnasio no encontrado.');
        }

        if (nombre !== undefined) client.nombre = nombre;
        if (emailContacto !== undefined) client.emailContacto = emailContacto;
        if (estadoSuscripcion !== undefined) client.estadoSuscripcion = estadoSuscripcion;

        await client.save();
        res.json({ message: 'Gimnasio actualizado exitosamente.', client });
    } catch (error) {
        console.error('Error al actualizar gimnasio:', error);
        if (error.name === 'CastError') {
            res.status(400);
            throw new Error('ID de gimnasio inválido.');
        }
        if (error.code === 11000) {
            res.status(400);
            throw new new Error('El email de contacto ya está registrado para otro gimnasio.');
        }
        res.status(500);
        throw new Error('Error interno del servidor al actualizar gimnasio.');
    }
});

// @desc    Actualizar SOLO el estado de suscripción de un cliente
// @route   PUT /api/clients/:clientId/status
// @access  Private (solo para administradores de tu panel)
const updateClientStatus = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { estado } = req.body;

    if (!estado || !['activo', 'inactivo', 'periodo_prueba', 'vencido', 'cancelado'].includes(estado)) {
        res.status(400);
        throw new Error('Estado de suscripción inválido.');
    }

    try {
        const client = await Client.findOneAndUpdate(
            { clientId },
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
    } catch (error) {
        console.error('Error al actualizar estado de suscripción:', error);
        res.status(500);
        throw new Error('Error interno del servidor al actualizar estado.');
    }
});

// @desc    Obtener connectionStringDB y estado de suscripción de un cliente (para la App de Gym)
// @route   GET /api/clients/:clientId/db-info
// @access  Private (solo para el backend de la App de Gym, autenticado con apiSecretKey)
const getClientDbInfo = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const apiSecretKey = req.headers['x-api-secret'];

    if (!apiSecretKey) {
        console.warn('[Admin Panel] Acceso no autorizado: X-Api-Secret missing.');
        res.status(401);
        throw new Error('Acceso no autorizado. Se requiere una API secret key.');
    }

    try {
        const client = await Client.findOne({ clientId, apiSecretKey });

        if (!client) {
            console.warn(`[Admin Panel] Cliente no encontrado o API secret key inválida para clientId: ${clientId}`);
            const clientExists = await Client.findOne({ clientId });
            if (clientExists) {
                console.warn(`[Admin Panel] Cliente con clientId ${clientId} existe, pero API secret key no coincide.`);
            } else {
                console.warn(`[Admin Panel] Cliente con clientId ${clientId} NO existe.`);
            }
            res.status(404);
            throw new Error('Cliente o API secret key inválida.');
        }

        console.log(`[Admin Panel] Cliente encontrado: ${client.nombre}, Estado: ${client.estadoSuscripcion}`);

        res.status(200).json({
            clientId: client.clientId,
            connectionStringDB: client.connectionStringDB,
            estadoSuscripcion: client.estadoSuscripcion
        });
    } catch (error) {
        console.error('Error al obtener info de DB del cliente:', error);
        res.status(500);
        throw new Error('Error interno del servidor al obtener info de DB.');
    }
});

// @desc    Obtener todos los clientes (gimnasios) para uso interno del sistema (cron jobs, etc.)
// @route   GET /api/clients/internal/all-clients
// @access  Internal (protegida por x-internal-api-key)
const getAllInternalClients = asyncHandler(async (req, res) => {
    const internalApiKey = req.headers['x-internal-api-key'];
    if (internalApiKey !== process.env.INTERNAL_ADMIN_API_KEY) {
        console.warn('[Admin Panel - Internal Clients] Acceso no autorizado: Clave API interna no coincide.');
        res.status(403);
        throw new Error('Clave API interna no autorizada.');
    }

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


// @desc    Obtener todos los clientes (gimnasios) para el dashboard de administración
// @route   GET /api/clients
// @access  Private (solo para administradores de tu panel)
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

// @desc    Eliminar un cliente específico por su ID de MongoDB
// @route   DELETE /api/clients/:id
// @access  Private (solo para administradores de tu panel)
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
    const { clientId } = req.params;
    const internalApiKey = req.headers['x-internal-api-key'];

    // Verifica que la clave interna recibida coincida con la guardada en el entorno de SUPER-ADMIN
    if (internalApiKey !== process.env.INTERNAL_ADMIN_API_KEY) {
        res.status(401);
        throw new Error('Acceso no autorizado. Clave interna inválida.');
    }

    const client = await Client.findOne({ clientId });

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    res.status(200).json({
        clientId: client.clientId,
        connectionStringDB: client.connectionStringDB,
        estadoSuscripcion: client.estadoSuscripcion
    });
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
};
