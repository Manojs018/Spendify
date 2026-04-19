import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.join(__dirname, '../../');
const envPath = path.join(rootDir, '.env');
const envExamplePath = path.join(rootDir, '.env.example');

console.log('Checking environment configuration...');

// Skip auto-generation on Vercel
if (process.env.VERCEL) {
    console.log('Vercel environment detected. Skipping .env auto-generation to prioritize Dashboard variables.');
    process.exit(0);
}

if (!fs.existsSync(envPath)) {
    if (fs.existsSync(envExamplePath)) {
        console.log('.env file not found. Creating from .env.example...');
        
        let envContent = fs.readFileSync(envExamplePath, 'utf8');
        
        // Generate secure random keys
        const jwtSecret = crypto.randomBytes(32).toString('hex');
        const encryptionKey = crypto.randomBytes(32).toString('hex');
        
        // Replace placeholders
        envContent = envContent.replace(
            /JWT_SECRET=<REPLACE_WITH_256_BIT_RANDOM_HEX>|JWT_SECRET=.*/g, 
            `JWT_SECRET=${jwtSecret}`
        );
        
        envContent = envContent.replace(
            /ENCRYPTION_KEY=your_32_byte_encryption_key_in_hex_format_here_64_characters|ENCRYPTION_KEY=.*/g,
            `ENCRYPTION_KEY=${encryptionKey}`
        );
        
        fs.writeFileSync(envPath, envContent);
        console.log('✅ Successfully created .env with secure auto-generated keys.');
    } else {
        console.error('❌ .env.example not found, cannot auto-generate .env');
    }
} else {
    console.log('✅ .env file already exists.');
}
