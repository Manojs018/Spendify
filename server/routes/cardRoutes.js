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

import { cacheMiddleware } from '../middleware/cache.js';

const router = express.Router();

router.use(protect); // All routes are protected

router.route('/').get(cacheMiddleware('cards'), getCards).post(createCard);

router.post('/transfer', transferBetweenCards);

router
    .route('/:id')
    .get(cacheMiddleware('cards'), getCard)
    .put(updateCard)
    .delete(deleteCard);

export default router;
