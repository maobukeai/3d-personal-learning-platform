import { Router } from 'express';
import { GoogleWarmingController } from '../controllers/google-warming.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

// Apply auth middleware to all routes
router.use(authenticate);

// REST APIs
router.get('/accounts', GoogleWarmingController.getAccounts);
router.post('/accounts/import', GoogleWarmingController.importAccounts);
router.post('/accounts/ai-parse', GoogleWarmingController.aiParse);
router.post('/accounts/batch-warm', GoogleWarmingController.batchWarmAccounts);
router.post('/accounts/batch-delete', GoogleWarmingController.batchDeleteAccounts);
router.post('/accounts/batch-status', GoogleWarmingController.batchStatusAccounts);
router.post('/accounts/batch-category', GoogleWarmingController.batchCategoryAccounts);
router.post('/accounts/category/rename', GoogleWarmingController.renameCategory);
router.post('/accounts/category/delete', GoogleWarmingController.deleteCategory);
router.get('/accounts/categories', GoogleWarmingController.getCategories);
router.post('/accounts/categories/add', GoogleWarmingController.addCategory);
router.put('/accounts/:id', GoogleWarmingController.updateAccount);
router.post('/accounts/:id/warm', GoogleWarmingController.warmAccount);
router.delete('/accounts/:id', GoogleWarmingController.deleteAccount);

export default router;
