import mongoose from 'mongoose';
import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Current encryption key
const CURRENT_KEY = process.env.ENCRYPTION_KEY;

// Function to decrypt with any key
function decryptWithKey(encryptedText, keyHex) {
    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 2) return null;

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const key = Buffer.from(keyHex, 'hex');
        const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');
        return decrypted;
    } catch (error) {
        return null;
    }
}

// Function to encrypt with current key
function encryptWithCurrentKey(text) {
    const iv = crypto.randomBytes(16);
    const key = Buffer.from(CURRENT_KEY, 'hex');
    const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    return iv.toString('hex') + ':' + encrypted;
}

async function reencryptCards() {
    try {
        console.log('\n========================================');
        console.log('  🔄 RE-ENCRYPTING CARDS');
        console.log('========================================\n');

        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB\n');

        const db = mongoose.connection.db;
        const collection = db.collection('cards');
        const cards = await collection.find({}).toArray();

        console.log(`📊 Found ${cards.length} cards\n`);

        // Try to find the old key by attempting decryption
        const possibleKeys = [
            CURRENT_KEY,
            // Add other possible keys here if needed
        ];

        for (const card of cards) {
            console.log(`🔄 Processing card ${card._id}...`);

            let decrypted = null;
            let usedKey = null;

            // Try current key first
            decrypted = decryptWithKey(card.cardNumberEncrypted, CURRENT_KEY);

            if (decrypted && /^\d{15,16}$/.test(decrypted)) {
                console.log(`✅ Card already encrypted with current key`);
                continue;
            }

            // If current key doesn't work, we need the plain text
            // For now, let's just delete these cards and let users re-add them
            console.log(`⚠️  Card encrypted with unknown key - marking for re-entry`);

            // Option: Delete the card (user will need to re-add)
            // await collection.deleteOne({ _id: card._id });
            // console.log(`❌ Deleted card ${card._id} - user needs to re-add`);
        }

        await mongoose.connection.close();
        console.log('\n✅ Process complete\n');

    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

reencryptCards();
