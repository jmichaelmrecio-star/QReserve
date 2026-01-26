const Account = require('../models/Account'); 
const Role = require('../models/Role'); // NEW: For role-based redirection 
const jwt = require('jsonwebtoken'); 
const bcrypt = require('bcrypt');
const mongoose = require('mongoose'); // Included for potential ObjectId checks
const Reservation = require('../models/Reservation');
const crypto = require('crypto');
const { validatePasswordStrength } = require('../utils/passwordValidator');
const { sendVerificationEmail, sendPasswordResetEmail } = require('../utils/emailService');

// Secret key for JWT (Make sure this matches your environment variable)
const jwtSecret = process.env.JWT_SECRET || 'your_default_secret_key'; 

// Helper to split a full name into first/middle/last (best-effort)
function splitFullName(fullName = '') {
    const parts = fullName.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { first: '', middle: null, last: '' };
    if (parts.length === 1) return { first: parts[0], middle: null, last: '' };
    if (parts.length === 2) return { first: parts[0], middle: null, last: parts[1] };
    return { first: parts[0], middle: parts.slice(1, -1).join(' '), last: parts.at(-1) };
}

// --- Registration Logic (Server-Side) ---
exports.registerUser = async (req, res) => {
    try {
        // Accept both camelCase and snake_case from frontend
        const body = req.body;
        const first_name = body.first_name || body.firstName || '';
        const middle_name = body.middle_name || body.middleInitial || body.middleName || '';
        const last_name = body.last_name || body.lastName || '';
        const email = body.email || '';
        const phone = body.phone || body.contactNumber || '';
        const password = body.password || '';
        // Default to Customer ObjectId if not provided
        let role_id = body.role_id || body.roleId || '';
        if (!role_id) {
            role_id = '6911d7b841d151b05bf687c7';
        }
        const birthday = body.birthday || '';

        // Validate password strength
        const passwordValidation = validatePasswordStrength(password);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                success: false,
                message: 'Password does not meet security requirements',
                errors: passwordValidation.errors,
                warnings: passwordValidation.warnings
            });
        }

        // Check for duplicate email robustly
        let user = await Account.findOne({ email });
        if (user) {
            return res.status(400).json({ success: false, message: 'User already exists with this email address.' });
        }

        // Generate email verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        try {
            user = await Account.create({
                email,
                password: password, 
                first_name,
                middle_name: middle_name || null, 
                last_name,
                phone,
                role_id,
                birthday, // Saved as Date or null
                emailVerificationToken: verificationToken,
                emailVerificationExpires: verificationExpires
            });
        } catch (dbError) {
            // Handle duplicate key error from MongoDB
            if (dbError.code === 11000 && dbError.keyPattern && dbError.keyPattern.email) {
                return res.status(400).json({ success: false, message: 'User already exists with this email address.' });
            }
            console.error('SERVER ERROR during registration (db):', dbError);
            return res.status(500).json({ success: false, message: 'Server error during registration.', details: dbError.message });
        }

        // Send verification email
        try {
            const userName = `${first_name} ${last_name}`;
            await sendVerificationEmail(email, verificationToken, userName);
        } catch (emailError) {
            console.error('Failed to send verification email:', emailError);
            // Continue with registration even if email fails
        }

        return res.status(201).json({ 
            success: true,
            message: 'Registration successful. Please check your email to verify your account.', 
            redirect: 'login.html',
            emailSent: true
        }); 

    } catch (error) {
        console.error('SERVER ERROR during registration:', error);
        res.status(500).json({ success: false, message: 'Server error during registration.', details: error.message });
    }
};

