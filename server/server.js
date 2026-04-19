import './instrument.js';
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRedis } from './config/redis.js';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import * as Sentry from '@sentry/node';
import logger from './utils/logger.js';
import connectDB from './config/db.js';
import errorHandler from './middleware/errorHandler.js';
import { sanitizeBody } from './middleware/sanitize.js';
import { csrfProtection } from './middleware/csrf.js';
import authRoutes from './routes/authRoutes.js';
import transactionRoutes from './routes/transactionRoutes.js';
import cardRoutes from './routes/cardRoutes.js';
import analyticsRoutes from './routes/analyticsRoutes.js';
import transferRoutes from './routes/transferRoutes.js';
import csrfRoutes from './routes/csrfRoutes.js';
import cookieParser from 'cookie-parser';
import passport from './middleware/passport.js';
import { startCronJobs } from './utils/cronJob.js';
import recurringTransactionRoutes from './routes/recurringTransactionRoutes.js';
import budgetRoutes from './routes/budgetRoutes.js';

// Load env vars
dotenv.config();

// Graceful check for critical environment variables
if (!process.env.JWT_SECRET && process.env.NODE_ENV === 'production') {
    logger.error('⚠️ CRITICAL: JWT_SECRET is missing from environment variables. Authentication will fail.');
}

const app = express();

// Trust proxy to ensure correct IP routing in deployments
app.set('trust proxy', 1);

// Security middleware
app.use(helmet());

// CORS
const allowedOrigins = [
    process.env.CLIENT_URL || 'http://localhost:3000',
    'http://localhost:3000',
    'http://127.0.0.1:3000',
    'http://localhost:5000',
    'http://127.0.0.1:5000'
];

app.use(
    cors({
        origin: function (origin, callback) {
            // Allow requests with no origin (like mobile apps or curl)
            if (!origin) return callback(null, true);
            if (allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
                callback(null, true);
            } else {
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true,
    })
);

// Body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Cookie parser for reading tokens
app.use(cookieParser());

// Input sanitization – XSS & NoSQL injection protection (applied globally)
app.use(sanitizeBody);

// CSRF Protection
app.use(csrfProtection);

// Initialize Passport
app.use(passport.initialize());

// Logging middleware map morgan to winston
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined', {
    stream: { write: message => logger.info(message.trim()) }
}));

// Rate limiting
const TEST_BYPASS_SECRET = process.env.TEST_BYPASS_SECRET || 'spendify-dev-test-bypass';
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
    message: 'Too many requests from this IP, please try again later.',
    skip: (req) => process.env.NODE_ENV === 'development' &&
        req.headers['x-test-bypass'] === TEST_BYPASS_SECRET,
});

app.use('/api/', limiter);

// Database middleware to ensure connection is ready for each API call (Production/Vercel only)
if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
    app.use('/api', async (req, res, next) => {
        try {
            await connectDB();
            next();
        } catch (error) {
            logger.error('Database connection failed during request:', { error: error.message });
            res.status(503).json({
                success: false,
                message: 'Service temporarily unavailable. Database connection issue.',
            });
        }
    });
}

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({
        success: true,
        message: 'Server is running',
        timestamp: new Date().toISOString(),
    });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/cards', cardRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api/transfer', transferRoutes);
app.use('/api/recurring-transactions', recurringTransactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/csrf-token', csrfRoutes);

// Welcome route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: '🟦 Welcome to Spendify API',
        tagline: 'Smart Spending. Clear Insights.',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            auth: '/api/auth',
            csrfToken: '/api/csrf-token',
            transactions: '/api/transactions',
            cards: '/api/cards',
            analytics: '/api/analytics',
            transfer: '/api/transfer',
        },
    });
});

// Serve frontend static files
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(express.static(path.join(__dirname, '../client')));

// Catch-all for SPA (return index.html for non-API routes)
app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) {
        return next();
    }
    res.sendFile(path.resolve(__dirname, '../client', 'index.html'));
});

// Catch errors before our custom error handler
Sentry.setupExpressErrorHandler(app);

// Error handler (must be last)
app.use(errorHandler);

export default app;

const PORT = process.env.PORT || 5000;
let server;

// Start server
const startServer = async () => {
    try {
        // Connect to Database first
        await connectDB();

        // Only initialize Redis if connection string exists
        if (process.env.REDIS_URL || process.env.REDIS_HOST) {
            await initRedis();
        }

        // Start Cron Jobs (Only if not on Vercel)
        if (!process.env.VERCEL) {
           startCronJobs();
        }

        // Only listen if not being imported (e.g. not on Vercel)
        if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
            server = app.listen(PORT, () => {
                logger.info('\n╔═══════════════════════════════════════════════════════╗');
                logger.info('║                                                       ║');
                logger.info('║              🟦 SPENDIFY API SERVER                   ║');
                logger.info('║        Smart Spending. Clear Insights.                ║');
                logger.info('║                                                       ║');
                logger.info(`║  🚀 Server running on port ${PORT}                      ║`);
                logger.info(`║  🌍 Environment: ${process.env.NODE_ENV}                        ║`);
                logger.info(`║  📡 API: http://localhost:${PORT}                       ║`);
                logger.info('║                                                       ║');
                logger.info('╚═══════════════════════════════════════════════════════╝\n');
            });
        }
    } catch (error) {
        logger.error('❌ Failed to start server:', error);
        // Don't exit on Vercel
        if (!process.env.VERCEL) process.exit(1);
    }
};

startServer();

// Handle unhandled promise rejections
if (!process.env.VERCEL) {
    process.on('unhandledRejection', (err, promise) => {
        logger.error(`❌ Unhandled Rejection Error: ${err.message}`, { error: err });
        // Close server & exit process
        if (server) {
            server.close(() => process.exit(1));
        } else {
            process.exit(1);
        }
    });
}
