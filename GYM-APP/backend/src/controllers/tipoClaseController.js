// src/controllers/tipoClaseController.js
import getModels from '../utils/getModels.js';        // <-- Importa la FUNCIÓN
import asyncHandler from 'express-async-handler';

// --- MODIFICACIÓN CLAVE: Todas las funciones del controlador necesitan obtener los modelos dinámicamente ---

// Crear un nuevo tipo de clase (solo admin)
const createTipoClase = asyncHandler(async (req, res) => {
    const { TipoClase } = getModels(req.gymDBConnection);

    const { nombre, descripcion } = req.body;

    if (!nombre) {
        res.status(400);
        throw new Error('El nombre del tipo de turno es obligatorio.');
    }

    const tipoClaseExists = await TipoClase.findOne({ nombre });

    if (tipoClaseExists) {
        res.status(400);
        throw new Error('Ya existe un tipo de turno con este nombre.');
    }

    const tipoClase = await TipoClase.create({
        nombre,
        descripcion,
    });

    res.status(201).json(tipoClase);
});

// Obtener todos los tipos de clase con paginación, filtrado y búsqueda
const getTiposClase = asyncHandler(async (req, res) => {
    const { TipoClase, User } = getModels(req.gymDBConnection);
    const tiposClase = await TipoClase.find({}).lean(); // .lean() para objetos JS planos y más rápidos

    // 1. Calcular el total de créditos asignados para cada tipo de clase
    const assignedCreditsAggregation = await User.aggregate([
        { $project: { creditosArray: { $objectToArray: "$creditosPorTipo" } } },
        { $unwind: "$creditosArray" },
        { $group: { _id: "$creditosArray.k", totalAsignado: { $sum: "$creditosArray.v" } } }
    ]);

    // 2. Crear un mapa para una búsqueda eficiente
    const assignedCreditsMap = new Map(
        assignedCreditsAggregation.map(item => [item._id.toString(), item.totalAsignado])
    );

    // 3. Añadir el campo calculado `creditosDisponibles` a cada tipo de clase
    const tiposClaseConDisponibles = tiposClase.map(tipo => {
        const totalAsignado = assignedCreditsMap.get(tipo._id.toString()) || 0;
        const creditosDisponibles = tipo.creditosTotales - totalAsignado;
        return {
            ...tipo,
            creditosDisponibles: creditosDisponibles >= 0 ? creditosDisponibles : 0 // Asegura que no sea negativo
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

    const { nombre, descripcion } = req.body;

    const tipoClase = await TipoClase.findById(req.params.id);

    if (tipoClase) {
        tipoClase.nombre = nombre !== undefined ? nombre : tipoClase.nombre;
        tipoClase.descripcion = descripcion !== undefined ? descripcion : tipoClase.descripcion;

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

    // Verificar si el tipo de clase está siendo utilizado por alguna clase
    // Nota: El campo en tu modelo Class es `tipoClase`, no `tipo`.
    const classesUsingType = await Clase.findOne({ tipoClase: tipoClaseId });
    if (classesUsingType) {
        res.status(400);
        throw new Error(`No se puede eliminar el tipo de turno "${tipoClase.nombre}" porque hay turnos asociados a él. Elimina los turno primero.`);
    }

    // Verificar si existen usuarios que tienen créditos de este tipo de clase
    const usersWithCreditsOfType = await User.findOne({
        [`creditosPorTipo.${tipoClaseId}`]: { $exists: true, $ne: 0 }
    });

    if (usersWithCreditsOfType) {
        res.status(400);
        throw new Error(`No se puede eliminar el tipo de turno "${tipoClase.nombre}" porque algunos usuarios todavía tienen créditos de este tipo. Asigna sus créditos a otro tipo o remuévelos.`);
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