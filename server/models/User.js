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
                    // Skip validation if password is already hashed (starts with $2)
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
            select: false, // Don\'t return password by default
        },
        balance: {
            type: Number,
            default: 0,
        },
    },
    {
        timestamps: true,
    }
);

// Hash password before saving
userSchema.pre('save', async function (next) {
    if (!this.isModified('password')) {
        next();
    }

    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

// Remove password from JSON response
userSchema.methods.toJSON = function () {
    const obj = this.toObject();
    delete obj.password;
    return obj;
};

const User = mongoose.model('User', userSchema);

export default User;
