// src/controllers/paymentController.js
import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';
import { sendSingleNotification } from './notificationController.js';
import { format } from 'date-fns';

// @desc    Crear un nuevo paquete de pago (Admin)
const createPackage = asyncHandler(async (req, res) => {
    const { PaymentPackage } = getModels(req.gymDBConnection);
    const { name, description, price, tipoClase, creditsAmount, isPaseLibre, durationDays } = req.body;

    if (!name || !price) {
        res.status(400);
        throw new Error('El nombre y el precio son obligatorios.');
    }

    const newPackage = await PaymentPackage.create({
        name, description, price, tipoClase, creditsAmount, isPaseLibre, durationDays
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
const submitTransferReceipt = asyncHandler(async (req, res) => {
    const { PaymentRequest, PaymentPackage } = getModels(req.gymDBConnection);
    const { packageId, amountTransferred } = req.body;

    // 🔥 FIX: Buscar la URL en las diferentes propiedades que puede devolver Cloudinary
    let receiptUrl = null;
    if (req.file) {
        receiptUrl = req.file.secure_url || req.file.path || req.file.url;
    }

    console.log("Datos recibidos en el servidor:", { packageId, amountTransferred, receiptUrl }); // <-- Agrega este log para depurar

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
        status: 'pending'
    });

    res.status(201).json({ message: 'Comprobante enviado con éxito. Esperando aprobación del administrador.', ticket });
});

// @desc    Obtener todos los tickets (Admin)
const getPendingRequests = asyncHandler(async (req, res) => {
    const { PaymentRequest } = getModels(req.gymDBConnection);
    // Traemos los pendientes ordenados por los más viejos primero (FIFO)
    const tickets = await PaymentRequest.find({ status: 'pending' })
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
    const { PaymentRequest, User, Transaction, Notification } = getModels(req.gymDBConnection);
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
            `Tu comprobante por $${ticket.amountTransferred} ha sido rechazado. Motivo: ${ticket.adminNotes}`, 
            'transaction_rejected', true
        );

        return res.json({ message: 'Ticket rechazado correctamente.' });
    }

    if (action === 'approve') {
        // --- 1. REGISTRAR EL PAGO (Ingreso de plata) ---
        user.balance += ticket.amountTransferred; // Si debía -15000, ahora queda en 0
        
        await Transaction.create({
            user: user._id,
            type: 'payment',
            amount: ticket.amountTransferred,
            description: ticket.package ? `Transferencia por: ${ticket.package.name}` : 'Abono de deuda por transferencia',
            createdBy: req.user._id 
        });

        // --- 2. ENTREGAR EL PAQUETE (Si compró uno) ---
        if (ticket.package) {
            // A. Restamos el valor del paquete al balance para generar la "Venta"
            user.balance -= ticket.package.price;
            
            await Transaction.create({
                user: user._id,
                type: 'charge',
                amount: ticket.package.price,
                description: `Cargo por compra de paquete: ${ticket.package.name}`,
                createdBy: req.user._id 
            });

            // B. Entregar los créditos o el Pase Libre
            if (ticket.package.isPaseLibre) {
                const hoy = new Date();
                user.paseLibreDesde = hoy;
                const vencimientoPase = new Date(hoy);
                vencimientoPase.setDate(hoy.getDate() + ticket.package.durationDays);
                vencimientoPase.setUTCHours(23, 59, 59, 999);
                user.paseLibreHasta = vencimientoPase;
            } else if (ticket.package.tipoClase && ticket.package.creditsAmount > 0) {
                const tipoClaseId = ticket.package.tipoClase.toString();
                const currentCredits = user.creditosPorTipo.get(tipoClaseId) || 0;
                user.creditosPorTipo.set(tipoClaseId, currentCredits + ticket.package.creditsAmount);
                
                const fechaVto = new Date();
                fechaVto.setDate(fechaVto.getDate() + 30); // Vencimiento a 30 días
                
                user.vencimientosDetallados.push({
                    tipoClaseId: tipoClaseId,
                    cantidad: ticket.package.creditsAmount,
                    fechaVencimiento: fechaVto,
                    idCarga: ticket._id.toString() // Guardamos el ID del ticket como ref
                });
            }
        }

        // --- 3. CERRAR TICKET Y NOTIFICAR ---
        ticket.status = 'approved';
        ticket.adminNotes = adminNotes || 'Pago verificado correctamente.';
        ticket.reviewedBy = req.user._id;
        ticket.reviewedAt = Date.now();
        
        user.markModified('creditosPorTipo');
        await ticket.save();
        await user.save();

        await sendSingleNotification(
            Notification, User, user._id, 
            "Transferencia Aprobada ✅", 
            `Hemos verificado tu pago de $${ticket.amountTransferred}. Tu saldo ha sido actualizado.`, 
            'transaction_payment', false
        );

        return res.json({ message: 'Transferencia aprobada. Balance y créditos actualizados.' });
    }

    res.status(400);
    throw new Error('Acción no válida');
});

export {
    createPackage,
    getPackages,
    submitTransferReceipt,
    getPendingRequests,
    processTransferTicket
};