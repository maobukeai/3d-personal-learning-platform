import { Router } from 'express';
import { TwoFactorController } from '../controllers/two-factor.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Apply auth middleware to all 2FA routes
router.use(authenticate);

// CRUD APIs for 2FA accounts
router.get('/accounts', TwoFactorController.getAccounts);
router.post('/accounts', TwoFactorController.createAccount);
router.post('/accounts/import', TwoFactorController.importAccounts);
router.put('/accounts/:id', TwoFactorController.updateAccount);
router.delete('/accounts/:id', TwoFactorController.deleteAccount);

export default router;
