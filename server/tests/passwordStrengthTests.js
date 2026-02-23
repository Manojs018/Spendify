/**
 * ============================================================
 *  passwordStrengthTests.js
 *  Automated test suite – OWASP Password Requirements
 * ============================================================
 *  Run with:  node server/tests/passwordStrengthTests.js
 *  Requires:  Node 18+ (uses built-in fetch)
 * ============================================================
 */

// ── Config ────────────────────────────────────────────────────
const BASE_URL = 'http://localhost:5000/api';
const TEST_EMAIL_PREFIX = `pwtest_${Date.now()}`;

// ── Helpers ───────────────────────────────────────────────────
let passed = 0;
let failed = 0;
const results = [];

function assert(condition, testName, detail = '') {
    if (condition) {
        console.log(`  ✅ PASS: ${testName}`);
        results.push({ status: 'PASS', testName });
        passed++;
    } else {
        console.error(`  ❌ FAIL: ${testName}${detail ? ' — ' + detail : ''}`);
        results.push({ status: 'FAIL', testName, detail });
        failed++;
    }
}

async function tryRegister(password, tag) {
    try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: 'Test User',
                email: `${TEST_EMAIL_PREFIX}_${tag}@test.com`,
                password,
            }),
        });
        const data = await res.json();
        return { status: res.status, data };
    } catch (err) {
        return { status: 0, error: err.message };
    }
}

