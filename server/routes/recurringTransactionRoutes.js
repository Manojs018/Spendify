import express from 'express';
import {
    getRecurringTransactions,
    updateRecurringTransaction,
    deleteRecurringTransaction,
} from '../controllers/recurringTransactionController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect);

router.get('/', getRecurringTransactions);
router.route('/:id')
    .put(updateRecurringTransaction)
    .delete(deleteRecurringTransaction);

export default router;
