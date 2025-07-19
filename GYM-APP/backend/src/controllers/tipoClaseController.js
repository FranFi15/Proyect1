import getModels from '../utils/getModels.js';
import asyncHandler from 'express-async-handler';

// Crear un nuevo tipo de clase (solo admin)
const createTipoClase = asyncHandler(async (req, res) => {
    const { TipoClase } = getModels(req.gymDBConnection);

    // --- CORRECCIÓN: Se añade 'price' a la desestructuración ---
    const { nombre, descripcion, price } = req.body;

    if (!nombre) {
        res.status(400);
        throw new Error('El nombre del tipo de turno es obligatorio.');
    }

    const tipoClaseExists = await TipoClase.findOne({ nombre });

    if (tipoClaseExists) {
        res.status(400);
        throw new Error('Ya existe un tipo de turno con este nombre.');
    }

    // --- CORRECCIÓN: Se añade 'price' al objeto de creación ---
    const tipoClase = await TipoClase.create({
        nombre,
        descripcion,
        price,
    });

    res.status(201).json(tipoClase);
});

// Obtener todos los tipos de clase
const getTiposClase = asyncHandler(async (req, res) => {
    const { TipoClase, User } = getModels(req.gymDBConnection);
    const tiposClase = await TipoClase.find({}).lean();

    const assignedCreditsAggregation = await User.aggregate([
        { $project: { creditosArray: { $objectToArray: "$creditosPorTipo" } } },
        { $unwind: "$creditosArray" },
        { $group: { _id: "$creditosArray.k", totalAsignado: { $sum: "$creditosArray.v" } } }
    ]);

    const assignedCreditsMap = new Map(
        assignedCreditsAggregation.map(item => [item._id.toString(), item.totalAsignado])
    );

    const tiposClaseConDisponibles = tiposClase.map(tipo => {
        const totalAsignado = assignedCreditsMap.get(tipo._id.toString()) || 0;
        const creditosDisponibles = tipo.creditosTotales - totalAsignado;
        return {
            ...tipo,
            creditosDisponibles: creditosDisponibles >= 0 ? creditosDisponibles : 0
        };
    });

    res.json({ tiposClase: tiposClaseConDisponibles });
});

// Obtener un tipo de clase por ID
const getTipoClaseById = asyncHandler(async (req, res) => {
    const { TipoClase } = getModels(req.gymDBConnection);
    const tipoClase = await TipoClase.findById(req.params.id);

    if (tipoClase) {
        res.status(200).json(tipoClase);
    } else {
        res.status(404);
        throw new Error('Tipo de turno no encontrado.');
    }
});

// Actualizar un tipo de clase (solo admin)
const updateTipoClase = asyncHandler(async (req, res) => {
    const { TipoClase } = getModels(req.gymDBConnection);

    // --- CORRECCIÓN: Se añade 'price' a la desestructuración ---
    const { nombre, descripcion, price } = req.body;

    const tipoClase = await TipoClase.findById(req.params.id);

    if (tipoClase) {
        tipoClase.nombre = nombre !== undefined ? nombre : tipoClase.nombre;
        tipoClase.descripcion = descripcion !== undefined ? descripcion : tipoClase.descripcion;
        // --- CORRECCIÓN: Se añade la lógica para actualizar el precio ---
        // Usamos '??' para permitir que el precio se actualice a 0 si es necesario.
        tipoClase.price = price ?? tipoClase.price;

        const updatedTipoClase = await tipoClase.save();
        res.status(200).json(updatedTipoClase);
    } else {
        res.status(404);
        throw new Error('Tipo de turno no encontrado.');
    }
});

// Eliminar un tipo de clase (solo admin)
const deleteTipoClase = asyncHandler(async (req, res) => {
    const { Clase, TipoClase, User } = getModels(req.gymDBConnection);
    const tipoClaseId = req.params.id;
    const tipoClase = await TipoClase.findById(tipoClaseId);

    if (!tipoClase) {
        res.status(404);
        throw new Error('Tipo de turno no encontrado.');
    }

    const classesUsingType = await Clase.findOne({ tipoClase: tipoClaseId });
    if (classesUsingType) {
        res.status(400);
        throw new Error(`No se puede eliminar el tipo de turno "${tipoClase.nombre}" porque hay turnos asociados a él.`);
    }

    const usersWithCreditsOfType = await User.findOne({
        [`creditosPorTipo.${tipoClaseId}`]: { $exists: true, $ne: 0 }
    });

    if (usersWithCreditsOfType) {
        res.status(400);
        throw new Error(`No se puede eliminar el tipo de turno "${tipoClase.nombre}" porque algunos usuarios todavía tienen créditos de este tipo.`);
    }

    await tipoClase.deleteOne();
    res.status(200).json({ message: 'Tipo de turno eliminado exitosamente.' });
});

export {
    createTipoClase,
    getTiposClase,
    getTipoClaseById,
    updateTipoClase,
    deleteTipoClase,
};
