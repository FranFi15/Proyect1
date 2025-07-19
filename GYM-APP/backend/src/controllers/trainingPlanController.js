import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

// @desc    Crear un nuevo plan de entrenamiento
// @route   POST /api/plans
// @access  Private/Admin/Profesor
const createPlan = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const { userId, title, content, isVisibleToUser } = req.body;

    if (!userId || !content) {
        res.status(400);
        throw new Error('Faltan campos obligatorios: userId, content.');
    }

    const plan = await TrainingPlan.create({
        user: userId,
        createdBy: req.user._id,
        title,
        content,
        isVisibleToUser: isVisibleToUser || false,
    });

    res.status(201).json(plan);
});

// @desc    Obtener todos los planes de un usuario (vista admin)
// @route   GET /api/plans/user/:userId
// @access  Private/Admin/Profesor
const getPlansForUser = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const plans = await TrainingPlan.find({ user: req.params.userId })
        .populate('createdBy', 'nombre apellido')
        .sort({ createdAt: -1 });
    res.json(plans);
});

// @desc    Obtener el plan visible para el usuario logueado
// @route   GET /api/plans/my-plan
// @access  Private
const getMyVisiblePlan = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    // Buscamos el plan más reciente que sea visible
    const plan = await TrainingPlan.findOne({
        user: req.user._id,
        isVisibleToUser: true,
    }).sort({ createdAt: -1 });

    if (plan) {
        res.json(plan);
    } else {
        // Es importante no dar un 404 para que el frontend sepa que no hay plan visible
        res.json(null);
    }
});

// @desc    Actualizar un plan de entrenamiento
// @route   PUT /api/plans/:planId
// @access  Private/Admin/Profesor
const updatePlan = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const { title, content, isVisibleToUser } = req.body;

    const plan = await TrainingPlan.findById(req.params.planId);

    if (plan) {
        plan.title = title || plan.title;
        plan.content = content || plan.content;
        // Permite actualizar la visibilidad a true o false
        if (isVisibleToUser !== undefined) {
            plan.isVisibleToUser = isVisibleToUser;
        }
        
        const updatedPlan = await plan.save();
        res.json(updatedPlan);
    } else {
        res.status(404);
        throw new Error('Plan no encontrado');
    }
});

// @desc    Eliminar un plan de entrenamiento
// @route   DELETE /api/plans/:planId
// @access  Private/Admin/Profesor
const deletePlan = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const plan = await TrainingPlan.findById(req.params.planId);

    if (plan) {
        await plan.deleteOne();
        res.json({ message: 'Plan de entrenamiento eliminado' });
    } else {
        res.status(404);
        throw new Error('Plan no encontrado');
    }
});

export { createPlan, getPlansForUser, getMyVisiblePlan, updatePlan, deletePlan };