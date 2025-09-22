import asyncHandler from 'express-async-handler';
import Client from '../models/Client.js';

const registerClient = asyncHandler(async (req, res) => {
    const { 
        nombre, 
        emailContacto, 
        urlIdentifier, 
        logoUrl, 
        primaryColor,
        clientLimit,
        basePrice,
        pricePerBlock,
        type
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
        clientLimit: clientLimit || 100,
        basePrice: basePrice || 40000,
        pricePerBlock: pricePerBlock || 15000,
        type: type || 'turno',
    });
    
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

const updateClient = asyncHandler(async (req, res) => {
    const { 
        nombre, 
        emailContacto, 
        estadoSuscripcion, 
        logoUrl, 
        primaryColor,
        clientLimit,
        basePrice,
        pricePerBlock,
        type
    } = req.body;

    const client = await Client.findById(req.params.id);

    if (!client) {
        res.status(404);
        throw new Error('Gimnasio no encontrado.');
    }

    if (nombre !== undefined) client.nombre = nombre;
    if (emailContacto !== undefined) client.emailContacto = emailContacto;
    if (estadoSuscripcion !== undefined) client.estadoSuscripcion = estadoSuscripcion;
    if (logoUrl !== undefined) client.logoUrl = logoUrl;
    if (primaryColor !== undefined) client.primaryColor = primaryColor;
    if (clientLimit !== undefined) client.clientLimit = clientLimit;
    if (basePrice !== undefined) client.basePrice = basePrice;
    if (pricePerBlock !== undefined) client.pricePerBlock = pricePerBlock;
    if (type !== undefined) client.type = type;
    
    const updatedClient = await client.save();
    res.json({ message: 'Gimnasio actualizado exitosamente.', client: updatedClient });
});

const getClientSubscriptionInfo = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId: clientId });
    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }
    res.status(200).json({
        clientLimit: client.clientLimit,
        clientCount: client.clientCount,
    });
});

const updateClientCount = asyncHandler(async (req, res) => {
    const { action } = req.body;
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId: clientId });

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    if (action === 'increment') {
        client.clientCount += 1;
    } else if (action === 'decrement') {
        client.clientCount = Math.max(0, client.clientCount - 1);
    } else {
        res.status(400);
        throw new Error("Acción no válida. Debe ser 'increment' o 'decrement'.");
    }
    await client.save();

    res.status(200).json({
        message: 'Contador de clientes actualizado.',
        newCount: client.clientCount
    });
});

const upgradeClientPlan = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId: clientId });

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    // Aumentamos el límite al siguiente bloque de 50
    client.clientLimit += 50; 
    await client.save();
    
    console.log(`Plan para ${client.nombre} ampliado por el administrador del gym. Nuevo límite: ${client.clientLimit}.`);
    
    res.status(200).json({
        message: '¡Plan ampliado exitosamente!',
        newLimit: client.clientLimit
    });
});

const getClients = asyncHandler(async (req, res) => {
    const clients = await Client.find({});
    res.status(200).json(clients);
});

const getClientById = asyncHandler(async (req, res) => {
    const client = await Client.findById(req.params.id);
    if (!client) {
        res.status(404);
        throw new Error('Gimnasio no encontrado.');
    }
    res.json(client);
});

const deleteClient = asyncHandler(async (req, res) => {
    const client = await Client.findByIdAndDelete(req.params.id);
    if (!client) {
        res.status(404);
        throw new Error('Gimnasio no encontrado.');
    }
    res.json({ message: 'Gimnasio eliminado exitosamente.' });
});

const updateClientStatus = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const { estado } = req.body;
    if (!estado || !['activo', 'inactivo', 'periodo_prueba', 'vencido', 'cancelado'].includes(estado)) {
        res.status(400);
        throw new Error('Estado de suscripción inválido.');
    }
    const client = await Client.findOneAndUpdate(
        { clientId: clientId },
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
    const { clientId } = req.params;
    const apiSecretKey = req.headers['x-api-secret'];
    if (!apiSecretKey) {
        res.status(401);
        throw new Error('Acceso no autorizado. Se requiere una API secret key.');
    }
    const client = await Client.findOne({ clientId: clientId });
    if (!client || client.apiSecretKey !== apiSecretKey) {
        res.status(401);
        throw new Error('Cliente o API secret key inválida.');
    }
    res.status(200).json({
        clientId: client.clientId,
        connectionStringDB: client.connectionStringDB,
        estadoSuscripcion: client.estadoSuscripcion
    });
});

const getClientInternalDbInfo = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId: clientId });
    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }
    res.status(200).json({
        _id: client._id, 
        clientId: client.clientId, 
        connectionStringDB: client.connectionStringDB,
        estadoSuscripcion: client.estadoSuscripcion,
        apiSecretKey: client.apiSecretKey // La clave secreta para autenticar otras llamadas
    });
});

const getMyClientStatus = asyncHandler(async (req, res) => {
    // req.user is attached by the 'protect' middleware
    if (!req.user) {
        res.status(401);
        throw new Error('No autorizado, usuario no encontrado con ese token.');
    }

    const client = await Client.findById(req.user._id);
    
    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado en la base de datos.');
    }
    
    res.json({
        mpConnected: client.mpConnected || false,
    });
});

export {
    registerClient,
    getClientSubscriptionInfo,
    updateClientCount,
    upgradeClientPlan,
    updateClient,
    getClients,
    deleteClient,
    getClientById,
    updateClientStatus,
    getClientDbInfo,
    getClientInternalDbInfo,
    getMyClientStatus,
};