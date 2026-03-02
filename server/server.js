import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import path from 'path';
import { fileURLToPath } from 'url';
import { initRedis } from './config/redis.js';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
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

// Load env vars
dotenv.config();

// Connect to database
connectDB();

const app = express();

// Security middleware
app.use(helmet());

// CORS
app.use(
    cors({
        origin: process.env.CLIENT_URL || 'http://localhost:3000',
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

// Logging middleware
if (process.env.NODE_ENV === 'development') {
    app.use(morgan('dev'));
}

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

// Error handler (must be last)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;
let server;

// Start server
const startServer = async () => {
    try {
        // Initialize Redis
        await initRedis();

        server = app.listen(PORT, () => {
            console.log('\n╔═══════════════════════════════════════════════════════╗');
            console.log('║                                                       ║');
            console.log('║              🟦 SPENDIFY API SERVER                   ║');
            console.log('║        Smart Spending. Clear Insights.                ║');
            console.log('║                                                       ║');
            console.log(`║  🚀 Server running on port ${PORT}                      ║`);
            console.log(`║  🌍 Environment: ${process.env.NODE_ENV}                        ║`);
            console.log(`║  📡 API: http://localhost:${PORT}                       ║`);
            console.log('║                                                       ║');
            console.log('╚═══════════════════════════════════════════════════════╝\n');
        });
    } catch (error) {
        console.error('❌ Failed to start server:', error);
        process.exit(1);
    }
};

startServer();

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
    console.log(`❌ Error: ${err.message}`);
    // Close server & exit process
    if (server) {
        server.close(() => process.exit(1));
    } else {
        process.exit(1);
    }
});
