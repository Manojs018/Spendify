import express from 'express';
import {
    getMonthlyAnalytics,
    getCategoryAnalytics,
    getTrends,
    getDashboardSummary,
} from '../controllers/analyticsController.js';
import { protect } from '../middleware/auth.js';

import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.get('/monthly', cacheMiddleware('analytics'), getMonthlyAnalytics);
router.get('/category', cacheMiddleware('analytics'), getCategoryAnalytics);
router.get('/trends', cacheMiddleware('analytics'), getTrends);
router.get('/summary', cacheMiddleware('analytics'), getDashboardSummary);

export default router;
