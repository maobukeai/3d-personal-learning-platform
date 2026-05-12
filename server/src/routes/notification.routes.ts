import { Router } from 'express';
import * as notificationController from '../controllers/notification.controller';
import { authenticate } from '../middlewares/auth.middleware';

const router = Router();

router.use(authenticate);

router.get('/preferences', notificationController.getNotificationPreferences);
router.put('/preferences', notificationController.updateNotificationPreferences);
router.get('/', notificationController.getMyNotifications);
router.put('/read-all', notificationController.markAllAsRead);
router.put('/:id/read', notificationController.markAsRead);
router.delete('/:id', notificationController.deleteNotification);

export default router;
