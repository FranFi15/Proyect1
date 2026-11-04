import express from 'express';
import rateLimit from 'express-rate-limit';
import {
    getTrialPage,
    startTrial,
    verifyTrialEmail,
    resendTrialCode,
    getTrialClasses,
    enrollTrial,
} from '../controllers/trialEnrollmentController.js';

const router = express.Router();

const trialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: 'Demasiados intentos. Probá de nuevo en unos minutos.',
});

const trialStartLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: 'Demasiados intentos de envío. Probá de nuevo en unos minutos.',
});

router.get('/:clientId', trialLimiter, getTrialPage);
router.post('/:clientId/start', trialStartLimiter, startTrial);
router.post('/:clientId/verify', trialLimiter, verifyTrialEmail);
router.post('/:clientId/resend', trialStartLimiter, resendTrialCode);
router.get('/:clientId/classes', trialLimiter, getTrialClasses);
router.post('/:clientId/enroll', trialLimiter, enrollTrial);

export default router;
