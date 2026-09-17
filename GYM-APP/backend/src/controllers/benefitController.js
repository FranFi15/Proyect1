import asyncHandler from 'express-async-handler';
import getModels from '../utils/getModels.js';

const getUploadedImageUrl = (file) =>
    file?.secure_url || file?.path || file?.url || '';

const parseBool = (value, fallback = false) => {
    if (value === undefined || value === null || value === '') return fallback;
    if (typeof value === 'boolean') return value;
    const normalized = String(value).trim().toLowerCase();
    if (['true', '1', 'yes', 'si', 'sí'].includes(normalized)) return true;
    if (['false', '0', 'no'].includes(normalized)) return false;
    return fallback;
};

const asCreditsMap = (creditosPorTipo) => {
    if (!creditosPorTipo) return new Map();
    if (creditosPorTipo instanceof Map) return creditosPorTipo;
    if (typeof creditosPorTipo === 'object') {
        return new Map(Object.entries(creditosPorTipo));
    }
    return new Map();
};

export const evaluateBenefitEligibility = (user) => {
    const now = new Date();
    const creditsMap = asCreditsMap(user?.creditosPorTipo);
    let creditsTotal = 0;
    for (const value of creditsMap.values()) {
        creditsTotal += Math.max(0, Number(value) || 0);
    }
    const hasCredits = creditsTotal > 0;

    const paseDesde = user?.paseLibreDesde ? new Date(user.paseLibreDesde) : null;
    const paseHasta = user?.paseLibreHasta ? new Date(user.paseLibreHasta) : null;
    const hasPaseLibre = Boolean(
        paseDesde &&
        paseHasta &&
        !Number.isNaN(paseDesde.getTime()) &&
        !Number.isNaN(paseHasta.getTime()) &&
        now >= paseDesde &&
        now <= paseHasta
    );

    const membresiaHasta = user?.membresiaHasta ? new Date(user.membresiaHasta) : null;
    const membresiaDesde = user?.membresiaDesde ? new Date(user.membresiaDesde) : null;
    const hasMembresia = Boolean(
        membresiaHasta &&
        !Number.isNaN(membresiaHasta.getTime()) &&
        now <= membresiaHasta &&
        (!membresiaDesde || Number.isNaN(membresiaDesde.getTime()) || now >= membresiaDesde)
    );

    const reasons = [];
    if (hasCredits) reasons.push('créditos');
    if (hasPaseLibre) reasons.push('acceso libre');
    if (hasMembresia) reasons.push('membresía');

    return {
        eligible: hasCredits || hasPaseLibre || hasMembresia,
        hasCredits,
        hasPaseLibre,
        hasMembresia,
        creditsTotal,
        reasons,
        paseLibreHasta: hasPaseLibre ? paseHasta : null,
        membresiaHasta: hasMembresia ? membresiaHasta : null,
    };
};

const getBenefitsForAdmin = asyncHandler(async (req, res) => {
    const { Benefit } = getModels(req.gymDBConnection);
    const includeInactive = req.query.all === '1';
    const query = includeInactive ? {} : { isActive: true };
    const benefits = await Benefit.find(query).sort({ createdAt: -1 });
    res.json(benefits);
});

const getBenefitsForClient = asyncHandler(async (req, res) => {
    const { Benefit, User } = getModels(req.gymDBConnection);
    const user = await User.findById(req.user._id);
    if (!user) {
        res.status(404);
        throw new Error('Usuario no encontrado.');
    }

    const eligibility = evaluateBenefitEligibility(user);
    const benefits = eligibility.eligible
        ? await Benefit.find({ isActive: true }).sort({ createdAt: -1 })
        : [];

    res.json({
        eligible: eligibility.eligible,
        eligibility: {
            hasCredits: eligibility.hasCredits,
            hasPaseLibre: eligibility.hasPaseLibre,
            hasMembresia: eligibility.hasMembresia,
            creditsTotal: eligibility.creditsTotal,
            reasons: eligibility.reasons,
            paseLibreHasta: eligibility.paseLibreHasta,
            membresiaHasta: eligibility.membresiaHasta,
        },
        benefits,
        client: {
            _id: user._id,
            nombre: user.nombre,
            apellido: user.apellido,
            dni: user.dni,
            email: user.email,
            fotoPerfil: user.fotoPerfil || '',
        },
        lockedMessage: eligibility.eligible
            ? null
            : 'Activá tu plan (créditos, acceso libre o membresía) para desbloquear los beneficios.',
    });
});

const createBenefit = asyncHandler(async (req, res) => {
    const { Benefit } = getModels(req.gymDBConnection);
    const { name, description, isActive } = req.body;

    if (!name || !String(name).trim()) {
        res.status(400);
        throw new Error('El nombre es obligatorio.');
    }
    if (!description || !String(description).trim()) {
        res.status(400);
        throw new Error('La descripción del beneficio es obligatoria.');
    }

    const benefit = await Benefit.create({
        name: String(name).trim(),
        description: String(description).trim(),
        imageUrl: getUploadedImageUrl(req.file),
        isActive: parseBool(isActive, true),
        createdBy: req.user._id,
    });

    res.status(201).json(benefit);
});

const updateBenefit = asyncHandler(async (req, res) => {
    const { Benefit } = getModels(req.gymDBConnection);
    const benefit = await Benefit.findById(req.params.id);
    if (!benefit) {
        res.status(404);
        throw new Error('Beneficio no encontrado.');
    }

    const { name, description, isActive, clearImage } = req.body;
    if (name != null) benefit.name = String(name).trim();
    if (description != null) benefit.description = String(description).trim();
    if (isActive != null && isActive !== '') benefit.isActive = parseBool(isActive, benefit.isActive);

    const uploadedUrl = getUploadedImageUrl(req.file);
    if (uploadedUrl) {
        benefit.imageUrl = uploadedUrl;
    } else if (parseBool(clearImage, false)) {
        benefit.imageUrl = '';
    }

    if (!benefit.name) {
        res.status(400);
        throw new Error('El nombre es obligatorio.');
    }
    if (!benefit.description) {
        res.status(400);
        throw new Error('La descripción del beneficio es obligatoria.');
    }

    await benefit.save();
    res.json(benefit);
});

const deleteBenefit = asyncHandler(async (req, res) => {
    const { Benefit } = getModels(req.gymDBConnection);
    const benefit = await Benefit.findById(req.params.id);
    if (!benefit) {
        res.status(404);
        throw new Error('Beneficio no encontrado.');
    }
    benefit.isActive = false;
    await benefit.save();
    res.json({ message: 'Beneficio desactivado.' });
});

export {
    getBenefitsForAdmin,
    getBenefitsForClient,
    createBenefit,
    updateBenefit,
    deleteBenefit,
};
