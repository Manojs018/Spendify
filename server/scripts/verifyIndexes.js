/**
 * verifyIndexes.js
 * ─────────────────────────────────────────────────────────────────
 * Connects to MongoDB, lists every index on every collection, then
 * runs a representative query from each controller through explain()
 * and reports whether MongoDB chose an index (IXSCAN) or fell back
 * to a full-collection scan (COLLSCAN).
 *
 * Usage:
 *   node server/scripts/verifyIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// ── Helpers ───────────────────────────────────────────────────────
const GREEN = (s) => `\x1b[32m${s}\x1b[0m`;
const RED = (s) => `\x1b[31m${s}\x1b[0m`;
const YELLOW = (s) => `\x1b[33m${s}\x1b[0m`;
const BOLD = (s) => `\x1b[1m${s}\x1b[0m`;
const CYAN = (s) => `\x1b[36m${s}\x1b[0m`;

function header(text) {
    const line = '═'.repeat(60);
    console.log(`\n${BOLD(CYAN(`╔${line}╗`))}`);
    console.log(BOLD(CYAN(`║  ${text.padEnd(58)}║`)));
    console.log(BOLD(CYAN(`╚${line}╝`)));
}

function section(text) {
    console.log(`\n${BOLD(YELLOW('▶ ' + text))}`);
}

/**
 * Run an explainable query and report whether an index was used.
 * @param {string}   label   – human-readable description
 * @param {Function} queryFn – async fn that returns explainResult
 */
async function checkExplain(label, queryFn) {
    try {
        const plan = await queryFn();

        // Mongoose explain() returns the raw MongoDB explain document.
        // The winning plan stage(s) can be nested.
        const winningPlan = plan?.queryPlanner?.winningPlan;

        // Walk stage tree to find IXSCAN or COLLSCAN
        function findStage(node, target) {
            if (!node) return false;
            if (node.stage === target) return true;
            if (node.inputStage) return findStage(node.inputStage, target);
            if (node.inputStages) return node.inputStages.some(s => findStage(s, target));
            return false;
        }

        function getIndexName(node) {
            if (!node) return null;
            if (node.stage === 'IXSCAN') return node.indexName || node.indexBounds;
            const fromInput = node.inputStage ? getIndexName(node.inputStage) : null;
            const fromInputs = node.inputStages ? node.inputStages.map(getIndexName).find(Boolean) : null;
            return fromInput || fromInputs || null;
        }

        const usesIndex = findStage(winningPlan, 'IXSCAN');
        const colScan = findStage(winningPlan, 'COLLSCAN');
        const indexName = usesIndex ? (getIndexName(winningPlan) || 'unknown') : null;

        const status = usesIndex
            ? GREEN(`✅  IXSCAN  (index: ${indexName})`)
            : colScan
                ? RED('❌  COLLSCAN  ← no suitable index')
                : YELLOW('⚠️  Other stage (check manually)');

        console.log(`   ${label.padEnd(52)} ${status}`);
    } catch (err) {
        console.log(`   ${label.padEnd(52)} ${RED('⚠️  explain() failed: ' + err.message)}`);
    }
}

