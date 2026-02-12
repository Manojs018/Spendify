import express from 'express';
import {
    getMonthlyAnalytics,
    getCategoryAnalytics,
    getTrends,
    getDashboardSummary,
} from '../controllers/analyticsController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.get('/monthly', getMonthlyAnalytics);
router.get('/category', getCategoryAnalytics);
router.get('/trends', getTrends);
router.get('/summary', getDashboardSummary);

export default router;
