import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

passport.use(new GoogleStrategy({
    clientID: process.env.GOOGLE_CLIENT_ID || 'your-google-client-id',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'your-google-client-secret',
    callbackURL: '/api/auth/google/callback',
    passReqToCallback: true
}, async (req, accessToken, refreshToken, profile, done) => {
    try {
        const email = profile.emails[0].value;
        let user = await User.findOne({ email });

        if (user) {
            // User exists, but might not have googleId yet (signed up with email previously)
            if (!user.googleId) {
                user.googleId = profile.id;
                user.profilePicture = profile.photos && profile.photos[0] ? profile.photos[0].value : user.profilePicture;
                await user.save();
            }
            return done(null, user);
        }

        // Create new user since they don't exist
        user = await User.create({
            name: profile.displayName,
            email: email,
            googleId: profile.id,
            profilePicture: profile.photos && profile.photos[0] ? profile.photos[0].value : '',
        });

        return done(null, user);
    } catch (error) {
        return done(error, null);
    }
}));

export default passport;
