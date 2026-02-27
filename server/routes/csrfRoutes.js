import express from 'express';
import { csrfProtection } from '../middleware/csrf.js';

const router = express.Router();

router.get('/', csrfProtection, (req, res) => {
    res.json({
        success: true,
        csrfToken: req.csrfToken, // CSRF token set by csrfProtection middleware
    });
});

export default router;
