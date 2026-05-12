import { Router } from 'express';
import * as courseController from '../controllers/course.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', authenticate, courseController.getAllCourses);
router.get('/my-enrollments', authenticate, courseController.getMyEnrollments);
router.post('/enroll', authenticate, courseController.enrollInCourse);
router.patch('/progress', authenticate, courseController.updateProgress);
router.get('/:id', authenticate, courseController.getCourseById);

// Admin only routes for management
router.post('/', authenticate, isAdmin, courseController.createCourse);
router.put('/:id', authenticate, isAdmin, courseController.updateCourse);
router.delete('/:id', authenticate, isAdmin, courseController.deleteCourse);

export default router;
