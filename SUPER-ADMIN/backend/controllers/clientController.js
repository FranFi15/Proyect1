import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';

// --- FUNCIÓN MEJORADA ---
// Ahora acepta los nuevos campos de precios y límites al registrar
const registerClient = asyncHandler(async (req, res) => {
    const { 
        nombre, 
        emailContacto, 
        urlIdentifier, 
        logoUrl, 
        primaryColor,
        // Nuevos campos que pueden venir del formulario del superadmin
        clientLimit,
        basePrice,
        pricePerBlock
    } = req.body;

    if (!nombre || !emailContacto || !urlIdentifier) {
        res.status(400);
        throw new Error('Por favor, introduce todos los campos requeridos.');
    }

    const client = new Client({
        nombre,
        emailContacto,
        urlIdentifier,
        logoUrl,
        primaryColor,
        // Asignamos los nuevos valores o dejamos los que vienen por defecto en el schema
        clientLimit: clientLimit || 100,
        basePrice: basePrice || 40000,
        pricePerBlock: pricePerBlock || 15000,
    });
    
    // Tu lógica para la connectionStringDB se mantiene igual
    const mongoHost = process.env.MONGO_DB_HOST;
    if (!mongoHost) {
        res.status(500);
        throw new Error('La configuración del host de la base de datos no está definida en el servidor.');
    }
    const uniqueDbSuffix = client.clientId.substring(0, 8);
    const tenantDbName = `${urlIdentifier.replace(/-/g, '_')}_${uniqueDbSuffix}`;
    client.connectionStringDB = `${mongoHost}/${tenantDbName}?retryWrites=true&w=majority`;

    const createdClient = await client.save();
    res.status(201).json(createdClient);
});

// --- FUNCIÓN MEJORADA ---
// Ahora permite actualizar los campos de precios y límites
const updateClient = asyncHandler(async (req, res) => {
    const { 
        nombre, 
        emailContacto, 
        estadoSuscripcion, 
        logoUrl, 
        primaryColor,
        // Nuevos campos
        clientLimit,
        basePrice,
        pricePerBlock
    } = req.body;

    const client = await Client.findById(req.params.id);

    if (!client) {
        res.status(404);
        throw new Error('Gimnasio no encontrado.');
    }

    // Actualiza todos los campos si vienen en la petición
    if (nombre !== undefined) client.nombre = nombre;
    if (emailContacto !== undefined) client.emailContacto = emailContacto;
    if (estadoSuscripcion !== undefined) client.estadoSuscripcion = estadoSuscripcion;
    if (logoUrl !== undefined) client.logoUrl = logoUrl;
    if (primaryColor !== undefined) client.primaryColor = primaryColor;
    if (clientLimit !== undefined) client.clientLimit = clientLimit;
    if (basePrice !== undefined) client.basePrice = basePrice;
    if (pricePerBlock !== undefined) client.pricePerBlock = pricePerBlock;

    const updatedClient = await client.save();
    res.json({ message: 'Gimnasio actualizado exitosamente.', client: updatedClient });
});

// --- NUEVA FUNCIÓN ---
// Endpoint seguro para que el GYM-APP consulte su límite y conteo actual de clientes
const getClientSubscriptionInfo = asyncHandler(async (req, res) => {
    // Esta función asume que tu middleware 'protectInternal' ya ha verificado
    // el clientId y la apiSecretKey y ha adjuntado el 'client' al request.
    // Si no es así, necesitaríamos buscar el cliente aquí.
    const client = await Client.findById(req.params.id);

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }
    
    res.status(200).json({
        clientLimit: client.clientLimit,
        clientCount: client.clientCount,
    });
});

// --- NUEVA FUNCIÓN ---
// Endpoint seguro para que el GYM-APP actualice su contador de clientes
const updateClientCount = asyncHandler(async (req, res) => {
    const { action } = req.body; // 'action' puede ser 'increment' o 'decrement'
    const client = await Client.findById(req.params.id);

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    if (action === 'increment') {
        client.clientCount += 1;
    } else if (action === 'decrement') {
        client.clientCount -= 1;
    } else {
        res.status(400);
        throw new Error("Acción no válida. Debe ser 'increment' o 'decrement'.");
    }

    await client.save();
    
    // Lógica para auto-incrementar el límite si se supera
    if (client.clientCount > client.clientLimit) {
        // Aumentamos el límite al siguiente bloque de 100
        client.clientLimit += 100; 
        await client.save();
        console.log(`Límite para ${client.nombre} aumentado a ${client.clientLimit}. Se requiere ajuste de facturación.`);
        // Aquí podrías enviar un email de notificación al superadmin
    }

    res.status(200).json({
        message: 'Contador de clientes actualizado.',
        newCount: client.clientCount,
        newLimit: client.clientLimit
    });
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
     const client = await Client.findOne({ clientId: clientId });

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
    getClientSubscriptionInfo,
    updateClientCount,
    updateClient,
    getClients,
    deleteClient,
    getClientInternalDbInfo,
    getInternalDbInfo,
};
