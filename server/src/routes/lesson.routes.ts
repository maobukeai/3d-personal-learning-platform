import { Router } from 'express';
import * as lessonController from '../controllers/lesson.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/course/:courseId', authenticate, lessonController.getLessonsByCourse);
router.get('/:id', authenticate, lessonController.getLessonById);

// Admin only routes for management
router.post('/', authenticate, isAdmin, lessonController.createLesson);
router.put('/:id', authenticate, isAdmin, lessonController.updateLesson);
router.delete('/:id', authenticate, isAdmin, lessonController.deleteLesson);

export default router;
