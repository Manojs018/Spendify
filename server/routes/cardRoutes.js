import express from 'express';
import {
    getCards,
    getCard,
    createCard,
    updateCard,
    deleteCard,
    transferBetweenCards,
} from '../controllers/cardController.js';
import { protect } from '../middleware/auth.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/').get(getCards).post(createCard);

router.post('/transfer', transferBetweenCards);

router.route('/:id').get(getCard).put(updateCard).delete(deleteCard);

export default router;
