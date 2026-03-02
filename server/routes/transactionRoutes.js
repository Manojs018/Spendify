import express from 'express';
import {
    getTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction,
} from '../controllers/transactionController.js';
import { protect } from '../middleware/auth.js';

import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/').get(cacheMiddleware('transactions'), getTransactions).post(createTransaction);

router
    .route('/:id')
    .get(cacheMiddleware('transactions'), getTransaction)
    .put(updateTransaction)
    .delete(deleteTransaction);

export default router;
