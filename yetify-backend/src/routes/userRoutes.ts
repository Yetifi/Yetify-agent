import { Router } from 'express';
import userController from '../controllers/userController';

const router = Router();

// Update user API keys
router.post('/api-keys', userController.updateApiKeys.bind(userController));

// Get user API keys status
router.get('/:walletAddress/api-keys', userController.getApiKeys.bind(userController));

// Delete user API keys
router.delete('/:walletAddress/api-keys', userController.deleteApiKeys.bind(userController));

export default router;