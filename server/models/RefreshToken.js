import mongoose from 'mongoose';

const refreshTokenSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    token: {
        type: String,
        required: true,
        unique: true
    },
    expiresAt: {
        type: Date,
        required: true
    },
    fingerprint: {
        type: String,
        required: true
    },
    revokedAt: {
        type: Date,
        default: null
    }
}, { timestamps: true });

// ── Indexes ───────────────────────────────────────────────────────────────────

// TTL index – MongoDB auto-removes expired tokens (keeps the collection clean)
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0, name: 'rt_ttl' });

// Token lookup – used in refresh, logout, and validation paths
refreshTokenSchema.index({ token: 1 }, { unique: true, name: 'rt_token_unique' });

// Active-token-for-user lookup: { user, revokedAt: null } – checking existing sessions
refreshTokenSchema.index({ user: 1, revokedAt: 1 }, { name: 'rt_user_revokedAt' });

// Add a check to verify if valid
refreshTokenSchema.virtual('isValid').get(function () {
    return this.revokedAt == null && new Date() < this.expiresAt;
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
