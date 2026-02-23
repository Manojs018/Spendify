/**
 * ================================================================
 *  authSecurityTests.js  —  Auth Rate Limiting & Sign-Up Fix
 *  Run: node server/tests/authSecurityTests.js
 *  Requires Node 18+ (built-in fetch)
 * ================================================================
 */

const BASE = 'http://localhost:5000/api';
const TS = Date.now();
const BYPASS_HEADER = { 'X-Test-Bypass': 'spendify-dev-test-bypass' };

let passed = 0, failed = 0;

function assert(ok, name, detail = '') {
    if (ok) { console.log(`  ✅ PASS: ${name}`); passed++; }
    else { console.error(`  ❌ FAIL: ${name}${detail ? ' — ' + detail : ''}`); failed++; }
}

// ── HTTP helpers ────────────────────────────────────────────────
async function post(path, body, extraHeaders = {}) {
    const r = await fetch(`${BASE}${path}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...extraHeaders },
        body: JSON.stringify(body),
    });
    return { status: r.status, data: await r.json() };
}

// Bypass IP rate limiting (dev only) – tests account-level logic cleanly
async function postBypass(path, body) {
    return post(path, body, BYPASS_HEADER);
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

let seq = 0;
function email(tag = '') { return `sec_${TS}_${++seq}${tag}@test.dev`; }

const STRONG = 'T3st!ngP@ss#99';   // satisfies all OWASP rules


// ================================================================
async function runTests() {
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║  AUTH SECURITY — RATE LIMITING & SIGN-UP TEST SUITE  ║');
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    // ── SECTION 1: Sign-Up End-to-End ───────────────────────────
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 1: Issue 2 — Sign-Up Works End-to-End');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const regEmail = email('_reg');

    // 1a. Successful registration
    {
        const { status, data } = await postBypass('/auth/register', {
            name: 'Sign Up Test', email: regEmail, password: STRONG,
        });
        assert(status === 201, 'TC1a — Register returns HTTP 201');
        assert(data.success === true, 'TC1a — success:true');
        assert(!!data.data?.token, 'TC1a — JWT token returned');
        assert(data.data?.user?.email === regEmail, 'TC1a — Correct email in response');
        assert(!!data.data?.user?.id, 'TC1a — User ID present');
    }

    // 1b. Duplicate email rejected
    {
        const { status, data } = await postBypass('/auth/register', {
            name: 'Dup', email: regEmail, password: STRONG,
        });
        assert(status === 400, 'TC1b — Duplicate email → 400');
        assert(data.success === false, 'TC1b — success:false');
    }

    // 1c. Missing fields rejected
    {
        const { status } = await postBypass('/auth/register', { email: email() });
        assert(status === 400, 'TC1c — Missing fields → 400');
    }

    // 1d. Weak password rejected (clear via bypass so the rate limiter doesn't interfere)
    {
        const { status, data } = await postBypass('/auth/register', {
            name: 'Weak', email: email('_weak'), password: 'weakpass',
        });
        assert(status === 400, 'TC1d — Weak password → 400');
        assert(data.success === false, 'TC1d — success:false');
        assert(!!data.message, 'TC1d — Error message present');
    }

    // 1e. Login with the registered account works
    {
        const { status, data } = await postBypass('/auth/login', {
            email: regEmail, password: STRONG,
        });
        assert(status === 200, 'TC1e — Login after register → 200');
        assert(data.success === true, 'TC1e — success:true');
        assert(!!data.data?.token, 'TC1e — Token returned on login');
    }

    // ── SECTION 2: Account Lockout After 5 Failed Attempts ──────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 2: Account Locks After 5 Failed Login Attempts');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const lockEmail = email('_lock');
    await postBypass('/auth/register', { name: 'Lock Test', email: lockEmail, password: STRONG });
    await sleep(300);

    // 5 wrong-password attempts (bypass IP rate limit to isolate account lockout)
    for (let i = 1; i <= 5; i++) {
        const { status, data } = await postBypass('/auth/login', {
            email: lockEmail, password: 'WrongPass#999',
        });

        if (i < 5) {
            assert(status === 401, `TC2.${i} — Attempt ${i}: 401 returned`);
            assert(data.success === false, `TC2.${i} — success:false`);
            assert(typeof data.attemptsLeft === 'number', `TC2.${i} — attemptsLeft present (got ${data.attemptsLeft})`);
            const expected = 5 - i;
            assert(data.attemptsLeft === expected, `TC2.${i} — attemptsLeft=${expected} (got ${data.attemptsLeft})`);
        }
        await sleep(120);
    }

    // 6th attempt — account should now be locked (423)
    const { status: lockedStatus, data: lockedData } = await postBypass('/auth/login', {
        email: lockEmail, password: 'WrongPass#999',
    });
    assert(lockedStatus === 423, 'TC2.6 — 6th attempt: account locked (HTTP 423)');
    assert(lockedData.success === false, 'TC2.6 — success:false');
    assert(!!lockedData.lockUntil, 'TC2.6 — lockUntil timestamp returned');
    assert(
        lockedData.message?.toLowerCase().includes('lock'),
        'TC2.6 — Message mentions "lock"', lockedData.message
    );

    // Correct password also blocked while locked
    const { status: correctBlocked } = await postBypass('/auth/login', {
        email: lockEmail, password: STRONG,
    });
    assert(correctBlocked === 423, 'TC2.7 — Correct password blocked while account is locked');

    // Minutes remaining shown
    assert(
        lockedData.message && /minute/i.test(lockedData.message),
        'TC2.8 — Lock message shows minutes remaining', lockedData.message
    );

    // ── SECTION 3: Successful Logins Don't Count Against Limit ──
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 3: Successful Logins Don\'t Count Against Rate Limit');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    const goodEmail = email('_good');
    await postBypass('/auth/register', { name: 'Good User', email: goodEmail, password: STRONG });
    await sleep(200);

    // 6 successful logins — all should pass (skipSuccessfulRequests:true)
    for (let i = 1; i <= 6; i++) {
        const { status } = await post('/auth/login', {   // real IP (no bypass)
            email: goodEmail, password: STRONG,
        });
        assert(status === 200, `TC3.${i} — Successful login ${i} is not rate-limited`);
        await sleep(80);
    }

    // ── SECTION 4: Login Rate-Limiter (5 bad attempts / 15 min) ─
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 4: Login Rate Limiter (5 bad attempts / 15 min per IP)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Use a real IP call (no bypass) to trigger the rate limiter
    const rlEmail = email('_rl');
    await postBypass('/auth/register', { name: 'RL Test', email: rlEmail, password: STRONG });
    await sleep(200);

    let gotRateLimit429 = false;
    for (let i = 0; i < 7; i++) {
        const { status } = await post('/auth/login', {   // real IP
            email: rlEmail, password: 'WrongPass#Bad!1',
        });
        if (status === 429) { gotRateLimit429 = true; break; }
        await sleep(60);
    }
    assert(gotRateLimit429, 'TC4.1 — Login rate limiter fires HTTP 429 after 5 failed attempts per IP');

    // Verify the 429 response structure
    const { status: s429, data: d429 } = await post('/auth/login', {
        email: rlEmail, password: 'WrongPass#Bad!1',
    });
    if (s429 === 429) {
        assert(d429.success === false, 'TC4.2 — 429 has success:false');
        assert(!!d429.message, 'TC4.2 — 429 has message field');
        assert(typeof d429.retryAfter === 'number', `TC4.2 — retryAfter present (got ${d429.retryAfter})`);
        assert(d429.retryAfter === 15, `TC4.2 — retryAfter=15 minutes (got ${d429.retryAfter})`);
        assert(
            d429.message.toLowerCase().includes('too many') ||
            d429.message.toLowerCase().includes('15 minutes'),
            'TC4.2 — Message mentions rate limit', d429.message
        );
    }

    // ── SECTION 5: Register Rate-Limiter (3 per hour) ───────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 5: Register Rate Limiter (3 per hour per IP)');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // Fire real-IP registrations until 429
    let gotRegLimit = false;
    for (let i = 0; i < 10; i++) {
        const { status } = await post('/auth/register', {   // real IP
            name: 'RL Reg', email: email('_rlreg'), password: STRONG,
        });
        if (status === 429) { gotRegLimit = true; break; }
        await sleep(50);
    }
    assert(gotRegLimit, 'TC5.1 — Registration rate limiter fires (HTTP 429) after 3 per hour');

    // Response structure check
    const { status: rs, data: rd } = await post('/auth/register', {
        name: 'RL Reg X', email: email('_rlregx'), password: STRONG,
    });
    if (rs === 429) {
        assert(rd.success === false, 'TC5.2 — Register 429 has success:false');
        assert(!!rd.message, 'TC5.2 — Register 429 has message field');
        assert(
            rd.message.toLowerCase().includes('too many') ||
            rd.message.toLowerCase().includes('hour'),
            'TC5.2 — Message mentions rate limit / hour', rd.message
        );
        assert(rd.retryAfter === 60, `TC5.2 — retryAfter=60 minutes (got ${rd.retryAfter})`);
    }

    // ── SECTION 6: Error Message Quality ────────────────────────
    console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  SECTION 6: Clear Error Messages');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // 6.1 Locked account message includes time remaining
    const { data: lkMsg } = await postBypass('/auth/login', {
        email: lockEmail, password: STRONG,
    });
    assert(
        lkMsg.message && /minute/i.test(lkMsg.message),
        'TC6.1 — Locked account message shows minutes remaining', lkMsg.message
    );

    // 6.2 Wrong password with counter
    const freshEmail = email('_fresh');
    await postBypass('/auth/register', { name: 'Fresh', email: freshEmail, password: STRONG });
    await sleep(150);
    const { data: wr1 } = await postBypass('/auth/login', {
        email: freshEmail, password: 'WrongPass#Fail1',
    });
    assert(
        wr1.message && /attempt/i.test(wr1.message),
        'TC6.2 — Wrong-password message mentions "attempt"', wr1.message
    );
    assert(
        typeof wr1.attemptsLeft === 'number',
        `TC6.3 — attemptsLeft is a number (got ${wr1.attemptsLeft})`
    );
    assert(
        wr1.attemptsLeft === 4,
        `TC6.4 — attemptsLeft=4 after 1st failure (got ${wr1.attemptsLeft})`
    );

    // 6.3 Rate-limit message is human friendly
    const { data: rlMsg } = await post('/auth/login', {
        email: goodEmail, password: 'WrongPass#Trigger',
    });
    if (rlMsg.success === false) {
        assert(!!rlMsg.message, 'TC6.5 — All error responses include a message field');
    }

    // ── Summary ──────────────────────────────────────────────────
    const total = passed + failed;
    console.log('\n╔═══════════════════════════════════════════════════════╗');
    console.log('║                    TEST SUMMARY                       ║');
    console.log('╠═══════════════════════════════════════════════════════╣');
    console.log(`║  Total   : ${String(total).padEnd(43)}║`);
    console.log(`║  Passed  : ${String(passed).padEnd(43)}║`);
    console.log(`║  Failed  : ${String(failed).padEnd(43)}║`);
    console.log(`║  Score   : ${((passed / total) * 100).toFixed(1).padEnd(42)}%║`);
    console.log('╚═══════════════════════════════════════════════════════╝\n');

    if (failed === 0) {
        console.log('🎉  All tests passed! Both issues are fully resolved.\n');
    } else {
        console.error(`⚠️   ${failed} test(s) failed. Review output above.\n`);
        process.exit(1);
    }
}

runTests().catch(e => { console.error('Runner crashed:', e.message); process.exit(1); });
