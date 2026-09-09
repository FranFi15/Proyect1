// src/controllers/paymentController.js
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { sendSingleNotification } from './notificationController.js';
import { Expo } from 'expo-server-sdk';
import { fulfillApprovedPayment } from '../services/paymentFulfillment.js';
import { createCheckoutPreference, getMpSettings } from './mercadopagoController.js';
const expo = new Expo();

// @desc    Crear un nuevo paquete de pago (Admin)
const createPackage = asyncHandler(async (req, res) => {
    const { PaymentPackage } = getModels(req.gymDBConnection);
    const { name, description, price, tipoClase, creditsAmount, isPaseLibre, isMembresia, durationDays } = req.body;

    if (!name || !price) {
        res.status(400);
        throw new Error('El nombre y el precio son obligatorios.');
    }

    const newPackage = await PaymentPackage.create({
        name,
        description,
        price,
        isPaseLibre: !!isPaseLibre,
        isMembresia: !isPaseLibre && !!isMembresia,
        durationDays,
        creditsAmount: isPaseLibre || isMembresia ? 0 : creditsAmount,
        tipoClase: isPaseLibre || isMembresia ? null : tipoClase
    });

    res.status(201).json(newPackage);
});

// @desc    Editar un paquete existente
const updatePackage = asyncHandler(async (req, res) => {
    const { PaymentPackage } = getModels(req.gymDBConnection);
    const packageId = req.params.id;

    const updatedPackage = await PaymentPackage.findByIdAndUpdate(
        packageId, 
        req.body, 
        { new: true } // Devuelve el documento actualizado
    );

    if (!updatedPackage) {
        res.status(404);
        throw new Error('Paquete no encontrado.');
    }
    res.json(updatedPackage);
});

// @desc    "Eliminar" un paquete (Ocultarlo para no romper historiales)
const deletePackage = asyncHandler(async (req, res) => {
    const { PaymentPackage } = getModels(req.gymDBConnection);
    const packageId = req.params.id;

    const pkg = await PaymentPackage.findById(packageId);
    if (!pkg) {
        res.status(404);
        throw new Error('Paquete no encontrado.');
    }

    pkg.isActive = false; // Lo ocultamos
    await pkg.save();

    res.json({ message: 'Paquete eliminado correctamente.' });
});

// @desc    Obtener todos los paquetes activos (Clientes y Admin)
const getPackages = asyncHandler(async (req, res) => {
    const { PaymentPackage } = getModels(req.gymDBConnection);
    // Traemos los paquetes activos y populamos el nombre del tipo de clase
    const packages = await PaymentPackage.find({ isActive: true }).populate('tipoClase', 'nombre');
    res.json(packages);
});

// @desc    El cliente envía el comprobante de transferencia
// @desc    El cliente envía el comprobante de transferencia
const submitTransferReceipt = asyncHandler(async (req, res) => {
    const { PaymentRequest, PaymentPackage, User } = getModels(req.gymDBConnection);
    const { packageId, amountTransferred } = req.body;

    let receiptUrl = null;
    if (req.file) {
        receiptUrl = req.file.secure_url || req.file.path || req.file.url;
    }

    if (!amountTransferred || !receiptUrl) {
        res.status(400);
        throw new Error('El monto y el comprobante de transferencia son obligatorios.');
    }

    if (packageId) {
        const pkg = await PaymentPackage.findById(packageId);
        if (!pkg) {
            res.status(404);
            throw new Error('Paquete no encontrado.');
        }
    }

    const ticket = await PaymentRequest.create({
        user: req.user._id,
        package: packageId || null,
        amountTransferred: Number(amountTransferred),
        receiptUrl,
        status: 'pending',
        method: 'transfer'
    });

    // 🔥 LA MAGIA DE LAS NOTIFICACIONES PUSH 🔥
    try {
        // Buscamos a todos los Admins que tengan un Token de celular guardado
        const admins = await User.find({ 
            roles: 'admin', 
            pushToken: { $exists: true, $ne: '' } 
        });

        if (admins.length > 0) {
            let messages = [];
            for (let admin of admins) {
                // Verificamos que el token sea válido para Expo
                if (!Expo.isExpoPushToken(admin.pushToken)) continue;

                messages.push({
                    to: admin.pushToken,
                    sound: 'default',
                    title: '¡Nueva Transferencia!',
                    body: `${req.user.nombre} ha informado un pago de $${amountTransferred}.`,
                    data: { route: 'ManageClients' },
                });
            }

            // Expo recomienda enviar los mensajes en "bloques" por si son muchos
            let chunks = expo.chunkPushNotifications(messages);
            for (let chunk of chunks) {
                await expo.sendPushNotificationsAsync(chunk);
            }
            console.log("Notificación push enviada a administradores.");
        }
    } catch (pushError) {
        console.error("Error enviando notificaciones push:", pushError);
    }

    res.status(201).json({ message: 'Comprobante enviado con éxito. Esperando aprobación del administrador.', ticket });
});

