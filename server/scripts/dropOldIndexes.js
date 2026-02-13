import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

async function dropOldIndexes() {
    try {
        console.log('\n========================================');
        console.log('  🔧 DROPPING OLD INDEXES');
        console.log('========================================\n');

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get the cards collection
        const db = mongoose.connection.db;
        const collection = db.collection('cards');

        // Get all indexes
        const indexes = await collection.indexes();
        console.log('📊 Current indexes:');
        indexes.forEach(index => {
            console.log(`   - ${index.name}`);
        });
        console.log('');

        // Drop the old cardNumber index if it exists
        try {
            await collection.dropIndex('cardNumber_1');
            console.log('✅ Dropped cardNumber_1 index\n');
        } catch (error) {
            if (error.code === 27) {
                console.log('⏭️  cardNumber_1 index does not exist (already dropped)\n');
            } else {
                throw error;
            }
        }

        // Close connection
        await mongoose.connection.close();
        console.log('✅ Database connection closed\n');
        console.log('🎉 Old indexes dropped successfully!\n');

    } catch (error) {
        console.error('\n❌ Failed to drop indexes:', error);
        process.exit(1);
    }
}

dropOldIndexes();
