import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { encrypt, getLastFourDigits } from '../utils/encryption.js';

// Load environment variables
dotenv.config();

// Old Card Schema (before encryption)
const oldCardSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    cardNumber: String,
    cardHolderName: String,
    expiry: String,
    cvv: String,
    balance: Number,
    cardType: String,
    isActive: Boolean,
}, { timestamps: true, strict: false });

const OldCard = mongoose.model('OldCard', oldCardSchema, 'cards');

// New Card Schema (with encryption)
const newCardSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    cardNumberEncrypted: String,
    lastFourDigits: String,
    cardHolderName: String,
    expiry: String,
    balance: Number,
    cardType: String,
    isActive: Boolean,
}, { timestamps: true });

const NewCard = mongoose.model('NewCard', newCardSchema, 'cards');

/**
 * Migrate existing cards to encrypted format
 */
async function migrateCards() {
    try {
        console.log('\n========================================');
        console.log('  🔐 CARD ENCRYPTION MIGRATION');
        console.log('========================================\n');

        // Connect to MongoDB
        console.log('📡 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        // Get all cards
        const cards = await OldCard.find({});
        console.log(`📊 Found ${cards.length} cards to migrate\n`);

        if (cards.length === 0) {
            console.log('✅ No cards to migrate. Database is clean.\n');
            await mongoose.connection.close();
            return;
        }

        let migrated = 0;
        let skipped = 0;
        let errors = 0;

        for (const card of cards) {
            try {
                // Check if already encrypted
                if (card.cardNumberEncrypted && card.lastFourDigits) {
                    console.log(`⏭️  Skipping card ${card._id} (already encrypted)`);
                    skipped++;
                    continue;
                }

                // Check if card has plain text card number
                if (!card.cardNumber) {
                    console.log(`⚠️  Skipping card ${card._id} (no card number found)`);
                    skipped++;
                    continue;
                }

                console.log(`🔄 Migrating card ${card._id}...`);

                // Encrypt the card number
                const encryptedNumber = encrypt(card.cardNumber);
                const lastFour = getLastFourDigits(card.cardNumber);

                // Update the card
                await OldCard.updateOne(
                    { _id: card._id },
                    {
                        $set: {
                            cardNumberEncrypted: encryptedNumber,
                            lastFourDigits: lastFour,
                        },
                        $unset: {
                            cardNumber: 1,  // Remove plain text card number
                            cvv: 1,          // Remove CVV (PCI-DSS compliance)
                        },
                    }
                );

                console.log(`✅ Migrated card ${card._id} (ending in ${lastFour})`);
                migrated++;

            } catch (error) {
                console.error(`❌ Error migrating card ${card._id}:`, error.message);
                errors++;
            }
        }

        console.log('\n========================================');
        console.log('  📊 MIGRATION SUMMARY');
        console.log('========================================\n');
        console.log(`✅ Migrated: ${migrated} cards`);
        console.log(`⏭️  Skipped:  ${skipped} cards`);
        console.log(`❌ Errors:   ${errors} cards`);
        console.log(`📊 Total:    ${cards.length} cards\n`);

        if (migrated > 0) {
            console.log('🎉 Migration completed successfully!\n');
            console.log('⚠️  IMPORTANT SECURITY NOTES:');
            console.log('   - All card numbers are now encrypted with AES-256-CBC');
            console.log('   - CVV fields have been permanently removed');
            console.log('   - Only last 4 digits are stored for display');
            console.log('   - Keep your ENCRYPTION_KEY secure!\n');
        }

        // Close connection
        await mongoose.connection.close();
        console.log('✅ Database connection closed\n');

    } catch (error) {
        console.error('\n❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run migration
migrateCards();
