import express from 'express';
import {
    sendMoney,
    getTransferHistory,
    searchUsers,
} from '../controllers/transferController.js';
import { protect } from '../middleware/auth.js';

import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.post('/send', sendMoney);
router.get('/history', cacheMiddleware('transfers'), getTransferHistory);
router.get('/search', searchUsers);

export default router;
