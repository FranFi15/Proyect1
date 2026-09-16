import express from 'express';
import {
    getBenefitsForAdmin,
    getBenefitsForClient,
    createBenefit,
    updateBenefit,
    deleteBenefit,
} from '../controllers/benefitController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';
import gymTenantMiddleware from '../middlewares/gymTenantMiddleware.js';
import { upload } from '../utils/cloudinary.js';

const router = express.Router();

router.use(protect);
router.use(gymTenantMiddleware);

router.get('/me', getBenefitsForClient);
router.get('/', authorizeRoles('admin'), getBenefitsForAdmin);
router.post('/', authorizeRoles('admin'), upload.single('image'), createBenefit);
router.put('/:id', authorizeRoles('admin'), upload.single('image'), updateBenefit);
router.delete('/:id', authorizeRoles('admin'), deleteBenefit);

export default router;
