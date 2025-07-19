import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

// @desc    Crear una nueva transacción (cargo o pago)
// @route   POST /api/transactions
// @access  Private/Admin
const createTransaction = asyncHandler(async (req, res) => {
    const { Transaction, User } = getModels(req.gymDBConnection);
    const { userId, type, amount, description } = req.body;

    // Validación básica
    if (!userId || !type || !amount || !description) {
        res.status(400);
        throw new Error('Faltan campos obligatorios: userId, type, amount, description.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    // Crear la transacción
    const transaction = await Transaction.create({
        user: userId,
        type,
        amount: Math.abs(amount), // Nos aseguramos de que sea positivo
        description,
        createdBy: req.user._id, // El admin logueado
    });

    // Actualizar el balance del usuario
    const amountToUpdate = type === 'charge' ? Math.abs(amount) : -Math.abs(amount);
    user.balance += amountToUpdate;
    await user.save();

    res.status(201).json({
        message: 'Transacción creada exitosamente.',
        transaction,
        newUserBalance: user.balance,
    });
});

// @desc    Obtener el historial de transacciones de un usuario
// @route   GET /api/transactions/user/:userId
// @access  Private/Admin
const getUserTransactions = asyncHandler(async (req, res) => {
    const { Transaction } = getModels(req.gymDBConnection);
    const transactions = await Transaction.find({ user: req.params.userId })
        .populate('createdBy', 'nombre apellido')
        .sort({ createdAt: -1 });
        
    res.json(transactions);
});

// @desc    Obtener el balance del usuario logueado
// @route   GET /api/transactions/my-balance
// @access  Private
const getMyBalance = asyncHandler(async (req, res) => {
    // No necesitamos ir a la DB, el balance ya debería estar en el objeto req.user si lo incluyes al loguear.
    // Pero para asegurar el dato más fresco, hacemos la consulta.
    const { User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id);

    if (user) {
        res.json({ balance: user.balance });
    } else {
        res.status(404);
        throw new Error('Usuario no encontrado');
    }
});

export { createTransaction, getUserTransactions, getMyBalance };