// --- Login Logic (Server-Side) ---
exports.loginUser = async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // 1. Check if user exists and select the password field
        const user = await Account.findOne({ email }).select('+password');
        if (!user) {
            return res.status(401).json({ message: 'Invalid credentials (User not found).' });
        }

        // 2. Check if account is active
        if (user.isActive === false) {
            return res.status(403).json({ message: 'This account has been deactivated. Please contact an administrator.' });
        }

        // 3. Check password using bcrypt.compare
        const isMatch = await bcrypt.compare(password, user.password);
        
        if (!isMatch) { 
             return res.status(401).json({ message: 'Invalid credentials (Password incorrect).' });
        }

        
        // 4. Combine names correctly (Handles null/undefined middle names cleanly)
        const fullName = `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`
            .trim()
            .replace(/\s+/g, ' ');

        // ----------------------------------------------------------------------
        // Fetch the actual role name from the database (Robust Method)
        // ----------------------------------------------------------------------
        const role = await Role.findById(user.role_id);
        const userRole = role ? role.role_name : 'Customer';
        
        let redirectPath = 'customer-dashboard.html';
        if (userRole === 'Admin') {
            redirectPath = 'admin-dashboard.html';
        } else if (userRole === 'Manager') {
            redirectPath = 'manager-dashboard.html';
        }
        // ----------------------------------------------------------------------
        
        // 3. Generate token (NEW WAY: Use the calculated userRole string)
        const token = jwt.sign(
            { 
                id: user._id, 
                // CRITICAL FIX: The checkin middleware expects the role string here
                role: userRole 
            }, 
            jwtSecret, 
            { expiresIn: '1h' }
        );


        // 6. Send COMPLETE response payload to the client
        return res.status(200).json({ 
            message: 'Login successful.', 
            token, 
            role: userRole, 
            user: { 
                id: user._id, 
                full_name: fullName, 
                email: user.email, 
                phone: user.phone || 'N/A', // Ensures phone is sent
                birthday: user.birthday || '', // Include birthday
                address: user.address || '', // Include address
                role: userRole 
            },
            redirect: redirectPath
        });

    } catch (error) {
        console.error('SERVER ERROR during login:', error);
        res.status(500).json({ message: 'Server error during login.', details: error.message });
    }
};

// --- Staff Token Generation (for check-in terminal) ---
// This endpoint issues a fresh JWT token for staff check-in operations
// No authentication required - can be called by any client
exports.getStaffToken = async (req, res) => {
    try {
        // Generate a temporary staff token valid for 1 hour
        const token = jwt.sign(
            { 
                id: 'staff-check-in-system',
                role: 'Admin'  // Check-in terminal needs Admin permissions
            }, 
            jwtSecret, 
            { expiresIn: '1h' }
        );

        return res.status(200).json({
            message: 'Staff token generated successfully',
            token: token,
            expiresIn: 3600  // 1 hour in seconds
        });

    } catch (error) {
        console.error('SERVER ERROR during token generation:', error);
        res.status(500).json({ message: 'Server error generating token.', details: error.message });
    }
};

// --- Create Account (Admin) ---
exports.createAccountAsAdmin = async (req, res) => {
    try {
        const { first_name, middle_name, last_name, email, phone, password, role_id, birthday } = req.body;
        
        // Check if user already exists
        let user = await Account.findOne({ email });
        if (user) {
            return res.status(400).json({ success: false, message: 'User already exists with this email address.' });
        }

        // Validate role_id
        if (!role_id) {
            return res.status(400).json({ success: false, message: 'Role ID is required.' });
        }

        // Create new account
        user = await Account.create({
            email,
            password,
            first_name,
            middle_name: middle_name || null,
            last_name,
            phone,
            role_id,
            birthday,
            isActive: true
        });

        return res.status(201).json({ 
            success: true,
            message: 'Account created successfully.',
            user: {
                _id: user._id,
                first_name: user.first_name,
                middle_name: user.middle_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                role_id: user.role_id,
                isActive: user.isActive
            }
        });

    } catch (error) {
        console.error('Error creating account:', error);
        res.status(500).json({ success: false, message: 'Server error during account creation.', error: error.message });
    }
};

// --- Update Account (Admin) ---
exports.updateAccountAsAdmin = async (req, res) => {
    try {
        const { userId } = req.params;
        const { first_name, middle_name, last_name, email, phone, role_id, password } = req.body;

        // Find the account
        const user = await Account.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        // Update fields
        if (first_name) user.first_name = first_name;
        if (middle_name !== undefined) user.middle_name = middle_name || null;
        if (last_name) user.last_name = last_name;
        if (email) user.email = email;
        if (phone) user.phone = phone;
        if (role_id) user.role_id = role_id;
        if (password) user.password = password; // Will be hashed by pre-save hook

        await user.save();

        return res.status(200).json({ 
            success: true,
            message: 'Account updated successfully.',
            user: {
                _id: user._id,
                first_name: user.first_name,
                middle_name: user.middle_name,
                last_name: user.last_name,
                email: user.email,
                phone: user.phone,
                role_id: user.role_id,
                isActive: user.isActive
            }
        });

    } catch (error) {
        console.error('Error updating account:', error);
        res.status(500).json({ success: false, message: 'Server error during account update.', error: error.message });
    }
};

// --- Deactivate Account (Admin) ---
exports.deactivateAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await Account.findByIdAndUpdate(
            userId,
            { isActive: false },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        return res.status(200).json({ 
            success: true,
            message: 'Account deactivated successfully.',
            user
        });

    } catch (error) {
        console.error('Error deactivating account:', error);
        res.status(500).json({ success: false, message: 'Server error during deactivation.', error: error.message });
    }
};

