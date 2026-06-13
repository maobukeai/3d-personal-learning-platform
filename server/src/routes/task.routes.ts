import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/stats', taskController.getTaskStats);
router.get('/', taskController.getAllTasks);
router.post('/', taskController.createTask);
router.post('/batch', taskController.batchCreateTasks);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

export default router;
