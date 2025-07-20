import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

// @desc    Crear una nueva transacción (cargo o pago)
// @route   POST /api/transactions
// @access  Private/Admin
const createTransaction = asyncHandler(async (req, res) => {
    const { Transaction, User } = getModels(req.gymDBConnection);
    const { userId, type, amount, description } = req.body;

    if (!userId || !type || !amount || !description) {
        res.status(400);
        throw new Error('Faltan campos obligatorios.');
    }

    const user = await User.findById(userId);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    const numericAmount = Number(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
        res.status(400);
        throw new Error('El monto debe ser un número positivo.');
    }

    // --- LÓGICA DE SALDO CORREGIDA ---
    // Un 'charge' (cargo) es negativo para el balance (aumenta la deuda).
    // Un 'payment' (pago) es positivo para el balance (reduce la deuda).
    const amountToUpdate = type === 'charge' ? -numericAmount : numericAmount;
    user.balance += amountToUpdate;

    const transaction = await Transaction.create({
        user: userId,
        type,
        amount: numericAmount,
        description,
        createdBy: req.user._id,
    });
    
    await user.save();

    res.status(201).json({
        message: 'Transacción creada exitosamente.',
        transaction,
        newUserBalance: user.balance, // Se envía el nuevo saldo actualizado
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

const getMyTransactions = asyncHandler(async (req, res) => {
    const { Transaction } = getModels(req.gymDBConnection);
    const transactions = await Transaction.find({ user: req.user._id })
        .populate('createdBy', 'nombre apellido')
        .sort({ createdAt: -1 });
        
    res.json(transactions);
});

export  { createTransaction, getUserTransactions, getMyBalance, getMyTransactions };