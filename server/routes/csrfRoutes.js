import express from 'express';

const router = express.Router();

router.get('/', (req, res) => {
    res.json({
        success: true,
        csrfToken: req.csrfToken || req.cookies['XSRF-TOKEN'],
    });
});

export default router;
