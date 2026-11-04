import express from 'express';
import rateLimit from 'express-rate-limit';
import { getTrialPage, enrollTrial } from '../controllers/trialEnrollmentController.js';

const router = express.Router();

const trialLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 40,
    message: 'Demasiados intentos. Probá de nuevo en unos minutos.',
});

router.get('/:clientId', trialLimiter, getTrialPage);
router.post('/:clientId/enroll', trialLimiter, enrollTrial);

export default router;
