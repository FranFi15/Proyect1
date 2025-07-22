import asyncHandler from 'express-async-handler'; 
import getModels from '../utils/getModels.js';

const createTemplate = asyncHandler(async (req, res) => {
    const { TrainingTemplate } = getModels(req.gymDBConnection);
    const { name, description, content } = req.body;

    if (!name || !content) {
        res.status(400);
        throw new Error('El nombre y el contenido son obligatorios.');
    }

    const template = await TrainingTemplate.create({
        name,
        description,
        content,
        createdBy: req.user._id,
    });
    res.status(201).json(template);
});

const getMyTemplates = asyncHandler(async (req, res) => {
    const { TrainingTemplate } = getModels(req.gymDBConnection);
    const templates = await TrainingTemplate.find({ createdBy: req.user._id }).sort({ createdAt: -1 });
    res.json(templates);
});

const updateTemplate = asyncHandler(async (req, res) => {
    const { TrainingTemplate } = getModels(req.gymDBConnection);
    const { name, description, content } = req.body;
    const template = await TrainingTemplate.findById(req.params.templateId);

    if (!template) {
        res.status(404);
        throw new Error('Plantilla no encontrada');
    }
    if (template.createdBy.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('No autorizado para editar esta plantilla');
    }

    template.name = name || template.name;
    template.description = description || template.description;
    template.content = content || template.content;

    const updatedTemplate = await template.save();
    res.json(updatedTemplate);
});

const deleteTemplate = asyncHandler(async (req, res) => {
    const { TrainingTemplate } = getModels(req.gymDBConnection);
    const template = await TrainingTemplate.findById(req.params.templateId);

    if (!template) {
        res.status(404);
        throw new Error('Plantilla no encontrada');
    }
    if (template.createdBy.toString() !== req.user._id.toString()) {
        res.status(403);
        throw new Error('No autorizado para eliminar esta plantilla');
    }

    await template.deleteOne();
    res.json({ message: 'Plantilla eliminada' });
});

// --- CONTROLADORES DE PLANES ASIGNADOS ---

const createPlanForUser = asyncHandler(async (req, res) => {
    const { TrainingPlan, TrainingTemplate } = getModels(req.gymDBConnection);
    const { userId, name, description, content, templateId, isVisibleToUser } = req.body;

    if (!userId) {
        res.status(400).throw(new Error('Se requiere el ID del usuario.'));
    }

    let planData = {
        user: userId,
        createdBy: req.user._id,
        name: name || 'Nuevo Plan',
        description,
        isVisibleToUser: isVisibleToUser || false,
    };

    if (templateId) {
        const template = await TrainingTemplate.findById(templateId);
        if (!template) {
            res.status(404).throw(new Error('Plantilla no encontrada'));
        }
        planData.name = name || template.name;
        planData.content = template.content; // Copia el contenido de la plantilla
        planData.template = templateId;
    } else {
        if (!content) {
            res.status(400).throw(new Error('Se requiere el contenido para un plan nuevo.'));
        }
        planData.content = content;
    }

    const plan = await TrainingPlan.create(planData);
    res.status(201).json(plan);
});

const getPlansForUser = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const plans = await TrainingPlan.find({ user: req.params.userId })
        .populate('createdBy', 'nombre apellido')
        .sort({ createdAt: -1 });
    res.json(plans);
});

const getMyVisiblePlans = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const plans = await TrainingPlan.find({
        user: req.user._id,
        isVisibleToUser: true,
    }).sort({ createdAt: -1 });
    res.json(plans);
});

const updatePlan = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const { name, description, content, isVisibleToUser } = req.body;
    const plan = await TrainingPlan.findById(req.params.planId);

    if (!plan) {
        res.status(404).throw(new Error('Plan no encontrado'));
    }

    plan.name = name !== undefined ? name : plan.name;
    plan.description = description !== undefined ? description : plan.description;
    plan.content = content !== undefined ? content : plan.content;
    if (isVisibleToUser !== undefined) {
        plan.isVisibleToUser = isVisibleToUser;
    }
    
    const updatedPlan = await plan.save();
    res.json(updatedPlan);
});

const deletePlan = asyncHandler(async (req, res) => {
    const { TrainingPlan } = getModels(req.gymDBConnection);
    const plan = await TrainingPlan.findById(req.params.planId);

    if (plan) {
        await plan.deleteOne();
        res.json({ message: 'Plan de entrenamiento eliminado' });
    } else {
        res.status(404).throw(new Error('Plan no encontrado'));
    }
});

export {
    createTemplate,
    getMyTemplates,
    updateTemplate,
    deleteTemplate,
    createPlanForUser,
    getPlansForUser,
    getMyVisiblePlans,
    updatePlan,
    deletePlan
};