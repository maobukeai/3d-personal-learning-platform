import { Router } from 'express';
import * as adminController from '../controllers/admin.controller';
import { authenticate, isAdmin } from '../middlewares/auth.middleware';

const router = Router();

// Apply auth and admin middleware to all routes in this router
router.use(authenticate, isAdmin);

router.get('/stats', adminController.getAdminStats);
router.get('/settings', adminController.getSettings);
router.post('/settings', adminController.updateSettings);
router.post('/settings/test-smtp', adminController.testSmtp);

router.get('/users', adminController.getUsers);
router.put('/users/:id/role', adminController.updateUserRole);
router.delete('/users/:id', adminController.deleteUser);

router.get('/feedback', adminController.getAllFeedback);
router.put('/feedback/:id/status', adminController.updateFeedbackStatus);
router.delete('/feedback/:id', adminController.deleteFeedback);

// Roadmap management
router.get('/roadmaps', adminController.getAllRoadmaps);
router.post('/roadmaps', adminController.createRoadmap);
router.put('/roadmaps/:id', adminController.updateRoadmap);
router.delete('/roadmaps/:id', adminController.deleteRoadmap);
router.post('/roadmaps/steps', adminController.createRoadmapStep);
router.put('/roadmaps/steps/:id', adminController.updateRoadmapStep);
router.delete('/roadmaps/steps/:id', adminController.deleteRoadmapStep);

// Course management
router.get('/courses', adminController.getAllCourses);
router.post('/courses', adminController.createCourse);
router.put('/courses/:id', adminController.updateCourse);
router.delete('/courses/:id', adminController.deleteCourse);
router.post('/courses/lessons', adminController.createLesson);
router.put('/courses/lessons/:id', adminController.updateLesson);
router.delete('/courses/lessons/:id', adminController.deleteLesson);

// Team management
router.get('/teams', adminController.getAllTeams);
router.put('/teams/:teamId/members/:userId/role', adminController.updateTeamMemberRole);
router.delete('/teams/:teamId/members/:userId', adminController.removeTeamMember);

// Material audit
router.get('/materials', adminController.getAllMaterialsForAdmin);
router.put('/materials/:id/status', adminController.updateMaterialStatus);

// Showcase audit
router.get('/showcases', adminController.getAllShowcasesForAdmin);
router.put('/showcases/:id/status', adminController.updateShowcaseStatus);

// Asset management
import * as assetController from '../controllers/asset.controller';
router.get('/assets', assetController.getAllAssetsForAdmin);
router.put('/assets/:id/status', assetController.updateAssetStatus);

router.get('/broadcasts', adminController.getBroadcasts);
router.post('/broadcast', adminController.sendBroadcast);
router.delete('/broadcasts/:id', adminController.deleteBroadcast);

export default router;
