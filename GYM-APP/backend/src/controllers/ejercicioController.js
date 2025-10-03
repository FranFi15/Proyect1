import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';


const createEjercicio = asyncHandler(async (req, res) => {

    if (!req.user.roles.includes('profesor') && !req.user.puedeGestionarEjercicios) {
        res.status(403); // Forbidden
        throw new Error('No tienes permiso para crear ejercicios.');
    }

    const { nombre, videoUrl, descripcion } = req.body;
    if (!nombre) {
        res.status(400);
        throw new Error('El nombre del ejercicio es obligatorio.');
    }

    const { Ejercicio } = getModels(req.gymDBConnection);
    const ejercicio = await Ejercicio.create({ nombre, videoUrl, descripcion });
    res.status(201).json(ejercicio);
});


const getEjercicios = asyncHandler(async (req, res) => {
    const { Ejercicio } = getModels(req.gymDBConnection);
    const ejercicios = await Ejercicio.find({}).sort({ nombre: 1 });
    res.json(ejercicios);
});

const updateEjercicio = asyncHandler(async (req, res) => {
    
    if (!req.user.roles.includes('profesor') && !req.user.puedeGestionarEjercicios) {
        res.status(403);
        throw new Error('No tienes permiso para modificar ejercicios.');
    }

    const { Ejercicio } = getModels(req.gymDBConnection);
    const ejercicio = await Ejercicio.findById(req.params.id);

    if (ejercicio) {
        ejercicio.nombre = req.body.nombre || ejercicio.nombre;
        ejercicio.videoUrl = req.body.videoUrl !== undefined ? req.body.videoUrl : ejercicio.videoUrl;
        ejercicio.descripcion = req.body.descripcion !== undefined ? req.body.descripcion : ejercicio.descripcion;
        const updatedEjercicio = await ejercicio.save();
        res.json(updatedEjercicio);
    } else {
        res.status(404);
        throw new Error('Ejercicio no encontrado.');
    }
});

const deleteEjercicio = asyncHandler(async (req, res) => {
    if (!req.user.roles.includes('profesor') && !req.user.puedeGestionarEjercicios) {
        res.status(403);
        throw new Error('No tienes permiso para eliminar ejercicios.');
    }

    const { Ejercicio, Plan } = getModels(req.gymDBConnection);
    const ejercicioId = req.params.id;

    const planUsandoEjercicio = await Plan.findOne({ 
        'diasDeEntrenamiento.ejercicios.ejercicio': ejercicioId 
    });

    if (planUsandoEjercicio) {
        res.status(400); // Bad Request
        throw new Error('No se puede eliminar el ejercicio porque está siendo utilizado en al menos un plan.');
    }

    const ejercicio = await Ejercicio.findById(ejercicioId);

    if (ejercicio) {
        await ejercicio.deleteOne();
        res.json({ message: 'Ejercicio eliminado correctamente.' });
    } else {
        res.status(404);
        throw new Error('Ejercicio no encontrado.');
    }
});

export { createEjercicio, getEjercicios, updateEjercicio, deleteEjercicio };