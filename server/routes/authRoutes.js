import express from 'express';
import passport from '../middleware/passport.js';
import { register, login, getMe, refreshToken, logout, googleAuthCallback } from '../controllers/authController.js';
import { protect } from '../middleware/auth.js';
import { loginRateLimiter, registerRateLimiter } from '../middleware/authRateLimiter.js';

const router = express.Router();

// Auth endpoints with dedicated strict rate limiters
router.post('/register', registerRateLimiter, register);
router.post('/login', loginRateLimiter, login);
router.get('/me', protect, getMe);
router.post('/refresh', refreshToken);
router.post('/logout', protect, logout);

// Google OAuth routes
router.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));
router.get('/google/callback', passport.authenticate('google', { session: false, failureRedirect: '/?error=oauth_failed' }), googleAuthCallback);

export default router;
