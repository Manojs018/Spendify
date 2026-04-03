import mongoose from 'mongoose';
import User from './server/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

const run = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/spendify');
        console.log('Connected to DB');

        await User.deleteMany({ email: 'test@example.com' });
        
        const user = await User.create({
            name: 'Test',
            email: 'test@example.com',
            password: 'Password123!'
        });
        
        console.log('Saved password in DB:', user.password); // Since select: false, might be undefined or plain text? wait, create returns the document

        const userFromDb = await User.findOne({ email: 'test@example.com' }).select('+password');
        console.log('Stored password:', userFromDb.password);
        
        const isMatch = await userFromDb.comparePassword('Password123!');
        console.log('Match?', isMatch);
        
        process.exit();
    } catch(err) {
        console.error('Error', err);
        process.exit(1);
    }
}
run();
