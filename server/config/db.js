import mongoose from 'mongoose';

/**
 * Global variable to cache the database connection across serverless invocations.
 */
let cachedConnection = null;

const connectDB = async () => {
    // If already connected or connecting, return the existing connection
    if (mongoose.connection.readyState >= 1) {
        return mongoose.connection;
    }

    try {
        if (!process.env.MONGODB_URI) {
            console.error('❌ Error: MONGODB_URI environment variable is missing.');
            if (!process.env.VERCEL) {
                process.exit(1);
            }
            throw new Error('MONGODB_URI is required');
        }

        // Connection options optimized for serverless
        const options = {
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            bufferCommands: true, // Allow Mongoose to buffer commands while connecting
        };

        console.log('🔄 Attempting to connect to MongoDB...');
        
        const conn = await mongoose.connect(process.env.MONGODB_URI, options);
        
        cachedConnection = conn;
        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        console.log(`📊 Database: ${conn.connection.name}`);
        
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        if (!process.env.VERCEL) {
            process.exit(1);
        }
        throw error;
    }
};

// Handle connection events
mongoose.connection.on('connected', () => {
    console.log('🔗 Mongoose connected to MongoDB');
});

mongoose.connection.on('error', (err) => {
    console.error(`🔴 Mongoose connection error: ${err}`);
});

mongoose.connection.on('disconnected', () => {
    console.log('🔌 Mongoose disconnected from MongoDB');
    cachedConnection = null;
});

// Graceful shutdown
if (process.env.NODE_ENV !== 'production' || !process.env.VERCEL) {
    process.on('SIGINT', async () => {
        await mongoose.connection.close();
        console.log('🛑 Mongoose connection closed due to app termination');
        process.exit(0);
    });
}

export default connectDB;
