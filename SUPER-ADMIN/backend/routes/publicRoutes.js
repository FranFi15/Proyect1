import express from 'express';
import { getGymClientIdByIdentifier, getClientInfoByIdentifier  } from '../controllers/publicController.js';

const router = express.Router();

router.get('/gym/:gymIdentifier', getGymClientIdByIdentifier);
router.get('/client/:identifier', getClientInfoByIdentifier);

export default router;