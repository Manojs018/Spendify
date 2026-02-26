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

refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Add a check to verify if valid
refreshTokenSchema.virtual('isValid').get(function () {
    return this.revokedAt == null && new Date() < this.expiresAt;
});

const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
export default RefreshToken;
