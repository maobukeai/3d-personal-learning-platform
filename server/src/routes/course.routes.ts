import { Router } from 'express';
import * as courseController from '../controllers/course.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

router.get('/', courseController.getAllCourses);
router.get('/categories', courseController.getCourseCategories);
router.get('/my-enrollments', authenticate, courseController.getMyEnrollments);
router.post('/enroll', authenticate, courseController.enrollInCourse);
router.patch('/progress', authenticate, courseController.updateProgress);
router.post('/parse-bilibili', authenticate, isAdmin, courseController.parseBilibili);

router.get('/:id', authenticate, courseController.getCourseById);

router.post('/', authenticate, isAdmin, courseController.createCourse);
router.put('/:id', authenticate, isAdmin, courseController.updateCourse);
router.delete('/:id', authenticate, isAdmin, courseController.deleteCourse);

// Lesson progress
router.get('/:courseId/lesson-progress', authenticate, courseController.getLessonProgress);
router.patch('/lessons/:lessonId/complete', authenticate, courseController.toggleLessonComplete);

// Course reviews
router.get('/:courseId/reviews', courseController.getCourseReviews);
router.post('/reviews', authenticate, courseController.createReview);
router.put('/reviews/:id', authenticate, courseController.updateReview);
router.delete('/reviews/:id', authenticate, courseController.deleteReview);

// Course notes
router.get('/lessons/:lessonId/notes', authenticate, courseController.getLessonNotes);
router.post('/notes', authenticate, courseController.createNote);
router.put('/notes/:id', authenticate, courseController.updateNote);
router.delete('/notes/:id', authenticate, courseController.deleteNote);

export default router;
