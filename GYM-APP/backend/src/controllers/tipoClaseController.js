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
        throw new Error('El nombre del tipo de clase es obligatorio.');
    }

    const tipoClaseExists = await TipoClase.findOne({ nombre });

    if (tipoClaseExists) {
        res.status(400);
        throw new Error('Ya existe un tipo de clase con este nombre.');
    }

    const tipoClase = await TipoClase.create({
        nombre,
        descripcion,
    });

    res.status(201).json(tipoClase);
});

// Obtener todos los tipos de clase con paginación, filtrado y búsqueda
const getTiposClase = asyncHandler(async (req, res) => {
    const { TipoClase } = getModels(req.gymDBConnection);

    // --- Paginación ---
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    let query = {};

    // --- Búsqueda por palabra clave (keyword) ---
    const keyword = req.query.keyword;
    if (keyword) {
        query.$or = [
            { nombre: { $regex: keyword, $options: 'i' } },
            { descripcion: { $regex: keyword, $options: 'i' } },
        ];
    }

    // --- Filtrado por campos específicos ---
    const reqQuery = { ...req.query };
    const excludedFields = ['page', 'limit', 'sort', 'fields', 'keyword'];
    excludedFields.forEach(param => delete reqQuery[param]);

    let queryStr = JSON.stringify(reqQuery);
    queryStr = queryStr.replace(/\b(gt|gte|lt|lte)\b/g, match => `$${match}`);

    query = { ...query, ...JSON.parse(queryStr) };

    // --- Ordenamiento (Sorting) ---
    const sortBy = req.query.sort ? req.query.sort.split(',').join(' ') : 'nombre';

    // --- Ejecutar la consulta ---
    const totalTiposClase = await TipoClase.countDocuments(query);
    const tiposClase = await TipoClase.find(query)
                                    .skip(skip)
                                    .limit(limit)
                                    .sort(sortBy);

    res.status(200).json({
        tiposClase,
        currentPage: page,
        totalPages: Math.ceil(totalTiposClase / limit),
        totalItems: totalTiposClase
    });
});

// Obtener un tipo de clase por ID
const getTipoClaseById = asyncHandler(async (req, res) => {
    const { TipoClase } = getModels(req.gymDBConnection);

    const tipoClase = await TipoClase.findById(req.params.id);

    if (tipoClase) {
        res.status(200).json(tipoClase);
    } else {
        res.status(404);
        throw new Error('Tipo de clase no encontrado.');
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
        throw new Error('Tipo de clase no encontrado.');
    }
});

// Eliminar un tipo de clase (solo admin)
const deleteTipoClase = asyncHandler(async (req, res) => {
    const { Clase, TipoClase, User } = getModels(req.gymDBConnection);

    const tipoClaseId = req.params.id;
    const tipoClase = await TipoClase.findById(tipoClaseId);

    if (!tipoClase) {
        res.status(404);
        throw new Error('Tipo de clase no encontrado.');
    }

    // Verificar si el tipo de clase está siendo utilizado por alguna clase
    // Nota: El campo en tu modelo Class es `tipoClase`, no `tipo`.
    const classesUsingType = await Clase.findOne({ tipoClase: tipoClaseId });
    if (classesUsingType) {
        res.status(400);
        throw new Error(`No se puede eliminar el tipo de clase "${tipoClase.nombre}" porque hay clases asociadas a él. Elimina las clases primero.`);
    }

    // Verificar si existen usuarios que tienen créditos de este tipo de clase
    const usersWithCreditsOfType = await User.findOne({
        [`creditosPorTipo.${tipoClaseId}`]: { $exists: true, $ne: 0 }
    });

    if (usersWithCreditsOfType) {
        res.status(400);
        throw new Error(`No se puede eliminar el tipo de clase "${tipoClase.nombre}" porque algunos usuarios todavía tienen créditos de este tipo. Asigna sus créditos a otro tipo o remuévelos.`);
    }

    await tipoClase.deleteOne();
    res.status(200).json({ message: 'Tipo de clase eliminado exitosamente.' });
});

export {
    createTipoClase,
    getTiposClase,
    getTipoClaseById,
    updateTipoClase,
    deleteTipoClase,
};