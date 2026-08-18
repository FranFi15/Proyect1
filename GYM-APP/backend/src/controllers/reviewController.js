import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

// @desc    Create a new review for a class
// @route   POST /api/reviews
// @access  Private (Cliente)
const createReview = asyncHandler(async (req, res) => {
    const { Clase, Review } = getModels(req.gymDBConnection);
    const { claseId, profesorId, rating, comment } = req.body;
    const userId = req.user._id;

    // Verificar si la clase existe y el usuario asistió
    const clase = await Clase.findById(claseId);
    if (!clase) {
        res.status(404);
        throw new Error('Clase no encontrada');
    }

    if (!clase.asistencias.includes(userId)) {
        res.status(403);
        throw new Error('No puedes calificar una clase a la que no asististe');
    }

    // Verificar si ya la calificó
    const existingReview = await Review.findOne({ clase: claseId, cliente: userId });
    if (existingReview) {
        res.status(400);
        throw new Error('Ya has calificado esta clase');
    }

    const review = await Review.create({
        clase: claseId,
        profesor: profesorId,
        cliente: userId,
        rating: Number(rating),
        comment
    });

    // Actualizar el promedio en el User
    const { User } = getModels(req.gymDBConnection);
    const profesor = await User.findById(profesorId);
    if (profesor) {
        const currentCount = profesor.ratingCount || 0;
        const currentAverage = profesor.ratingAverage || 0;
        const newCount = currentCount + 1;
        const newAverage = ((currentAverage * currentCount) + Number(rating)) / newCount;
        
        profesor.ratingCount = newCount;
        profesor.ratingAverage = newAverage;
        await profesor.save();
    }

    res.status(201).json(review);
});

// @desc    Get reviews for a specific professor
// @route   GET /api/reviews/profesor/:id
// @access  Private (Admin / Cliente if public)
const getProfesorReviews = asyncHandler(async (req, res) => {
    const { Review } = getModels(req.gymDBConnection);
    const profesorId = req.params.id;

    // Solo devolveremos rating y comment, omitiendo al cliente para mantener anonimato
    const reviews = await Review.find({ profesor: profesorId })
        .select('rating comment createdAt')
        .sort({ createdAt: -1 });

    const totalRatings = reviews.length;
    const averageRating = totalRatings > 0 
        ? (reviews.reduce((acc, rev) => acc + rev.rating, 0) / totalRatings).toFixed(1) 
        : 0;

    res.json({
        reviews,
        averageRating,
        totalRatings
    });
});

export { createReview, getProfesorReviews };
