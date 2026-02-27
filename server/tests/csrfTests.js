import dotenv from 'dotenv';
import connectDB from '../config/db.js';
import mongoose from 'mongoose';

dotenv.config();

const API_URL = 'http://127.0.0.1:5000/api';
let xsrfToken = '';
let cookieHeader = '';

async function runTests() {
    console.log('\n========================================');
    console.log('  🧪 CSRF PROTECTION TEST');
    console.log('========================================\n');

    try {
        console.log('📡 Connecting to MongoDB...');
        await connectDB();
        console.log('✅ Connected\n');

        console.log('========================================');
        console.log('  TEST 1: CSRF Cookie Generation');
        console.log('========================================');

        // Disable bypass header to correctly test CSRF middleware
        const getRes = await fetch(`${API_URL}/auth/register`, {
            method: 'GET',
            headers: { 'X-Test-Bypass': 'invalid' } // we need a regular request! but auth/register is a POST route usually... let's hit health endpoint which is not in /api. wait /api/auth/register will 404 on GET but CSRF middleware should run first and issue cookie. Let's just hit the root / or health. Actually /api/analytics/summary without auth works for CSRF.
        });

        // We'll hit a valid route that exists to get the cookie. But /health is NOT under /api, wait, /api is rate-limited but no CSRF protection on '/'?
        // Wait, my CSRF protection in server.js was added globally: app.use(csrfProtection) after sanitizeBody.
        // Let's hit /
        const response1 = await fetch('http://127.0.0.1:5000/');
        const setCookie = response1.headers.get('set-cookie');

        if (!setCookie || !setCookie.includes('XSRF-TOKEN=')) {
            console.log('❌ FAIL: CSRF cookie not generated on safe request');
            process.exit(1);
        }

        cookieHeader = setCookie.split(';')[0];
        xsrfToken = cookieHeader.split('=')[1];

        console.log('✅ PASS: CSRF token cookie successfully injected');
        console.log(`   Token: ${xsrfToken.substring(0, 10)}...`);

        console.log('\n========================================');
        console.log('  TEST 2: Reject Missing CSRF Header');
        console.log('========================================');

        // Try to perform a state changing operation without header
        const resMissing = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
            headers: {
                'Content-Type': 'application/json',
                'Cookie': setCookie // Sending ambient cookie but no header!
            }
        });

        if (resMissing.status === 403) {
            console.log('✅ PASS: Request correctly rejected when missing X-XSRF-TOKEN header');
        } else {
            console.log(`❌ FAIL: Expected 403, got ${resMissing.status}`);
            const data = await resMissing.text();
            console.log(`   Body: ${data}`);
            process.exit(1);
        }

        console.log('\n========================================');
        console.log('  TEST 3: Accept Valid CSRF Header');
        console.log('========================================');

        // Re-attempt with header
        const resValid = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
            headers: {
                'Content-Type': 'application/json',
                'Cookie': setCookie,
                'X-XSRF-TOKEN': xsrfToken
            }
        });

        // 401 or 400 is fine, it means it bypassed CSRF and hit the authController logic
        if (resValid.status !== 403) {
            console.log('✅ PASS: Request accepted and processed when X-XSRF-TOKEN matches cookie');
        } else {
            console.log(`❌ FAIL: Expected != 403, got ${resValid.status}`);
            process.exit(1);
        }

        console.log('\n========================================');
        console.log('  TEST 4: Reject Invalid CSRF Header');
        console.log('========================================');

        const resInvalid = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            body: JSON.stringify({ email: 'test@example.com', password: 'password123' }),
            headers: {
                'Content-Type': 'application/json',
                'Cookie': setCookie,
                'X-XSRF-TOKEN': 'invalid_token_value_xyz'
            }
        });

        if (resInvalid.status === 403) {
            console.log('✅ PASS: Request rejected with mismatched CSRF token');
        } else {
            console.log(`❌ FAIL: Expected 403, got ${resInvalid.status}`);
            process.exit(1);
        }

        console.log('\n========================================');
        console.log('  📊 FINAL RESULTS');
        console.log('========================================');
        console.log('🎉 ALL CSRF TESTS PASSED!');
        console.log('\n✅ CSRF Verification Complete:');
        console.log('   ✓ Token generation strictly enforced');
        console.log('   ✓ Double-Submit Pattern working');
        console.log('   ✓ Mitigates unsafe request methods');

    } catch (error) {
        console.error('❌ Test failed with error:', error);
        process.exit(1);
    } finally {
        await mongoose.connection.close();
        console.log('\n✅ Database connection closed');
    }
}

runTests();
