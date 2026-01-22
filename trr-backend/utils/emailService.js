/**
 * Send a generic email to a recipient
 * @param {string} email - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} htmlBody - Email HTML body
 */
async function sendGenericEmail(email, subject, htmlBody) {
    const mailOptions = {
        from: 'Tito Renz Resort <support@rsfuelstation.site>',
        to: email,
        subject,
        html: htmlBody
    };
    return transporter.sendMail(mailOptions);
}

module.exports.sendGenericEmail = sendGenericEmail;
const nodemailer = require('nodemailer');

// Email configuration using the provided SMTP credentials
const transporter = nodemailer.createTransport({
    host: 'smtp.hostinger.com',
    port: 587,
    secure: false, // true for 465, false for other ports
    auth: {
        user: 'support@rsfuelstation.site',
        pass: 'W4^;31qag'
    },
    tls: {
        // Allow self-signed certificates (for development)
        rejectUnauthorized: false
    }
});

// Verify transporter configuration
transporter.verify((error, success) => {
    if (error) {
        console.error('Email transporter verification failed:', error);
    } else {
        console.log('Email server is ready to send messages');
    }
});

/**
 * Send verification email to user
 * @param {string} email - Recipient email address
 * @param {string} verificationToken - Unique verification token
 * @param {string} userName - User's full name
 * @returns {Promise} - Promise resolving to email send status
 */
async function sendVerificationEmail(email, verificationToken, userName) {
    const verificationLink = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/verify-email.html?token=${verificationToken}`;
    
    const mailOptions = {
        from: '"Tito Renz Resort" <support@rsfuelstation.site>',
        to: email,
        subject: 'Verify Your Email - Tito Renz Resort',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .button { display: inline-block; padding: 12px 30px; background: #667eea; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; font-weight: bold; }
                    .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Welcome to Tito Renz Resort!</h1>
                    </div>
                    <div class="content">
                        <h2>Hi ${userName},</h2>
                        <p style="color: white;">Thank you for registering with Tito Renz Resort. To complete your registration and activate your account, please verify your email address by clicking the button below:</p>
                        
                        <div style="text-align: center;">
                            <a href="${verificationLink}" class="button">Verify Email Address</a>
                        </div>
                        
                        <p>Or copy and paste this link into your browser:</p>
                        <p style="word-break: break-all; color: #667eea;">${verificationLink}</p>
                        
                        <p><strong>This link will expire in 24 hours.</strong></p>
                        
                        <p>If you didn't create an account with us, please ignore this email.</p>
                        
                        <p>Best regards,<br>The Tito Renz Resort Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Tito Renz Resort. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Verification email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending verification email:', error);
        throw error;
    }
}

/**
 * Send password reset email with OTP
 * @param {string} email - Recipient email address
 * @param {string} otp - One-time password
 * @param {string} userName - User's full name
 * @returns {Promise} - Promise resolving to email send status
 */
async function sendPasswordResetEmail(email, otp, userName) {
    const mailOptions = {
        from: '"Tito Renz Resort" <support@rsfuelstation.site>',
        to: email,
        subject: 'Password Reset Request - Tito Renz Resort',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .otp-box { background: white; border: 2px dashed #667eea; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px; }
                    .otp-code { font-size: 32px; font-weight: bold; color: #667eea; letter-spacing: 5px; }
                    .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Password Reset Request</h1>
                    </div>
                    <div class="content">
                        <h2>Hi ${userName},</h2>
                        <p>We received a request to reset your password for your Tito Renz Resort account.</p>
                        
                        <p>Your password reset code is:</p>
                        
                        <div class="otp-box">
                            <div class="otp-code">${otp}</div>
                        </div>
                        
                        <p><strong>This code will expire in 15 minutes.</strong></p>
                        
                        <p>If you didn't request a password reset, please ignore this email or contact our support team if you have concerns.</p>
                        
                        <p>Best regards,<br>The Tito Renz Resort Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Tito Renz Resort. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Password reset email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending password reset email:', error);
        throw error;
    }
}

/**
 * Send reservation confirmation email
 * @param {string} email - Recipient email address
 * @param {object} reservationDetails - Reservation information
 * @returns {Promise} - Promise resolving to email send status
 */
async function sendReservationConfirmation(email, reservationDetails) {
    const mailOptions = {
        from: '"Tito Renz Resort" <support@rsfuelstation.site>',
        to: email,
        subject: 'Reservation Confirmation - Tito Renz Resort',
        html: `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
                    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px; }
                    .details { background: white; padding: 15px; margin: 15px 0; border-radius: 5px; }
                    .details p { margin: 8px 0; }
                    .footer { text-align: center; margin-top: 20px; color: #888; font-size: 12px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>Reservation Confirmed!</h1>
                    </div>
                    <div class="content">
                        <h2>Thank you for your reservation!</h2>
                        <p>Your booking has been confirmed. Here are your reservation details:</p>
                        
                        <div class="details">
                            <p><strong>Reservation ID:</strong> ${reservationDetails.reservationId}</p>
                            <p><strong>Service:</strong> ${reservationDetails.serviceName}</p>
                            <p><strong>Check-in:</strong> ${reservationDetails.checkIn}</p>
                            <p><strong>Check-out:</strong> ${reservationDetails.checkOut}</p>
                            <p><strong>Guests:</strong> ${reservationDetails.guests}</p>
                            <p><strong>Total Amount:</strong> ₱${reservationDetails.totalAmount}</p>
                            <p><strong>Downpayment Paid:</strong> ₱${reservationDetails.downpayment}</p>
                        </div>
                        
                        <p>We look forward to welcoming you to Tito Renz Resort!</p>
                        
                        <p>Best regards,<br>The Tito Renz Resort Team</p>
                    </div>
                    <div class="footer">
                        <p>&copy; ${new Date().getFullYear()} Tito Renz Resort. All rights reserved.</p>
                    </div>
                </div>
            </body>
            </html>
        `
    };

    try {
        const info = await transporter.sendMail(mailOptions);
        console.log('Reservation confirmation email sent:', info.messageId);
        return { success: true, messageId: info.messageId };
    } catch (error) {
        console.error('Error sending reservation confirmation email:', error);
        throw error;
    }
}

module.exports = {
    sendVerificationEmail,
    sendPasswordResetEmail,
    sendReservationConfirmation
};
