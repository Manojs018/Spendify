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

blacklistedTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 }); // Auto-remove expired tokens

const BlacklistedToken = mongoose.model('BlacklistedToken', blacklistedTokenSchema);
export default BlacklistedToken;
