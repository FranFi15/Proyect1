// src/controllers/sucursalController.js
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

// Helper: Asegura que exista al menos 'Sucursal 1' y asigna los turnos sin sucursal
export const ensureDefaultSucursal = async (gymDBConnection) => {
    const { Sucursal, Clase } = getModels(gymDBConnection);
    const count = await Sucursal.countDocuments();
    if (count === 0) {
        console.log("📍 Creando automáticamente 'Sucursal 1' y migrando turnos sin sucursal...");
        const sucursal1 = await Sucursal.create({
            nombre: 'Sucursal 1',
            direccion: '',
            activa: true
        });
        await Clase.updateMany(
            { $or: [{ sucursal: null }, { sucursal: { $exists: false } }] },
            { $set: { sucursal: sucursal1._id } }
        );
        return sucursal1;
    }
    return null;
};

// @desc Obtener todas las sucursales
// @route GET /api/sucursales
// @access Private
export const getSucursales = asyncHandler(async (req, res) => {
    await ensureDefaultSucursal(req.gymDBConnection);
    const { Sucursal } = getModels(req.gymDBConnection);
    const sucursales = await Sucursal.find({ activa: true }).sort({ createdAt: 1 });
    res.status(200).json(sucursales);
});

// @desc Crear una nueva sucursal
// @route POST /api/sucursales
// @access Private (Admin)
export const createSucursal = asyncHandler(async (req, res) => {
    const { Sucursal } = getModels(req.gymDBConnection);
    const { nombre, direccion } = req.body;

    if (!nombre || !nombre.trim()) {
        res.status(400);
        throw new Error('El nombre de la sucursal es obligatorio.');
    }

    const nuevaSucursal = await Sucursal.create({
        nombre: nombre.trim(),
        direccion: direccion ? direccion.trim() : '',
        activa: true
    });

    res.status(201).json(nuevaSucursal);
});

// @desc Actualizar una sucursal
// @route PUT /api/sucursales/:id
// @access Private (Admin)
export const updateSucursal = asyncHandler(async (req, res) => {
    const { Sucursal } = getModels(req.gymDBConnection);
    const { nombre, direccion, activa } = req.body;

    const sucursal = await Sucursal.findById(req.params.id);
    if (!sucursal) {
        res.status(404);
        throw new Error('Sucursal no encontrada.');
    }

    if (nombre !== undefined) sucursal.nombre = nombre.trim();
    if (direccion !== undefined) sucursal.direccion = direccion.trim();
    if (activa !== undefined) sucursal.activa = activa;

    const sucursalActualizada = await sucursal.save();
    res.status(200).json(sucursalActualizada);
});

// @desc Eliminar una sucursal
// @route DELETE /api/sucursales/:id
// @access Private (Admin)
export const deleteSucursal = asyncHandler(async (req, res) => {
    const { Sucursal, Clase } = getModels(req.gymDBConnection);
    const sucursal = await Sucursal.findById(req.params.id);

    if (!sucursal) {
        res.status(404);
        throw new Error('Sucursal no encontrada.');
    }

    // Verificar si quedan otras sucursales
    const totalSucursales = await Sucursal.countDocuments({ activa: true });
    if (totalSucursales <= 1) {
        res.status(400);
        throw new Error('No puedes eliminar la única sucursal del gimnasio. Si deseas cambiar el nombre o dirección, utiliza la opción de editar.');
    }

    // Al eliminar la sucursal, liberamos o transferimos los turnos (opcional: ponerlos sin sucursal o a la primera sucursal disponible)
    const otraSucursal = await Sucursal.findOne({ _id: { $ne: sucursal._id }, activa: true });
    if (otraSucursal) {
        await Clase.updateMany({ sucursal: sucursal._id }, { $set: { sucursal: otraSucursal._id } });
    } else {
        await Clase.updateMany({ sucursal: sucursal._id }, { $unset: { sucursal: 1 } });
    }

    await sucursal.deleteOne();
    res.status(200).json({ message: 'Sucursal eliminada y turnos reasignados.' });
});
