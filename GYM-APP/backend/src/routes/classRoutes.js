// src/routes/classRoutes.js
import express from 'express';
import {
    createClass,
    getAllClasses,
    getClassById,
    updateClass,
    deleteClass,
    enrollUserInClass,
    unenrollUserFromClass,
    cancelClassInstance,
    reactivateClass,
    bulkUpdateClasses,
    bulkDeleteClasses,
     getGroupedClasses,
     bulkExtendClasses,
     cancelClassesByDate,
     reactivateClassesByDate,
     getAvailableSlotsForPlan,
     subscribeToWaitlist,
     unsubscribeFromWaitlist,
     getProfessorClasses,
    getClassStudents,
} from '../controllers/classController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const router = express.Router();

router.get('/profesor/me', protect, authorizeRoles('profesor', 'admin'), getProfessorClasses);
router.get('/:id/students', protect, authorizeRoles('profesor', 'admin'), getClassStudents);

router.post('/cancel-day', protect, authorizeRoles('admin'), cancelClassesByDate);
router.post('/reactivate-day', protect, authorizeRoles('admin'), reactivateClassesByDate);

router.get('/grouped', protect, authorizeRoles('admin'), getGroupedClasses);
router.route('/available-slots').get(protect, authorizeRoles('admin'), getAvailableSlotsForPlan);
router.post('/bulk-extend', protect, authorizeRoles('admin'), bulkExtendClasses); 
router.put('/bulk-update', protect, authorizeRoles('admin'), bulkUpdateClasses);
router.post('/bulk-delete', protect, authorizeRoles('admin'), bulkDeleteClasses);

// Rutas para la gestión de clases 
router.route('/')
    .post(protect, authorizeRoles('admin'), createClass) 
    .get(getAllClasses); 

router.route('/:id')
    .get(getClassById) 
    .put(protect, authorizeRoles('admin'), updateClass) 
    .delete(protect, authorizeRoles('admin'), deleteClass); 

// Rutas para que los usuarios se inscriban/desinscriban
router.post('/:id/enroll', protect, enrollUserInClass); 
router.post('/:id/unenroll', protect, unenrollUserFromClass);
router.route('/:id/waitlist/subscribe').post(protect, subscribeToWaitlist);
router.route('/:id/waitlist/unsubscribe').post(protect, unsubscribeFromWaitlist);

router.put('/:id/cancel', protect, authorizeRoles('admin', 'teacher'), cancelClassInstance);
router.put('/:id/reactivate', protect, authorizeRoles('admin'), reactivateClass); 



export default router;
