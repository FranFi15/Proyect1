import express from 'express';
import { getGymClientIdByIdentifier } from '../controllers/publicController.js';

const router = express.Router();

router.get('/gym/:gymIdentifier', getGymClientIdByIdentifier);

export default router;