import { Router } from 'express';
import * as bannerController from '../controllers/banner.controller';

const router = Router();

// Public endpoint to fetch active banners
router.get('/', bannerController.getActiveBanners);

export default router;
