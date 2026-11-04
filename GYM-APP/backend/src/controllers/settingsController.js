import asyncHandler from 'express-async-handler';
import crypto from 'crypto';
import getModels from '../utils/getModels.js';

const buildTrialEnrollmentUrl = (clientId, token) => {
    const webBase = String(process.env.WEB_APP_URL || '').replace(/\/$/, '');
    if (!webBase || !clientId || !token) return '';
    return `${webBase}/trial/${encodeURIComponent(clientId)}?t=${encodeURIComponent(token)}`;
};

const getSettings = asyncHandler(async (req, res) => {
    const { Settings } = getModels(req.gymDBConnection);
    const settings = await Settings.findById('main_settings').populate('courtesyCredit.tipoClase');

    const trialEnabled = !!settings?.trialEnrollmentEnabled;
    const trialToken = settings?.trialAccessToken || '';

    res.json({
        classVisibilityDays: settings?.classVisibilityDays || 0,
        courtesyCredit: settings?.courtesyCredit || { isActive: false, amount: 1, tipoClase: null },
        bankDetails: settings?.bankDetails || { cbu: '', alias: '', bankName: '' },
        cancellationTimeLimitMinutes: settings?.cancellationTimeLimitMinutes ?? 60,
        enrollmentTimeLimitMinutes: settings?.enrollmentTimeLimitMinutes ?? 0,
        maxDailyClassesPerUser: settings?.maxDailyClassesPerUser || 0,
        reviewsPublic: !!settings?.reviewsPublic,
        trialEnrollmentEnabled: trialEnabled,
        trialEnrollmentUrl: trialEnabled ? buildTrialEnrollmentUrl(req.gymId, trialToken) : '',
        mercadoPago: {
            isLinked: !!settings?.mercadoPago?.isLinked
        }
    });
});

const newTrialToken = () => crypto.randomBytes(24).toString('hex');

const updateSettings = asyncHandler(async (req, res) => {
    const {
        classVisibilityDays,
        courtesyCredit,
        bankDetails,
        cancellationTimeLimitMinutes,
        enrollmentTimeLimitMinutes,
        maxDailyClassesPerUser,
        reviewsPublic,
        trialEnrollmentEnabled,
        rotateTrialAccessToken,
    } = req.body;
    const { Settings } = getModels(req.gymDBConnection);

    const updateData = {};

    if (classVisibilityDays !== undefined) updateData.classVisibilityDays = Number(classVisibilityDays) || 0;
    if (cancellationTimeLimitMinutes !== undefined) updateData.cancellationTimeLimitMinutes = Number(cancellationTimeLimitMinutes);
    if (enrollmentTimeLimitMinutes !== undefined) updateData.enrollmentTimeLimitMinutes = Number(enrollmentTimeLimitMinutes) || 0;
    if (maxDailyClassesPerUser !== undefined) updateData.maxDailyClassesPerUser = Number(maxDailyClassesPerUser);
    if (reviewsPublic !== undefined) updateData.reviewsPublic = Boolean(reviewsPublic);

    if (trialEnrollmentEnabled !== undefined || rotateTrialAccessToken) {
        const current = await Settings.findById('main_settings').select('trialEnrollmentEnabled trialAccessToken');
        const currentlyEnabled = !!current?.trialEnrollmentEnabled;

        if (trialEnrollmentEnabled !== undefined) {
            const enabled = Boolean(trialEnrollmentEnabled);
            updateData.trialEnrollmentEnabled = enabled;
            if (enabled && !currentlyEnabled) {
                // Rotate only when turning ON (old shared links stop working).
                updateData.trialAccessToken = newTrialToken();
            } else if (!enabled && currentlyEnabled) {
                // Invalidate the previous public link immediately.
                updateData.trialAccessToken = '';
            } else if (enabled && currentlyEnabled && !current?.trialAccessToken) {
                updateData.trialAccessToken = newTrialToken();
            }
        }

        if (rotateTrialAccessToken) {
            const willBeEnabled = updateData.trialEnrollmentEnabled !== undefined
                ? !!updateData.trialEnrollmentEnabled
                : currentlyEnabled;
            if (!willBeEnabled) {
                res.status(400);
                throw new Error('Activá la clase de prueba antes de regenerar el link.');
            }
            updateData.trialAccessToken = newTrialToken();
            updateData.trialEnrollmentEnabled = true;
        }
    }

    if (courtesyCredit) {
        const isValidObjectId = courtesyCredit.tipoClase &&
            typeof courtesyCredit.tipoClase === 'string' &&
            courtesyCredit.tipoClase.trim() !== '' &&
            courtesyCredit.tipoClase.length === 24;

        updateData.courtesyCredit = {
            isActive: Boolean(courtesyCredit.isActive),
            tipoClase: isValidObjectId ? courtesyCredit.tipoClase : null,
            amount: Number(courtesyCredit.amount) || 1
        };
    }

    if (bankDetails) {
        updateData.bankDetails = {
            cbu: bankDetails.cbu || '',
            alias: bankDetails.alias || '',
            bankName: bankDetails.bankName || ''
        };
    }

    const settings = await Settings.findByIdAndUpdate(
        'main_settings',
        { $set: updateData },
        { new: true, upsert: true }
    );

    res.json({
        ...settings.toObject?.() || settings,
        trialEnrollmentUrl: settings.trialEnrollmentEnabled
            ? buildTrialEnrollmentUrl(req.gymId, settings.trialAccessToken)
            : '',
    });
});

export { getSettings, updateSettings };