// --- Activate Account (Admin) ---
exports.activateAccount = async (req, res) => {
    try {
        const { userId } = req.params;

        const user = await Account.findByIdAndUpdate(
            userId,
            { isActive: true },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ success: false, message: 'Account not found.' });
        }

        return res.status(200).json({ 
            success: true,
            message: 'Account activated successfully.',
            user
        });

    } catch (error) {
        console.error('Error activating account:', error);
        res.status(500).json({ success: false, message: 'Server error during activation.', error: error.message });
    }
};

// --- Get all roles ---
exports.getAllRoles = async (req, res) => {
    try {
        const Role = require('../models/Role');
        const roles = await Role.find();
        return res.status(200).json({ success: true, roles });
    } catch (error) {
        console.error('Error fetching roles:', error);
        res.status(500).json({ success: false, message: 'Server error fetching roles.', error: error.message });
    }
};

// --- Update Profile (User self-service: name/email/phone only) ---
exports.updateProfile = async (req, res) => {
    try {
        // Extract userId from JWT token (set by verifyToken middleware)
        const userId = req.user?.id;
        const { full_name, email, phone } = req.body;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Authentication required. No user ID in token.' });
        }

        const user = await Account.findById(userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Enforce unique email if changed
        if (email && email !== user.email) {
            const existing = await Account.findOne({ email });
            if (existing) {
                return res.status(400).json({ success: false, message: 'Email is already in use.' });
            }
        }

        // Update name parts from full_name (best-effort)
        if (full_name) {
            const { first, middle, last } = splitFullName(full_name);
            user.first_name = first || user.first_name;
            user.middle_name = middle;
            user.last_name = last || user.last_name;
        }

        if (email) user.email = email;
        if (phone) user.phone = phone;

        await user.save();

        // Backfill reservations to keep history visible when email changes
        if (email) {
            await Reservation.updateMany({ accountId: user._id }, { email });
        }
        if (phone) {
            await Reservation.updateMany({ accountId: user._id }, { customer_contact: phone });
        }

        const updatedFullName = `${user.first_name || ''} ${user.middle_name || ''} ${user.last_name || ''}`
            .trim()
            .replace(/\s+/g, ' ');

        return res.status(200).json({
            success: true,
            message: 'Profile updated successfully.',
            user: {
                id: user._id,
                first_name: user.first_name,
                middle_name: user.middle_name,
                last_name: user.last_name,
                full_name: updatedFullName,
                email: user.email,
                phone: user.phone
            }
        });

    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ success: false, message: 'Server error during profile update.', error: error.message });
    }
};

// --- Verify Email ---
exports.verifyEmail = async (req, res) => {
    try {
        const { token } = req.body;

        if (!token) {
            return res.status(400).json({ success: false, message: 'Verification token is required' });
        }

        const user = await Account.findOne({
            emailVerificationToken: token,
            emailVerificationExpires: { $gt: Date.now() }
        }).select('+emailVerificationToken +emailVerificationExpires');

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired verification token' 
            });
        }

        user.isEmailVerified = true;
        user.emailVerificationToken = undefined;
        user.emailVerificationExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Email verified successfully. You can now log in.',
            redirect: 'login.html'
        });

    } catch (error) {
        console.error('Error verifying email:', error);
        res.status(500).json({ success: false, message: 'Server error during email verification.', error: error.message });
    }
};

// --- Resend Verification Email ---
exports.resendVerificationEmail = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await Account.findOne({ email });
        if (!user) {
            return res.status(404).json({ success: false, message: 'Account not found' });
        }

        if (user.isEmailVerified) {
            return res.status(400).json({ success: false, message: 'Email is already verified' });
        }

        // Generate new verification token
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

        user.emailVerificationToken = verificationToken;
        user.emailVerificationExpires = verificationExpires;
        await user.save();

        // Send verification email
        const userName = `${user.first_name} ${user.last_name}`;
        await sendVerificationEmail(email, verificationToken, userName);

        return res.status(200).json({
            success: true,
            message: 'Verification email sent successfully. Please check your inbox.'
        });

    } catch (error) {
        console.error('Error resending verification email:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send verification email. Please try again later.',
            error: error.message 
        });
    }
};

