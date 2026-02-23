import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema(
    {
        name: {
            type: String,
            required: [true, 'Please provide a name'],
            trim: true,
            maxlength: [50, 'Name cannot be more than 50 characters'],
        },
        email: {
            type: String,
            required: [true, 'Please provide an email'],
            unique: true,
            lowercase: true,
            trim: true,
            match: [
                /^\w+([\.-]?\w+)*@\w+([\.-]?\w+)*(\.\w{2,3})+$/,
                'Please provide a valid email',
            ],
        },
        password: {
            type: String,
            required: [true, 'Please provide a password'],
            minlength: [12, 'Password must be at least 12 characters'],
            validate: {
                validator: function (value) {
                    // Skip validation if password is already hashed (bcrypt hash starts with $2)
                    if (value && value.startsWith('$2')) return true;
                    return (
                        /[A-Z]/.test(value) &&   // uppercase
                        /[a-z]/.test(value) &&   // lowercase
                        /[0-9]/.test(value) &&   // number
                        /[^A-Za-z0-9]/.test(value) // special character
                    );
                },
                message:
                    'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character',
            },
            select: false,
        },
        balance: {
            type: Number,
            default: 0,
        },

        // ── Account Lockout (brute-force protection) ──────────────
        failedLoginAttempts: {
            type: Number,
            default: 0,
            select: false,
        },
        lockUntil: {
            type: Date,
            default: null,
            select: false,
        },
    },
    {
        timestamps: true,
    }
);

// ── Virtual: is the account currently locked? ─────────────────────
userSchema.virtual('isLocked').get(function () {
    return this.lockUntil && this.lockUntil > Date.now();
});

// ── Hash password before saving ───────────────────────────────────
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        return next();           // ← return is essential to avoid double-call
    }
    const salt = await bcrypt.genSalt(12);   // cost factor 12 (OWASP recommended)
    this.password = await bcrypt.hash(this.password, salt);
    return next();
});

// ── Compare plain-text password against stored hash ───────────────
userSchema.methods.comparePassword = async function (enteredPassword) {
    return bcrypt.compare(enteredPassword, this.password);
};

// ── Record a failed login attempt; lock after 5 failures ─────────
userSchema.methods.incFailedAttempts = async function () {
    const MAX_ATTEMPTS = 5;
    const LOCK_DURATION = 15 * 60 * 1000; // 15 minutes in ms

    // If a previous lock has expired, reset and start fresh
    if (this.lockUntil && this.lockUntil < Date.now()) {
        return this.updateOne({
            $set: { failedLoginAttempts: 1, lockUntil: null },
        });
    }

    const updates = { $inc: { failedLoginAttempts: 1 } };

    // Lock the account once the threshold is reached
    if (this.failedLoginAttempts + 1 >= MAX_ATTEMPTS) {
        updates.$set = { lockUntil: new Date(Date.now() + LOCK_DURATION) };
    }

    return this.updateOne(updates);
};

// ── Reset failed attempts after a successful login ────────────────
userSchema.methods.resetFailedAttempts = async function () {
    return this.updateOne({
        $set: { failedLoginAttempts: 0, lockUntil: null },
    });
};

// ── Strip password + lockout fields from JSON responses ──────────
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    delete obj.failedLoginAttempts;
    delete obj.lockUntil;
    return obj;
};

const User = mongoose.model('User', userSchema);
export default User;
