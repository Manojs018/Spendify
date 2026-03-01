import mongoose from 'mongoose';

const blacklistedTokenSchema = new mongoose.Schema({
    token: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true,
    }
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────

// Token eligibility check – every authenticated request checks this collection
blacklistedTokenSchema.index({ token: 1 }, { unique: true, name: 'bt_token_unique' });

// TTL index – auto-purge expired blacklist entries to keep the collection tiny
blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'bt_ttl' });

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
export default BlacklistedToken;
