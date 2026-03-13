import * as Sentry from '@sentry/node';
import dotenv from 'dotenv';
dotenv.config();

// Ensure to call this before importing any other modules!
Sentry.init({
  dsn: process.env.SENTRY_DSN || 'https://public@sentry.example.com/1', // Placeholder DSN if none provided
  tracesSampleRate: 1.0,
  profilesSampleRate: 1.0,
});
