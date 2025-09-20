import express from 'express';
import { generateConnectUrl, handlePkceCallback } from '../controllers/mpConnectController.js';
import { protect, authorizeRoles } from '../middlewares/authMiddleware.js';

const connectRouter = express.Router();
const callbackRouter = express.Router();

connectRouter.post('/url', protect, authorizeRoles('admin'), generateConnectUrl);
callbackRouter.post('/callback-pkce', handlePkceCallback); 

export { connectRouter, callbackRouter };