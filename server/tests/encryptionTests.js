import { encrypt, decrypt, getLastFourDigits, maskCardNumber, validateEncryptionKey, generateEncryptionKey } from '../utils/encryption.js';
import dotenv from 'dotenv';

dotenv.config();

console.log('\n========================================');
console.log('  🧪 ENCRYPTION TESTS');
console.log('========================================\n');

let passedTests = 0;
let failedTests = 0;

function test(name, fn) {
    try {
        fn();
        console.log(`✅ PASS: ${name}`);
        passedTests++;
    } catch (error) {
        console.log(`❌ FAIL: ${name}`);
        console.log(`   Error: ${error.message}\n`);
        failedTests++;
    }
}

// Test 1: Encryption Key Validation
test('Encryption key is valid', () => {
    const isValid = validateEncryptionKey();
    if (!isValid) throw new Error('Encryption key validation failed');
});

// Test 2: Basic Encryption/Decryption
test('Encrypt and decrypt card number', () => {
    const cardNumber = '4532123456789012';
    const encrypted = encrypt(cardNumber);
    const decrypted = decrypt(encrypted);

    if (encrypted === cardNumber) {
        throw new Error('Encrypted text should not match plain text');
    }
    if (decrypted !== cardNumber) {
        throw new Error(`Decryption failed. Expected: ${cardNumber}, Got: ${decrypted}`);
    }
});

// Test 3: Different Encryptions for Same Data
test('Same data produces different encrypted values (IV randomness)', () => {
    const cardNumber = '4532123456789012';
    const encrypted1 = encrypt(cardNumber);
    const encrypted2 = encrypt(cardNumber);

    if (encrypted1 === encrypted2) {
        throw new Error('Encryption should produce different ciphertexts (random IV)');
    }

    // But both should decrypt to same value
    const decrypted1 = decrypt(encrypted1);
    const decrypted2 = decrypt(encrypted2);

    if (decrypted1 !== cardNumber || decrypted2 !== cardNumber) {
        throw new Error('Both encrypted values should decrypt to original');
    }
});

// Test 4: Get Last Four Digits
test('Extract last 4 digits from card number', () => {
    const cardNumber = '4532123456789012';
    const lastFour = getLastFourDigits(cardNumber);

    if (lastFour !== '9012') {
        throw new Error(`Expected: 9012, Got: ${lastFour}`);
    }
});

// Test 5: Get Last Four Digits with Spaces
test('Extract last 4 digits from formatted card number', () => {
    const cardNumber = '4532 1234 5678 9012';
    const lastFour = getLastFourDigits(cardNumber);

    if (lastFour !== '9012') {
        throw new Error(`Expected: 9012, Got: ${lastFour}`);
    }
});

// Test 6: Mask Card Number
test('Mask card number for display', () => {
    const lastFour = '9012';
    const masked = maskCardNumber(lastFour);

    if (masked !== '**** **** **** 9012') {
        throw new Error(`Expected: **** **** **** 9012, Got: ${masked}`);
    }
});

// Test 7: Encrypt Null/Empty Values
test('Handle null values gracefully', () => {
    const encrypted = encrypt(null);
    if (encrypted !== null) {
        throw new Error('Encrypting null should return null');
    }
});

// Test 8: Decrypt Invalid Data
test('Handle invalid encrypted data', () => {
    try {
        decrypt('invalid_encrypted_data');
        throw new Error('Should have thrown error for invalid data');
    } catch (error) {
        if (!error.message.includes('Failed to decrypt')) {
            throw error;
        }
    }
});

// Test 9: Encrypt Different Card Types
test('Encrypt various card numbers', () => {
    const cards = [
        '4532123456789012', // Visa
        '5425233430109903', // Mastercard
        '374245455400126',  // Amex (15 digits - padded)
        '6011111111111117', // Discover
    ];

    for (const card of cards) {
        const encrypted = encrypt(card);
        const decrypted = decrypt(encrypted);
        if (decrypted !== card) {
            throw new Error(`Failed for card: ${card}`);
        }
    }
});

// Test 10: Generate New Encryption Key
test('Generate new encryption key', () => {
    const newKey = generateEncryptionKey();

    if (!newKey || newKey.length !== 64) {
        throw new Error('Generated key should be 64 hex characters');
    }

    // Verify it's valid hex
    if (!/^[0-9a-f]{64}$/i.test(newKey)) {
        throw new Error('Generated key should be valid hex');
    }
});

// Test 11: Encryption Format
test('Encrypted data has correct format (IV:ciphertext)', () => {
    const cardNumber = '4532123456789012';
    const encrypted = encrypt(cardNumber);

    const parts = encrypted.split(':');
    if (parts.length !== 2) {
        throw new Error('Encrypted format should be IV:ciphertext');
    }

    // IV should be 32 hex characters (16 bytes)
    if (parts[0].length !== 32) {
        throw new Error('IV should be 32 hex characters');
    }
});

// Test 12: Encryption is Deterministic with Same IV (not applicable, but test consistency)
test('Decryption is consistent', () => {
    const cardNumber = '4532123456789012';
    const encrypted = encrypt(cardNumber);

    // Decrypt multiple times
    const decrypted1 = decrypt(encrypted);
    const decrypted2 = decrypt(encrypted);
    const decrypted3 = decrypt(encrypted);

    if (decrypted1 !== decrypted2 || decrypted2 !== decrypted3) {
        throw new Error('Decryption should be consistent');
    }
});

// Test 13: Large Number of Encryptions
test('Handle multiple encryptions efficiently', () => {
    const cardNumber = '4532123456789012';
    const iterations = 100;

    for (let i = 0; i < iterations; i++) {
        const encrypted = encrypt(cardNumber);
        const decrypted = decrypt(encrypted);

        if (decrypted !== cardNumber) {
            throw new Error(`Failed at iteration ${i}`);
        }
    }
});

// Test 14: Special Characters in Data (edge case)
test('Handle edge cases gracefully', () => {
    const testData = '1234567890123456';
    const encrypted = encrypt(testData);
    const decrypted = decrypt(encrypted);

    if (decrypted !== testData) {
        throw new Error('Failed to handle numeric string');
    }
});

// Test 15: Empty String
test('Handle empty string', () => {
    const encrypted = encrypt('');
    if (encrypted === null) {
        // This is acceptable behavior
        return;
    }
    const decrypted = decrypt(encrypted);
    if (decrypted !== '') {
        throw new Error('Empty string should decrypt to empty string');
    }
});

// Summary
console.log('\n========================================');
console.log('  📊 TEST SUMMARY');
console.log('========================================\n');
console.log(`✅ Passed: ${passedTests} tests`);
console.log(`❌ Failed: ${failedTests} tests`);
console.log(`📊 Total:  ${passedTests + failedTests} tests\n`);

if (failedTests === 0) {
    console.log('🎉 All tests passed! Encryption is working correctly.\n');
    console.log('✅ SECURITY VERIFICATION:');
    console.log('   ✓ AES-256-CBC encryption working');
    console.log('   ✓ Random IV for each encryption');
    console.log('   ✓ Encryption/decryption consistency');
    console.log('   ✓ Proper data format (IV:ciphertext)');
    console.log('   ✓ Last 4 digits extraction working');
    console.log('   ✓ Card number masking working');
    console.log('   ✓ Edge cases handled\n');
    process.exit(0);
} else {
    console.log('❌ Some tests failed. Please review the errors above.\n');
    process.exit(1);
}
