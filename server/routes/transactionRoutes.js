import express from 'express';
import {
    getTransactions,
    getTransaction,
    createTransaction,
    updateTransaction,
    deleteTransaction,
} from '../controllers/transactionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/').get(getTransactions).post(createTransaction);

router
    .route('/:id')
    .get(getTransaction)
    .put(updateTransaction)
    .delete(deleteTransaction);

export default router;
