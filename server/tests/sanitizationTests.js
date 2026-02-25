/**
 * sanitizationTests.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Comprehensive tests verifying XSS, NoSQL injection, ReDoS, and input
 * validation protections in the Spendify API.
 *
 * Uses curl.exe (native Windows 10+) via execFileSync — no quoting issues,
 * no fetch problems, no PowerShell version constraints.
 *
 * Run:  node server/tests/sanitizationTests.js
 *       (server must be running on port 5000)
 */

import { execFileSync } from 'child_process';

const BASE = 'http://127.0.0.1:5000/api';
const BYPASS = 'spendify-dev-test-bypass';

let passed = 0;
let failed = 0;
let token = '';

// ─── HTTP via curl.exe ────────────────────────────────────────────────────────
// execFileSync with an array avoids all shell escaping / quoting issues.
// The sentinel string is injected after the response body so we can split
// the JSON body from the HTTP status code.
function req(method, path, body = null, auth = true) {
    const url = `${BASE}${path}`;

    const args = [
        '-s',                                       // silent mode
        '--max-time', '10',
        '-X', method.toUpperCase(),
        '-H', 'Content-Type: application/json',
        '-H', `X-Test-Bypass: ${BYPASS}`,
        '-w', '__SPENDIFYSTATUS__%{http_code}',     // append status AFTER body
    ];

    if (auth && token) args.push('-H', `Authorization: Bearer ${token}`);
    if (body) args.push('-d', JSON.stringify(body));
    args.push(url);

    let raw = '';
    try {
        raw = execFileSync('curl.exe', args, {
            encoding: 'utf8',
            timeout: 12000,
            windowsHide: true,
        });
    } catch (e) {
        // curl exits non-zero on connection error; stdout may still have data
        raw = String(e.stdout ?? '');
    }

    // The response looks like: <JSON body>__SPENDIFYSTATUS__200
    const SENTINEL = '__SPENDIFYSTATUS__';
    const sepIdx = raw.lastIndexOf(SENTINEL);
    const statusStr = sepIdx >= 0 ? raw.slice(sepIdx + SENTINEL.length).trim() : '0';
    const text = sepIdx >= 0 ? raw.slice(0, sepIdx) : raw;
    const sc = parseInt(statusStr, 10) || 0;

    let json = {};
    try { json = JSON.parse(text); } catch { }

    return { status: sc, body: json };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
const G = '\x1b[32m'; const R = '\x1b[31m'; const Y = '\x1b[33m';
const C = '\x1b[36m'; const B = '\x1b[1m'; const X = '\x1b[0m';

function assert(ok, label, detail = '') {
    if (ok) { console.log(`  ${G}✓${X} ${label}`); passed++; }
    else {
        console.log(`  ${R}✗${X} ${label}`);
        if (detail) console.log(`    ${Y}→ ${detail}${X}`);
        failed++;
    }
}

function section(t) { console.log(`\n${C}${B}━━━ ${t} ━━━${X}`); }

function msgHas(resp, kw) {
    const lkw = kw.toLowerCase();
    if (String(resp.body?.message ?? '').toLowerCase().includes(lkw)) return true;
    if (Array.isArray(resp.body?.errors)) {
        return resp.body.errors.some(e => String(e).toLowerCase().includes(lkw));
    }
    return false;
}

// ─── Setup ────────────────────────────────────────────────────────────────────
function setup() {
    section('Setup – create test user');
    const email = `sanitest_${Date.now()}@spendify.test`;
    const r = req('POST', '/auth/register',
        { name: 'SanitizeBot', email, password: 'SanitizeTest1!' }, false);

    if (r.status === 201) {
        token = r.body.data?.token;
        console.log(`  ${G}✓${X} Registered: ${email}`);
    } else {
        console.log(`  ${R}✗ Registration failed (${r.status}) – aborting${X}`);
        console.log(`    ${Y}${JSON.stringify(r.body)}${X}`);
        process.exit(1);
    }
}

// ─── 1. XSS Prevention ────────────────────────────────────────────────────────
function testXSS() {
    section('1. XSS Prevention');

    const payloads = [
        '<script>alert("xss")</script>',
        '<img src=x onerror=alert(1)>',
        '<svg onload=alert(1)>',
        '"><script>alert(document.cookie)</script>',
        'javascript:alert(1)',
    ];

    for (const p of payloads) {
        const r = req('POST', '/transactions',
            { amount: 10, type: 'income', category: 'Test', description: p });
        const short = p.slice(0, 50);

        if (r.status === 201) {
            const stored = String(r.body?.data?.description ?? '');
            const safe = !/<script/i.test(stored) && !/on\w+\s*=/i.test(stored);
            assert(safe, `XSS stripped from description: "${short}"`, `Stored: "${stored}"`);
            const id = r.body?.data?._id;
            if (id) req('DELETE', `/transactions/${id}`);
        } else {
            assert(r.status === 400,
                `XSS payload blocked (${r.status}): "${short}"`, JSON.stringify(r.body));
        }
    }

    // XSS in category – strict char validation rejects it
    const catR = req('POST', '/transactions',
        { amount: 10, type: 'income', category: '<script>alert(1)</script>' });
    assert(catR.status === 400, 'XSS in category field → 400', catR.body?.message);
}

// ─── 2. NoSQL Injection Prevention ────────────────────────────────────────────
function testNoSQL() {
    section('2. NoSQL Injection Prevention');

    const loginInj = req('POST', '/auth/login',
        { email: { $gt: '' }, password: 'anything' }, false);
    assert(loginInj.status === 400, 'NoSQL $gt in login email → 400',
        `Got ${loginInj.status}: ${loginInj.body?.message}`);

    const txInj = req('POST', '/transactions',
        { amount: { $gt: 0 }, type: 'income', category: 'Test' });
    assert(txInj.status === 400, 'NoSQL $gt in transaction amount → 400',
        `Got ${txInj.status}: ${txInj.body?.message}`);

    // Express parses type[$ne]=income → { type: { $ne: 'income' } }
    const qInj = req('GET', '/transactions?type[$ne]=income');
    assert(qInj.status === 400, 'NoSQL $ne in query string → 400',
        `Got ${qInj.status}: ${qInj.body?.message}`);

    const trInj = req('POST', '/transfer/send',
        { recipientEmail: { $regex: '.*' }, amount: 10 });
    assert(trInj.status === 400, 'NoSQL $regex in recipientEmail → 400',
        `Got ${trInj.status}: ${trInj.body?.message}`);

    const arrInj = req('POST', '/transactions',
        { amount: [1, 2, 3], type: 'income', category: 'Test' });
    assert(arrInj.status === 400, 'Array injected into amount → 400',
        `Got ${arrInj.status}: ${arrInj.body?.message}`);
}

// ─── 3. ReDoS Prevention ──────────────────────────────────────────────────────
function testReDoS() {
    section('3. ReDoS Prevention – responds in < 3 s');

    const patterns = ['(a+)+', '(a|aa)+', '(.*a){20}', 'a{1,30}b{1,30}c{1,30}'];
    for (const p of patterns) {
        const enc = encodeURIComponent(p);
        const start = Date.now();
        const res = req('GET', `/transactions?search=${enc}`);
        const ms = Date.now() - start;
        assert(ms < 3000 && (res.status === 200 || res.status === 400),
            `ReDoS search "${p}" → ${ms}ms`, `status=${res.status}`);
    }

    const enc = encodeURIComponent('(a+)+');
    const start = Date.now();
    const res = req('GET', `/transactions?category=${enc}`);
    const ms = Date.now() - start;
    assert(ms < 3000 && (res.status === 200 || res.status === 400),
        `ReDoS category filter → ${ms}ms`);
}

// ─── 4. Input Validation – Clear Error Messages ────────────────────────────────
function testValidation() {
    section('4. Input Validation – clear error messages');

    // Transaction body
    const txCases = [
        [{ type: 'income', category: 'Food' }, 'amount', 'Missing amount'],
        [{ amount: 50, type: 'transfer', category: 'Food' }, 'Type', 'Invalid type'],
        [{ amount: 50, type: 'income' }, 'Category', 'Missing category'],
        [{ amount: -5, type: 'income', category: 'Food' }, 'Amount', 'Negative amount'],
        [{ amount: 0, type: 'income', category: 'Food' }, 'Amount', 'Zero amount'],
        [{
            amount: 10, type: 'income', category: 'Food',
            description: 'x'.repeat(201)
        }, '200', 'Desc > 200 chars'],
        [{ amount: 10, type: 'income', category: 'Food<br>' }, 'invalid', 'Category with HTML'],
        [{ amount: 10, type: 'income', category: 'Food', date: 'nope' }, 'Date', 'Invalid date'],
    ];
    for (const [body, kw, label] of txCases) {
        const r = req('POST', '/transactions', body);
        assert(r.status === 400 && msgHas(r, kw),
            `${label} → 400 + "${kw}"`, `Got ${r.status}: "${r.body?.message}"`);
    }

    // Query params
    const qCases = [
        ['/transactions?sort=__proto__', 'Sort', 'Prototype-polluting sort'],
        ['/transactions?page=-1', 'Page', 'Negative page'],
        ['/transactions?limit=999', 'Limit', 'Limit > 100'],
        ['/transactions?month=13&year=2024', 'Month', 'Month out of range'],
        ['/transactions?year=1999', 'Year', 'Year out of range'],
    ];
    for (const [path, kw, label] of qCases) {
        const r = req('GET', path);
        assert(r.status === 400 && msgHas(r, kw),
            `${label} → 400 + "${kw}"`, `Got ${r.status}: "${r.body?.message}"`);
    }

    // Transfer body
    const trCases = [
        [{ amount: 10 }, 'email', 'Missing email'],
        [{ recipientEmail: 'not-an-email', amount: 10 }, 'email', 'Invalid email format'],
        [{ recipientEmail: 'a@b.com' }, 'Amount', 'Missing amount'],
        [{ recipientEmail: 'a@b.com', amount: -50 }, 'Amount', 'Negative amount'],
        [{
            recipientEmail: 'a@b.com', amount: 10,
            description: 'y'.repeat(201)
        }, '200', 'Desc > 200 chars'],
    ];
    for (const [body, kw, label] of trCases) {
        const r = req('POST', '/transfer/send', body);
        assert(r.status === 400 && msgHas(r, kw),
            `Transfer: ${label} → 400 + "${kw}"`, `Got ${r.status}: "${r.body?.message}"`);
    }

    const noEmail = req('GET', '/transfer/search');
    assert(noEmail.status === 400, 'Transfer search: no email → 400', noEmail.body?.message);

    const longEmail = req('GET', `/transfer/search?email=${'a'.repeat(101)}`);
    assert(longEmail.status === 400, 'Transfer search: 101-char email → 400', longEmail.body?.message);
}

// ─── 5. Clean Inputs Pass Through ─────────────────────────────────────────────
function testCleanInputs() {
    section('5. Clean inputs pass through correctly');

    const ids = [];
    const now = new Date().toISOString();

    const c1 = req('POST', '/transactions',
        {
            amount: 42.50, type: 'income', category: 'Salary',
            description: 'Monthly salary Q1-2024', date: now
        });
    assert(c1.status === 201, 'Valid income transaction → 201', JSON.stringify(c1.body));
    if (c1.status === 201) ids.push(c1.body.data._id);

    const c2 = req('POST', '/transactions',
        {
            amount: 15.00, type: 'expense', category: 'Food',
            description: 'Lunch at cafe'
        });
    assert(c2.status === 201, 'Valid expense transaction → 201', c2.body?.message);
    if (c2.status === 201) ids.push(c2.body.data._id);

    const list = req('GET', '/transactions?type=expense&page=1&limit=10&sort=-date');
    assert(list.status === 200, 'GET /transactions valid params → 200');

    const srch = req('GET', '/transactions?search=Lunch');
    assert(srch.status === 200, 'Search "Lunch" → 200');

    const catF = req('GET', '/transactions?category=Salary');
    assert(catF.status === 200, 'Category filter "Salary" → 200');

    const d = new Date();
    const dated = req('GET', `/transactions?year=${d.getFullYear()}&month=${d.getMonth() + 1}`);
    assert(dated.status === 200, 'Date filter (year + month) → 200');

    for (const id of ids) req('DELETE', `/transactions/${id}`);
}

// ─── 6. XSS in Auth Fields ────────────────────────────────────────────────────
function testXSSAuth() {
    section('6. XSS in Auth Fields');

    const xssName = '<script>alert("xss")</script>';
    const xssReg = req('POST', '/auth/register', {
        name: xssName,
        email: `xss_${Date.now()}@test.com`,
        password: 'ValidPass1!Ab',
    }, false);

    if (xssReg.status === 201) {
        const stored = String(xssReg.body?.data?.user?.name ?? '');
        assert(!/<script/i.test(stored),
            'XSS stripped from user name on register', `Stored: "${stored}"`);
    } else {
        assert(xssReg.status === 400,
            'XSS name rejected on register → 400', xssReg.body?.message);
    }

    const loginXss = req('POST', '/auth/login', {
        email: '<script>alert(1)</script>@evil.com',
        password: 'anything',
    }, false);
    assert(loginXss.status === 400 || loginXss.status === 401,
        `XSS in login email handled safely (${loginXss.status}, not 500)`,
        loginXss.body?.message);
}

// ─── Runner ───────────────────────────────────────────────────────────────────
console.log(`\n${B}${C}╔════════════════════════════════════════════════════╗${X}`);
console.log(`${B}${C}║     SPENDIFY – INPUT SANITIZATION TEST SUITE       ║${X}`);
console.log(`${B}${C}╚════════════════════════════════════════════════════╝${X}`);
console.log(`Server: ${BASE}\n`);

try {
    setup();
    testXSS();
    testNoSQL();
    testReDoS();
    testValidation();
    testCleanInputs();
    testXSSAuth();
} catch (e) {
    console.error(`\n${R}Unexpected error:${X}`, e.message);
}

const total = passed + failed;
console.log(`\n${B}${C}━━━ RESULTS ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${X}`);
console.log(`  Total  : ${total}`);
console.log(`  ${G}Passed : ${passed}${X}`);
console.log(`  ${failed > 0 ? R : G}Failed : ${failed}${X}`);

if (failed === 0) {
    console.log(`\n${G}${B}🎉  ALL ${total} TESTS PASSED – Input sanitization is SOLID!${X}\n`);
} else {
    console.log(`\n${R}${B}⚠  ${failed} test(s) failed – review output above.${X}\n`);
    process.exit(1);
}
