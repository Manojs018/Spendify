/**
 * syncIndexes.js
 * ─────────────────────────────────────────────────────────────────
 * Drops all non-system indexes from every Spendify collection and
 * then calls Mongoose's syncIndexes() so it rebuilds exactly the
 * indexes declared in the current schemas (compound + TTL + etc.).
 *
 * Run ONCE after deploying the updated schema files:
 *   node server/scripts/syncIndexes.js
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

// Import all models so Mongoose registers their schemas + indexes
import '../models/User.js';
import '../models/Transaction.js';
import '../models/Card.js';
import '../models/RefreshToken.js';
import '../models/BlacklistedToken.js';

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

async function syncAllIndexes() {
    header('SPENDIFY — Index Sync / Migration');

    console.log('\n📡 Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(GREEN('✅ Connected\n'));

    const models = mongoose.modelNames().map(name => mongoose.model(name));

    for (const model of models) {
        const colName = model.collection.collectionName;
        try {
            console.log(BOLD(`\n[${colName}]`));

            // List what exists now
            const before = await model.collection.indexes();
            console.log(`  Before: ${before.map(i => CYAN(i.name)).join(', ')}`);

            // syncIndexes: drops indexes not in schema, creates missing ones
            // This is safer than dropping everything manually.
            await model.syncIndexes();

            const after = await model.collection.indexes();
            console.log(`  After : ${after.map(i => GREEN(i.name)).join(', ')}`);
            console.log(`  ${GREEN('✅ Done')}`);
        } catch (err) {
            console.error(`  ${RED('❌ Failed for ' + colName + ': ' + err.message)}`);
        }
    }

    console.log(BOLD('\n\n📊 Final index listing per collection:\n'));
    for (const model of models) {
        const colName = model.collection.collectionName;
        const indexes = await model.collection.indexes();
        console.log(`  ${BOLD(colName)} (${indexes.length} index${indexes.length !== 1 ? 'es' : ''})`);
        indexes.forEach(idx => {
            const keys = JSON.stringify(idx.key);
            const extra = [
                idx.unique ? 'unique' : '',
                idx.sparse ? 'sparse' : '',
                idx.expireAfterSeconds != null ? `TTL:${idx.expireAfterSeconds}s` : '',
            ].filter(Boolean).join(', ');
            console.log(`    ${CYAN('•')} ${(idx.name || '(unnamed)').padEnd(40)} ${keys}${extra ? '  [' + extra + ']' : ''}`);
        });
    }

    await mongoose.connection.close();
    console.log(GREEN('\n✅ Index sync complete. Connection closed.\n'));
}

syncAllIndexes().catch(err => {
    console.error(RED('\n❌ Sync failed: ' + err.message));
    process.exit(1);
});