// ── Main ──────────────────────────────────────────────────────────
async function run() {
    header('SPENDIFY — Index Verification Report');

    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(GREEN('✅ Connected\n'));

    const db = mongoose.connection.db;

    // ── 1. List all indexes per collection ────────────────────────
    section('STEP 1 — All Indexes in Every Collection');

    const collections = ['users', 'transactions', 'cards', 'refreshtokens', 'blacklistedtokens'];

    for (const colName of collections) {
        try {
            const col = db.collection(colName);
            const indexes = await col.indexes();
            console.log(`\n   ${BOLD(colName)} (${indexes.length} index${indexes.length !== 1 ? 'es' : ''})`);
            indexes.forEach(idx => {
                const keys = JSON.stringify(idx.key);
                const name = idx.name || '(unnamed)';
                const extra = [
                    idx.unique ? 'unique' : '',
                    idx.sparse ? 'sparse' : '',
                    idx.expireAfterSeconds != null ? `TTL:${idx.expireAfterSeconds}s` : '',
                ].filter(Boolean).join(', ');
                console.log(`       ${CYAN('•')} ${name.padEnd(36)} keys: ${keys}${extra ? '  [' + extra + ']' : ''}`);
            });
        } catch {
            console.log(`   ${colName}: ${YELLOW('collection not found (may be empty)')}`);
        }
    }

    // ── 2. explain() — common query patterns ──────────────────────
    section('STEP 2 — Query Plan Analysis (explain())');
    console.log('   (A green ✅ = index used; a red ❌ = full scan = slow query)\n');

    // We need a real userId-shaped ObjectId to build the queries;
    // we use a throwaway one — the query returns zero documents but the
    // planner still picks the optimal plan for the shape.
    const fakeUserId = new mongoose.Types.ObjectId();
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

    const txCol = db.collection('transactions');
    const userCol = db.collection('users');
    const cardCol = db.collection('cards');
    const rtCol = db.collection('refreshtokens');
    const btCol = db.collection('blacklistedtokens');

    // ── Transactions ──────────────────────────────────────────────
    await checkExplain(
        'transactions: list (userId, sort -date)',
        () => txCol.find({ userId: fakeUserId }).sort({ date: -1 }).limit(10).explain('queryPlanner'),
    );

    await checkExplain(
        'transactions: filter by type + date-desc',
        () => txCol.find({ userId: fakeUserId, type: 'expense' }).sort({ date: -1 }).explain('queryPlanner'),
    );

    await checkExplain(
        'transactions: filter by category + date-desc',
        () => txCol.find({ userId: fakeUserId, category: 'food' }).sort({ date: -1 }).explain('queryPlanner'),
    );

    await checkExplain(
        'transactions: date range (monthly analytics)',
        () => txCol.find({
            userId: fakeUserId,
            date: { $gte: startOfMonth, $lte: endOfMonth },
        }).explain('queryPlanner'),
    );

    await checkExplain(
        'transactions: type + date range (aggregate match)',
        () => txCol.find({
            userId: fakeUserId,
            type: 'expense',
            date: { $gte: startOfMonth, $lte: endOfMonth },
        }).explain('queryPlanner'),
    );

    await checkExplain(
        'transactions: sort by amount desc',
        () => txCol.find({ userId: fakeUserId }).sort({ amount: -1 }).explain('queryPlanner'),
    );

    // ── Users ─────────────────────────────────────────────────────
    await checkExplain(
        'users: findOne by email (login / register)',
        () => userCol.find({ email: 'test@example.com' }).explain('queryPlanner'),
    );

    await checkExplain(
        'users: lockUntil check (locked accounts only)',
        () => userCol.find({ lockUntil: { $exists: true, $type: 'date' } }).explain('queryPlanner'),
    );

    // ── Cards ─────────────────────────────────────────────────────
    await checkExplain(
        'cards: list active cards for user',
        () => cardCol.find({ userId: fakeUserId, isActive: true }).explain('queryPlanner'),
    );

    await checkExplain(
        'cards: lookup by lastFourDigits',
        () => cardCol.find({ userId: fakeUserId, lastFourDigits: '1234' }).explain('queryPlanner'),
    );

    await checkExplain(
        'cards: filter by cardType',
        () => cardCol.find({ userId: fakeUserId, cardType: 'visa' }).explain('queryPlanner'),
    );

    // ── RefreshTokens ─────────────────────────────────────────────
    await checkExplain(
        'refreshtokens: findOne by token (refresh/logout)',
        () => rtCol.find({ token: 'abc123' }).explain('queryPlanner'),
    );

    await checkExplain(
        'refreshtokens: active tokens for user',
        () => rtCol.find({ user: fakeUserId, revokedAt: null }).explain('queryPlanner'),
    );

    // ── BlacklistedTokens ─────────────────────────────────────────
    await checkExplain(
        'blacklistedtokens: check if token is blacklisted',
        () => btCol.find({ token: 'some.jwt.token' }).explain('queryPlanner'),
    );

    // ── Summary ───────────────────────────────────────────────────
    section('STEP 3 — Summary');
    console.log('   All indexes are defined in the Mongoose schemas and are synced');
    console.log('   to MongoDB automatically when the server starts (autoIndex: true).');
    console.log('   ✅ = IXSCAN  meaning the query hits an index (fast).');
    console.log('   ❌ = COLLSCAN meaning no index was used (slow on large collections).\n');

    await mongoose.connection.close();
    console.log(GREEN('✅ Verification complete. Connection closed.\n'));
}

run().catch(err => {
    console.error(RED('\n❌ Verification failed:'), err.message);
    process.exit(1);
});
