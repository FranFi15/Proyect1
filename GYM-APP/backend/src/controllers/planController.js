import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { sendSingleNotification } from './notificationController.js';


const createPlan = asyncHandler(async (req, res) => {
    const { titulo, asignadoA, diasDeEntrenamiento } = req.body;

    if (!titulo || !asignadoA || !diasDeEntrenamiento) {
        res.status(400);
        throw new Error('Faltan datos para crear el plan.');
    }

    const { Plan, User, Notification } = getModels(req.gymDBConnection);

    const plan = await Plan.create({
        titulo,
        asignadoA,
        diasDeEntrenamiento,
        creadoPor: req.user._id, 
        isVisibleToUser: true,
    });

    if (plan) {
        const title = "¡Te han asignado un nuevo plan!";
        const message = `Tu profesor ${req.user.nombre} te ha asignado el plan "${plan.titulo}". ¡Ya puedes verlo en la sección de planes!`;
        
        await sendSingleNotification(
            Notification, 
            User, 
            asignadoA, 
            title, 
            message, 
            'new_plan' 
        );
    }

    res.status(201).json(plan);
});


const getPlanesForUser = asyncHandler(async (req, res) => {
    const { Plan } = getModels(req.gymDBConnection);
    const planes = await Plan.find({ asignadoA: req.params.userId })
        .populate('creadoPor', 'nombre apellido')
        .populate('diasDeEntrenamiento.ejercicios.ejercicio', 'nombre videoUrl descripcion');
    
    res.json(planes);
});

const updatePlan = asyncHandler(async (req, res) => {
    const { titulo, descripcion, isVisibleToUser, diasDeEntrenamiento } = req.body;
    const { Plan } = getModels(req.gymDBConnection);

    const plan = await Plan.findById(req.params.id);

    if (!plan) {
        res.status(404);
        throw new Error('Plan no encontrado.');
    }

    plan.titulo = titulo || plan.titulo;
    plan.descripcion = descripcion;
    plan.isVisibleToUser = isVisibleToUser;
    plan.diasDeEntrenamiento = diasDeEntrenamiento || plan.diasDeEntrenamiento;

    const updatedPlan = await plan.save();
    res.json(updatedPlan);
});

const getPlanById = asyncHandler(async (req, res) => {
    const { Plan } = getModels(req.gymDBConnection);

    const plan = await Plan.findById(req.params.id)
        .populate('diasDeEntrenamiento.ejercicios.ejercicio', 'nombre videoUrl descripcion');

    if (plan) {
        if (plan.isVisibleToUser || req.user.roles.includes('admin') || req.user.roles.includes('profesor')) {
            res.json(plan);
        } else {
            res.status(403);
            throw new Error('No tienes permiso para ver este plan.');
        }
    } else {
        res.status(404);
        throw new Error('Plan no encontrado.');
    }
});


const deletePlan = asyncHandler(async (req, res) => {
    const { Plan } = getModels(req.gymDBConnection);
    const plan = await Plan.findById(req.params.id);

    if (plan) {
        await plan.deleteOne();
        res.json({ message: 'Plan eliminado correctamente.' });
    } else {
        res.status(404);
        throw new Error('Plan no encontrado.');
    }
});

export { createPlan, getPlanesForUser, deletePlan, updatePlan, getPlanById };