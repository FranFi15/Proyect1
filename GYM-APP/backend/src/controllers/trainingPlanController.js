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


const createPlanForUser = asyncHandler(async (req, res) => {
    const { TrainingPlan, TrainingTemplate, User, Clase } = getModels(req.gymDBConnection);
    
    const { 
        userIds, userId, 
        targetType, targetId, 
        name, description, content, templateId, isVisibleToUser 
    } = req.body;

    let targets = [];

    if (targetType) {
        switch (targetType) {
            case 'all':
                const allClients = await User.find({ roles: 'cliente', isActive: true }, '_id');
                targets = allClients.map(u => u._id);
                break;
            case 'class':
                if (!targetId) { res.status(400); throw new Error('Falta el ID de la clase.'); }
                const clase = await Clase.findById(targetId);
                if (!clase) { res.status(404); throw new Error('Clase no encontrada.'); }
                const classUsers = await User.find({ 
                    _id: { $in: clase.usuariosInscritos }, 
                    isActive: true 
                }, '_id');
                targets = classUsers.map(u => u._id);
                break;
            case 'user': 
            default:
                if (userIds && Array.isArray(userIds)) targets = userIds;
                else if (userId) targets = [userId];
                break;
        }
    } else {
        if (userIds && Array.isArray(userIds)) {
            targets = userIds;
        } else if (userId) {
            targets = [userId];
        }
    }

    targets = [...new Set(targets.map(id => id.toString()))];

    if (targets.length === 0) {
        res.status(400);
        throw new Error('No se encontraron usuarios destinatarios válidos para asignar el plan.');
    }

    let planContent = content;
    let planName = name || 'Nuevo Plan';

    if (templateId) {
        const template = await TrainingTemplate.findById(templateId);
        if (!template) {
            res.status(404);
            throw new Error('Plantilla no encontrada');
        }
        planName = name || template.name;
        planContent = template.content;
    } else {
        if (!content) {
            res.status(400);
            throw new Error('Se requiere el contenido para el plan.');
        }
    }

    const createdPlans = await Promise.all(targets.map(async (uid) => {
        return await TrainingPlan.create({
            user: uid,
            createdBy: req.user._id,
            name: planName,
            description,
            content: planContent, 
            template: templateId || undefined,
            isVisibleToUser: isVisibleToUser || false,
        });
    }));

    res.status(201).json({ 
        message: `Plan asignado exitosamente a ${createdPlans.length} cliente(s).`,
        count: createdPlans.length 
    });
});

const getPlansForUser = asyncHandler(async (req, res) => {
    const { TrainingPlan, User } = getModels(req.gymDBConnection);
    const userId = req.params.userId;


    const user = await User.findById(userId);
    if (!user || !user.isActive) {
        console.log(`Acceso denegado o usuario inactivo para ver planes: ${userId}`);
        return res.json([]); 
    }
    const plans = await TrainingPlan.find({ user: userId })
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
    const { TrainingPlan, User } = getModels(req.gymDBConnection);
    const { name, description, content, isVisibleToUser } = req.body;
    const plan = await TrainingPlan.findById(req.params.planId);

    if (!plan) {
        res.status(404);
        throw new Error('Plan no encontrado');
    }

    const user = await User.findById(plan.user);
    if (!user || !user.isActive) {
        res.status(403);
        throw new Error('No se pueden modificar planes de un usuario inactivo.');
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
    const { TrainingPlan, User } = getModels(req.gymDBConnection);
    const plan = await TrainingPlan.findById(req.params.planId);

    if (!plan) {
        res.status(404);
        throw new Error('Plan no encontrado');
    }

    const isOwner = plan.user.toString() === req.user._id.toString();
    const isProfOrAdmin = req.user.roles.some(role => ['admin', 'profesor'].includes(role));

    if (!isOwner && !isProfOrAdmin) {
        res.status(403);
        throw new Error('No tienes permiso para eliminar este plan.');
    }

    if (isProfOrAdmin) {
        const user = await User.findById(plan.user);
        if (!user || !user.isActive) {
            res.status(403);
            throw new Error('No se pueden eliminar planes de un usuario inactivo.');
        }
    }

    await plan.deleteOne();
    res.json({ message: 'Plan de entrenamiento eliminado' });
});

const deleteAllPlans = asyncHandler(async (req, res) => {
    const { TrainingPlan, User } = getModels(req.gymDBConnection);
    
    let targetUserId;

    if (req.params.userId) {
        if (!req.user.roles.some(role => ['admin', 'profesor'].includes(role))) {
            res.status(403);
            throw new Error('No autorizado para eliminar planes de otros usuarios.');
        }
        targetUserId = req.params.userId;
    } else {
        targetUserId = req.user._id;
    }

    const user = await User.findById(targetUserId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado');
    }

    const result = await TrainingPlan.deleteMany({ user: targetUserId });

    res.json({ 
        message: 'Todos los planes han sido eliminados.', 
        deletedCount: result.deletedCount 
    });
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
    deletePlan,
    deleteAllPlans

};