// --- Request Password Reset (Send OTP) ---
exports.requestPasswordReset = async (req, res) => {
    try {
        const { email } = req.body;

        const user = await Account.findOne({ email });
        if (!user) {
            // Don't reveal that user doesn't exist for security
            return res.status(200).json({
                success: true,
                message: 'If an account exists with this email, a password reset code has been sent.'
            });
        }

        // Generate 6-digit OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString();
        const resetToken = crypto.randomBytes(32).toString('hex');
        const resetExpires = new Date(Date.now() + 15 * 60 * 1000); // 15 minutes

        user.passwordResetOTP = otp;
        user.passwordResetToken = resetToken;
        user.passwordResetExpires = resetExpires;
        await user.save();

        // Send password reset email with OTP
        const userName = `${user.first_name} ${user.last_name}`;
        await sendPasswordResetEmail(email, otp, userName);

        return res.status(200).json({
            success: true,
            message: 'Password reset code has been sent to your email.',
            resetToken: resetToken // Send to frontend to use with verify OTP
        });

    } catch (error) {
        console.error('Error requesting password reset:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to send password reset email. Please try again later.',
            error: error.message 
        });
    }
};

// --- Verify Password Reset OTP ---
exports.verifyPasswordResetOTP = async (req, res) => {
    try {
        const { email, otp, resetToken } = req.body;

        const user = await Account.findOne({
            email,
            passwordResetToken: resetToken,
            passwordResetExpires: { $gt: Date.now() }
        }).select('+passwordResetOTP +passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired reset request' 
            });
        }

        if (user.passwordResetOTP !== otp) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid OTP code' 
            });
        }

        return res.status(200).json({
            success: true,
            message: 'OTP verified successfully. You can now reset your password.'
        });

    } catch (error) {
        console.error('Error verifying OTP:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during OTP verification.',
            error: error.message 
        });
    }
};

// --- Reset Password (After OTP Verification) ---
exports.resetPassword = async (req, res) => {
    try {
        const { email, otp, resetToken, newPassword } = req.body;

        // Validate new password strength
        const passwordValidation = validatePasswordStrength(newPassword);
        if (!passwordValidation.isValid) {
            return res.status(400).json({ 
                success: false,
                message: 'New password does not meet security requirements',
                errors: passwordValidation.errors,
                warnings: passwordValidation.warnings
            });
        }

        const user = await Account.findOne({
            email,
            passwordResetToken: resetToken,
            passwordResetExpires: { $gt: Date.now() }
        }).select('+password +passwordResetOTP +passwordResetToken +passwordResetExpires');

        if (!user) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid or expired reset request' 
            });
        }

        if (user.passwordResetOTP !== otp) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid OTP code' 
            });
        }

        // Update password
        user.password = newPassword;
        user.passwordResetOTP = undefined;
        user.passwordResetToken = undefined;
        user.passwordResetExpires = undefined;
        await user.save();

        return res.status(200).json({
            success: true,
            message: 'Password reset successfully. You can now log in with your new password.',
            redirect: 'login.html'
        });

    } catch (error) {
        console.error('Error resetting password:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during password reset.',
            error: error.message 
        });
    }
};

// --- Validate Password Strength Endpoint ---
exports.validatePassword = async (req, res) => {
    try {
        const { password } = req.body;
        const validation = validatePasswordStrength(password);
        
        return res.status(200).json({
            success: true,
            validation: validation
        });

    } catch (error) {
        console.error('Error validating password:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error during password validation.',
            error: error.message 
        });
    }
};

// --- Update User Profile ---
exports.updateUserProfile = async (req, res) => {
    try {
        const { id } = req.params;
        const { email, phone, address } = req.body;
        
        // Validate required fields
        if (!email || !phone) {
            return res.status(400).json({ 
                success: false, 
                message: 'Email and phone are required.' 
            });
        }
        
        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid email format.' 
            });
        }
        
        // Validate phone (11 digits)
        if (!/^\d{11}$/.test(phone)) {
            return res.status(400).json({ 
                success: false, 
                message: 'Phone must be 11 digits.' 
            });
        }
        
        // Find and update user
        const user = await Account.findByIdAndUpdate(
            id,
            { 
                email, 
                phone, 
                address: address || null,
                updated_at: new Date()
            },
            { new: true, runValidators: true }
        );
        
        if (!user) {
            return res.status(404).json({ 
                success: false, 
                message: 'User not found.' 
            });
        }
        
        return res.status(200).json({ 
            success: true, 
            message: 'Profile updated successfully.',
            user: {
                id: user._id,
                full_name: user.first_name + (user.middle_name ? ' ' + user.middle_name : '') + ' ' + user.last_name,
                email: user.email,
                phone: user.phone,
                address: user.address || '',
                birthday: user.birthday || '',
                role: user.role_id
            }
        });
        
    } catch (error) {
        console.error('Error updating profile:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Server error updating profile.',
            details: error.message 
        });
    }
}
