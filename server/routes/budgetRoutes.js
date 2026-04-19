import express from 'express';
import { protect } from '../middleware/auth.js';
import { getBudget, upsertBudget, deleteBudget } from '../controllers/budgetController.js';

const router = express.Router();

router.use(protect); // all budget routes require auth

router.get('/', getBudget);
router.post('/', upsertBudget);
router.delete('/', deleteBudget);

export default router;
