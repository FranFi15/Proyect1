import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
    clase: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Class',
        required: true,
    },
    profesor: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Nota: No se requiere 'user' porque el requerimiento es que sean ANÓNIMAS,
    // pero podemos guardar el usuario de forma temporal (o no devolverlo al admin) 
    // para evitar que un usuario califique 2 veces.
    // Vamos a guardar el ID pero nunca enviarlo al front.
    cliente: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5,
    },
    comment: {
        type: String,
        required: false,
        maxlength: 500,
    }
}, { timestamps: true });

// Índice para asegurar que un cliente solo pueda calificar una clase una sola vez
reviewSchema.index({ clase: 1, cliente: 1 }, { unique: true });

export default (gymDBConnection) => {
    if (gymDBConnection.models.Review) return gymDBConnection.models.Review;
    return gymDBConnection.model('Review', reviewSchema);
};