// ── Test runner ───────────────────────────────────────────────
async function runTests() {
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║   OWASP PASSWORD STRENGTH – AUTOMATED TEST SUITE    ║');
    console.log('╚══════════════════════════════════════════════════════╝\n');

    // ── SECTION 1: Server-Side Validation ─────────────────────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 1: Backend API – Weak Passwords Rejected');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 1a. Too short (< 12 chars)
    {
        const { status, data } = await tryRegister('Short1!', '1a');
        assert(status === 400, 'TC1a – Short password rejected (HTTP 400)');
        assert(data.success === false, 'TC1a – success:false returned');
        assert(
            data.message && data.message.toLowerCase().includes('12'),
            'TC1a – Error mentions "12" characters',
            data.message
        );
    }

    // 1b. No uppercase
    {
        const { status, data } = await tryRegister('nouppercase123!', '1b');
        assert(status === 400, 'TC1b – No-uppercase password rejected');
        assert(data.success === false, 'TC1b – success:false returned');
        assert(
            data.message && data.message.toLowerCase().includes('uppercase'),
            'TC1b – Error mentions "uppercase"',
            data.message
        );
    }

    // 1c. No lowercase
    {
        const { status, data } = await tryRegister('NOLOWERCASE123!', '1c');
        assert(status === 400, 'TC1c – No-lowercase password rejected');
        assert(data.success === false, 'TC1c – success:false returned');
        assert(
            data.message && data.message.toLowerCase().includes('lowercase'),
            'TC1c – Error mentions "lowercase"',
            data.message
        );
    }

    // 1d. No number
    {
        const { status, data } = await tryRegister('NoNumbersHere!!!!', '1d');
        assert(status === 400, 'TC1d – No-number password rejected');
        assert(data.success === false, 'TC1d – success:false returned');
        assert(
            data.message && data.message.toLowerCase().includes('number'),
            'TC1d – Error mentions "number"',
            data.message
        );
    }

    // 1e. No special character
    {
        const { status, data } = await tryRegister('NoSpecialChar123', '1e');
        assert(status === 400, 'TC1e – No-special-char password rejected');
        assert(data.success === false, 'TC1e – success:false returned');
        assert(
            data.message && data.message.toLowerCase().includes('special'),
            'TC1e – Error mentions "special"',
            data.message
        );
    }

    // 1f. Old minimum (6 chars) – must be rejected now
    {
        const { status } = await tryRegister('Ab1!ef', '1f');
        assert(status === 400, 'TC1f – Old 6-char minimum correctly rejected');
    }

    // 1g. 11-char (one below new minimum)
    {
        const { status } = await tryRegister('Abcdef123!X', '1g');
        assert(status === 400, 'TC1g – 11-char password rejected (below 12)');
    }

    // ── SECTION 2: Strong Password Accepted ───────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 2: Backend API – Strong Passwords Accepted');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const strongPasswords = [
        { pwd: 'Str0ng!Pass#12', tag: '2a', label: 'Basic strong (14 chars)' },
        { pwd: 'MyS3cur3P@ssw0rd!', tag: '2b', label: '17-char complex' },
        { pwd: 'T3st!ngPa$$w0rd', tag: '2c', label: 'Mixed symbols' },
        { pwd: 'C0rrectHorse#Battery', tag: '2d', label: 'Passphrase style' },
    ];

    for (const { pwd, tag, label } of strongPasswords) {
        const { status, data } = await tryRegister(pwd, tag);
        assert(
            status === 201 && data.success === true,
            `TC${tag} – Strong password accepted: "${label}" (${pwd.length} chars)`,
            `HTTP ${status}: ${data?.message || ''}`
        );
    }

    // ── SECTION 3: Client-Side Regex Logic ─────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 3: Client-Side Password Regex Rules');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    function clientEvaluate(password) {
        return {
            length: password.length >= 12,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /[0-9]/.test(password),
            special: /[^A-Za-z0-9]/.test(password),
        };
    }

    const clientTests = [
        { pwd: 'short', expect: { length: false, upper: false, lower: true, number: false, special: false } },
        { pwd: 'ALLUPPERCASE123!', expect: { length: true, upper: true, lower: false, number: true, special: true } },
        { pwd: 'alllowercase123!', expect: { length: true, upper: false, lower: true, number: true, special: true } },
        { pwd: 'NoNumbers!!!here', expect: { length: true, upper: true, lower: true, number: false, special: true } },
        { pwd: 'NoSpecialChar123', expect: { length: true, upper: true, lower: true, number: true, special: false } },
        { pwd: 'Str0ng!Pass#12', expect: { length: true, upper: true, lower: true, number: true, special: true } },
    ];

    let tcIdx = 1;
    for (const { pwd, expect: exp } of clientTests) {
        const res = clientEvaluate(pwd);
        const ok = Object.keys(exp).every(k => res[k] === exp[k]);
        assert(ok, `TC3.${tcIdx} – Rule evaluation correct for: "${pwd}"`,
            !ok ? `Got ${JSON.stringify(res)}, expected ${JSON.stringify(exp)}` : '');
        tcIdx++;
    }

    // Score (0-5)
    const perfectPwd = 'Str0ng!Pass#12';
    const score = Object.values(clientEvaluate(perfectPwd)).filter(Boolean).length;
    assert(score === 5, `TC3.${tcIdx} – Perfect password scores 5/5`);

    // ── SECTION 4: Error Message Quality ──────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 4: Error-Message Acceptance Criteria');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const errorTests = [
        { pwd: 'Short1!', must: '12', label: 'Mentions 12-char minimum' },
        { pwd: 'nouppercase123!!', must: 'uppercase', label: 'Mentions uppercase requirement' },
        { pwd: 'NOLOWERCASE123!!', must: 'lowercase', label: 'Mentions lowercase requirement' },
        { pwd: 'NoNumbers!!!!here', must: 'number', label: 'Mentions number requirement' },
        { pwd: 'NoSpecialChar12345', must: 'special', label: 'Mentions special-char requirement' },
    ];

    let etIdx = 1;
    for (const { pwd, must, label } of errorTests) {
        const { data } = await tryRegister(pwd, `4_${etIdx}`);
        assert(
            data.message && data.message.toLowerCase().includes(must.toLowerCase()),
            `TC4.${etIdx} – ${label}`,
            data.message
        );
        etIdx++;
    }

    // ── Summary ────────────────────────────────────────────────
    const total = passed + failed;
    console.log('\n╔══════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                     ║');
    console.log('╠══════════════════════════════════════════════════════╣');
    console.log(`║  Total:  ${String(total).padEnd(43)}║`);
    console.log(`║  Passed: ${String(passed).padEnd(43)}║`);
    console.log(`║  Failed: ${String(failed).padEnd(43)}║`);
    console.log(`║  Score:  ${(((passed / total) * 100) || 0).toFixed(1).padEnd(42)}%║`);
    console.log('╚══════════════════════════════════════════════════════╝\n');

    if (failed === 0) {
        console.log('🎉  All tests passed! OWASP password requirements are fully enforced.\n');
    } else {
        console.error(`⚠️   ${failed} test(s) failed. Please review the output above.\n`);
        process.exit(1);
    }
}

runTests().catch(err => {
    console.error('Test runner crashed:', err.message);
    process.exit(1);
});
