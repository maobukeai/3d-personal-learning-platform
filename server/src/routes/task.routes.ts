import { Router } from 'express';
import * as taskController from '../controllers/task.controller';
import * as taskCommentController from '../controllers/taskComment.controller';
import { authenticate } from '../middlewares/auth.middleware';
import { upload, validateFileContent } from '../middlewares/upload.middleware';

const router = Router();

router.use(authenticate);

router.post('/upload-image', upload.single('task_image'), validateFileContent, taskController.uploadImage);

router.get('/stats', taskController.getTaskStats);
router.get('/', taskController.getAllTasks);
router.post('/', taskController.createTask);
router.post('/batch', taskController.batchCreateTasks);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);

// Task comments
router.get('/:taskId/comments', taskCommentController.getTaskComments);
router.post('/:taskId/comments', taskCommentController.createTaskComment);
router.delete('/:taskId/comments/:commentId', taskCommentController.deleteTaskComment);

// Task dependencies
router.post('/:id/dependencies', taskController.addTaskDependency);
router.delete('/:id/dependencies/:dependsOnId', taskController.deleteTaskDependency);

export default router;

