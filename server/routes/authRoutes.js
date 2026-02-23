import express from 'express';
import { register, login, getMe } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

// Auth endpoints with dedicated strict rate limiters
router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.get('/me', protect, getMe);

export default router;