// @desc    Obtener todos los tickets (Admin)
const getPendingRequests = asyncHandler(async (req, res) => {
    const { PaymentRequest } = getModels(req.gymDBConnection);
    // Traemos los pendientes ordenados por los más viejos primero (FIFO)
    const tickets = await PaymentRequest.find({ status: 'pending', method: { $ne: 'mercadopago' } })
        .populate('user', 'nombre apellido email dni')
        .populate({
            path: 'package',
            populate: { path: 'tipoClase', select: 'nombre' }
        })
        .sort({ createdAt: 1 });
        
    res.json(tickets);
});

// @desc    Aprobar o Rechazar un Ticket (Admin)
const processTransferTicket = asyncHandler(async (req, res) => {
    const { PaymentRequest, User, Transaction, Notification, CreditLog } = getModels(req.gymDBConnection);
    const { action, adminNotes } = req.body; // action puede ser 'approve' o 'reject'
    const ticketId = req.params.id;

    const ticket = await PaymentRequest.findById(ticketId).populate('package');
    if (!ticket) {
        res.status(404);
        throw new Error('Ticket no encontrado');
    }
    
    if (ticket.status !== 'pending') {
        res.status(400);
        throw new Error('Este ticket ya fue procesado');
    }

    const user = await User.findById(ticket.user);

    if (action === 'reject') {
        ticket.status = 'rejected';
        ticket.adminNotes = adminNotes || 'Comprobante inválido o transferencia no recibida.';
        ticket.reviewedBy = req.user._id;
        ticket.reviewedAt = Date.now();
        await ticket.save();

        await sendSingleNotification(
            Notification, User, user._id, 
            "Transferencia Rechazada", 
            `Tu comprobante por $${ticket.amountTransferred} fue rechazado. Motivo: ${ticket.adminNotes}`, 
            'transaction_rejected', true
        );

        return res.json({ message: 'Ticket rechazado correctamente.' });
    }

    if (action === 'approve') {
        await fulfillApprovedPayment({
            models: { Transaction, CreditLog, Notification, User },
            user,
            pkg: ticket.package,
            amount: ticket.amountTransferred,
            description: ticket.package ? `Transferencia por: ${ticket.package.name}` : 'Abono de deuda por transferencia',
            createdBy: req.user._id,
            receiptUrl: ticket.receiptUrl,
            ticketId: ticket._id
        });

        ticket.status = 'approved';
        ticket.adminNotes = adminNotes || 'Pago verificado correctamente.';
        ticket.reviewedBy = req.user._id;
        ticket.reviewedAt = Date.now();
        await ticket.save();

        return res.json({ message: 'Transferencia aprobada. Balance y créditos actualizados.' });
    }

    res.status(400);
    throw new Error('Acción no válida');
});

const createMercadoPagoPreference = asyncHandler(async (req, res) => {
    const { PaymentPackage, PaymentRequest, Settings } = getModels(req.gymDBConnection);
    const { packageId, amount } = req.body;

    const settings = await getMpSettings(Settings);
    if (!settings) {
        res.status(400);
        throw new Error('Este gimnasio todavía no tiene Mercado Pago vinculado.');
    }

    let pkg = null;
    let amountToPay = Number(amount);

    if (packageId) {
        pkg = await PaymentPackage.findById(packageId);
        if (!pkg || !pkg.isActive) {
            res.status(404);
            throw new Error('Paquete no encontrado.');
        }
        amountToPay = Number(pkg.price);
    }

    if (!amountToPay || Number.isNaN(amountToPay) || amountToPay <= 0) {
        res.status(400);
        throw new Error('El monto a pagar no es válido.');
    }

    const ticket = await PaymentRequest.create({
        user: req.user._id,
        package: pkg?._id || null,
        amountTransferred: amountToPay,
        receiptUrl: '',
        status: 'pending',
        method: 'mercadopago'
    });

    try {
        const preference = await createCheckoutPreference({
            req,
            settings,
            ticket,
            pkg,
            amountToPay,
            user: req.user
        });

        ticket.mpPreferenceId = preference.id;
        await ticket.save();

        res.status(201).json({
            ticketId: ticket._id,
            preferenceId: preference.id,
            checkoutUrl: preference.init_point || preference.sandbox_init_point || preference.body?.init_point
        });
    } catch (error) {
        ticket.status = 'rejected';
        ticket.adminNotes = 'No se pudo crear la preferencia de Mercado Pago.';
        await ticket.save();
        console.error('Error creando preferencia MP:', error?.cause || error?.message || error);
        res.status(502);
        throw new Error('No se pudo iniciar el pago con Mercado Pago. Intentá de nuevo.');
    }
});

const getMyTicket = asyncHandler(async (req, res) => {
    const { PaymentRequest } = getModels(req.gymDBConnection);
    const ticket = await PaymentRequest.findById(req.params.id).populate('package', 'name price isPaseLibre isMembresia creditsAmount durationDays');

    if (!ticket || ticket.user.toString() !== req.user._id.toString()) {
        res.status(404);
        throw new Error('Ticket no encontrado');
    }

    res.json({
        _id: ticket._id,
        status: ticket.status,
        method: ticket.method,
        amountTransferred: ticket.amountTransferred,
        mpStatus: ticket.mpStatus || null,
        package: ticket.package,
        createdAt: ticket.createdAt
    });
});

export {
    createPackage,
    getPackages,
    updatePackage,
    deletePackage,
    submitTransferReceipt,
    getPendingRequests,
    processTransferTicket,
    createMercadoPagoPreference,
    getMyTicket
};