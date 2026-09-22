import asyncHandler from 'express-async-handler';
import mongoose from 'mongoose';
import Client from '../models/Client.js';

const countActiveClientsInTenantDb = async (connectionStringDB) => {
    if (!connectionStringDB) return null;
    let conn;
    try {
        conn = await mongoose.createConnection(connectionStringDB, {
            serverSelectionTimeoutMS: 5000,
            maxPoolSize: 1,
        }).asPromise();

        // Match gym User model collection without pulling the full schema.
        const User =
            conn.models.User ||
            conn.model(
                'User',
                new mongoose.Schema(
                    {
                        roles: [String],
                        isActive: Boolean,
                    },
                    { collection: 'users', strict: false }
                )
            );

        return await User.countDocuments({
            roles: 'cliente',
            isActive: { $ne: false },
        });
    } catch (error) {
        console.error('Error contando clientes activos del tenant:', error.message);
        return null;
    } finally {
        if (conn) {
            try {
                await conn.close();
            } catch {
                // ignore close errors
            }
        }
    }
};

const registerClient = asyncHandler(async (req, res) => {
    const { 
        nombre, 
        emailContacto, 
        urlIdentifier, 
        logoUrl, 
        primaryColor,
        clientLimit,
        pais,
        timezone
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
        type: 'turno',
        pais: pais || 'Argentina',
        timezone: timezone || 'America/Argentina/Buenos_Aires',
    });
    
    const mongoHost = process.env.MONGO_DB_HOST;
    if (!mongoHost) {
        res.status(500);
        throw new Error('La configuración del host de la base de datos no está definida en el servidor.');
    }

    // Generamos el string de conexión único
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
        pais,
        timezone
    } = req.body;

    const client = await Client.findById(req.params.id);

    if (!client) {
        res.status(404);
        throw new Error('Gimnasio no encontrado.');
    }

    // campos relevantes
    if (nombre !== undefined) client.nombre = nombre;
    if (emailContacto !== undefined) client.emailContacto = emailContacto;
    if (estadoSuscripcion !== undefined) client.estadoSuscripcion = estadoSuscripcion;
    if (logoUrl !== undefined) client.logoUrl = logoUrl;
    if (primaryColor !== undefined) client.primaryColor = primaryColor;
    if (clientLimit !== undefined) client.clientLimit = clientLimit;
    if (pais !== undefined) client.pais = pais;
    if (timezone !== undefined) client.timezone = timezone;
    

    
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
    const { action, count } = req.body;
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId: clientId });

    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    // Absolute sync from gym DB (preferred — avoids drift from +/- counters).
    if (typeof count === 'number' && Number.isFinite(count) && count >= 0) {
        client.clientCount = Math.floor(count);
    } else if (action === 'increment') {
        client.clientCount += 1;
    } else if (action === 'decrement') {
        client.clientCount = Math.max(0, client.clientCount - 1);
    } else {
        res.status(400);
        throw new Error("Acción no válida. Debe ser 'increment', 'decrement' o enviar 'count'.");
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

    
    client.clientLimit += 100; 
    await client.save();
    
    console.log(`Plan para ${client.nombre} ampliado por el administrador del gym. Nuevo límite: ${client.clientLimit}.`);
    
    res.status(200).json({
        message: '¡Plan ampliado exitosamente!',
        newLimit: client.clientLimit
    });
});

const getClients = asyncHandler(async (req, res) => {
    const clients = await Client.find({});
    const shouldSync =
        req.query?.syncCounts === '1' ||
        req.query?.syncCounts === 'true';

    // Cron and internal callers skip live recount (can be slow across many tenants).
    if (!shouldSync) {
        res.status(200).json(clients);
        return;
    }

    // Super Admin UI: refresh stored counts from each gym DB.
    const withLiveCounts = await Promise.all(
        clients.map(async (client) => {
            const plain = client.toObject();
            const liveCount = await countActiveClientsInTenantDb(client.connectionStringDB);
            if (typeof liveCount === 'number') {
                if (liveCount !== client.clientCount) {
                    client.clientCount = liveCount;
                    try {
                        await client.save();
                    } catch (err) {
                        console.error(`No se pudo guardar clientCount para ${client.clientId}:`, err.message);
                    }
                }
                plain.clientCount = liveCount;
            }
            return plain;
        })
    );

    res.status(200).json(withLiveCounts);
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
        estadoSuscripcion: client.estadoSuscripcion,
        pais: client.pais || 'Argentina',
        timezone: client.timezone || 'America/Argentina/Buenos_Aires'
    });
});

const getClientInternalDbInfo = asyncHandler(async (req, res) => {
    const { clientId } = req.params;
    const client = await Client.findOne({ clientId: clientId });
    if (!client) {
        res.status(404);
        throw new Error('Cliente no encontrado.');
    }

    const estadosBloqueantes = ['inactivo', 'vencido', 'cancelado'];
    
    if (estadosBloqueantes.includes(client.estadoSuscripcion)) {
        res.status(403); 
        throw new Error(`El servicio se encuentra ${client.estadoSuscripcion}. Contacte a soporte.`);
    }

    res.status(200).json({
        _id: client._id, 
        clientId: client.clientId, 
        connectionStringDB: client.connectionStringDB,
        estadoSuscripcion: client.estadoSuscripcion,
        apiSecretKey: client.apiSecretKey,
        pais: client.pais || 'Argentina',
        timezone: client.timezone || 'America/Argentina/Buenos_Aires'
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
};