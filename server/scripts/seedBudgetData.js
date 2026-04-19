
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import User from '../models/User.js';
import Transaction from '../models/Transaction.js';
import Budget from '../models/Budget.js';

dotenv.config();

const seedData = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB');

        // Find the user (assuming test_99@example.com from subagent attempt or any first user)
        let user = await User.findOne({ email: 'test_99@example.com' });
        
        if (!user) {
            console.log('User not found, creating test user...');
            user = await User.create({
                name: 'Test User',
                email: 'test_99@example.com',
                password: 'Password123!', // Note: needs to be hashed if logic requires, but for seed we might skip or use bcrypt
                balance: 5000
            });
        }

        const userId = user._id;
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

        // Clear existing transactions for this user for a clean test
        await Transaction.deleteMany({ userId });
        await Budget.deleteMany({ userId });

        console.log('Adding income...');
        await Transaction.create({
            userId,
            amount: 5000,
            type: 'income',
            category: 'Salary',
            description: 'Monthly Salary',
            date: now
        });

        console.log('Adding expenses...');
        // Food expense: $150 (will exceed $100 budget)
        await Transaction.create({
            userId,
            amount: 150,
            type: 'expense',
            category: 'Food & Dining',
            description: 'Groceries',
            date: now
        });

        // Transport expense: $40 (will be 80% of $50 budget)
        await Transaction.create({
            userId,
            amount: 40,
            type: 'expense',
            category: 'Transportation',
            description: 'Fuel',
            date: now
        });

        // Shopping expense: $200
        await Transaction.create({
            userId,
            amount: 200,
            type: 'expense',
            category: 'Shopping',
            description: 'New Shoes',
            date: now
        });

        console.log('Setting budgets...');
        await Budget.create({
            userId,
            monthKey,
            overallLimit: 1000,
            alertThreshold: 80,
            categoryLimits: [
                { category: 'Food & Dining', limit: 100 },  // Exceeded
                { category: 'Transportation', limit: 50 },  // 80% Warning
                { category: 'Shopping', limit: 500 }        // Safe
            ]
        });

        // Update user balance
        user.balance = 5000 - (150 + 40 + 200);
        await user.save();

        console.log('Seed completed successfully!');
        process.exit();
    } catch (error) {
        console.error('Seed error:', error);
        process.exit(1);
    }
};

seedData();
