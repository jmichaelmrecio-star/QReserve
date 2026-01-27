const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

/**
 * Contact Message Handler
 * Receives contact form submissions and sends email notifications
 * Falls back to file storage if email is not configured
 */

// Configure email transporter (using Gmail or other SMTP service)
let emailTransporter = null;
const emailConfigured = process.env.EMAIL_USER && process.env.EMAIL_PASSWORD;

if (emailConfigured) {
    emailTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD
        }
    });
} else {
    console.warn('⚠️ Email credentials not configured in .env file. Contact messages will be stored locally.');
}

/**
 * Send contact form message
 * POST /api/contact/send-message
 */
exports.sendContactMessage = async (req, res) => {
    try {
        const { name, email, phone, subject, message } = req.body;

        // Validate required fields
        if (!name || !email || !subject || !message) {
            return res.status(400).json({
                success: false,
                message: 'Please provide all required fields: name, email, subject, and message'
            });
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid email address'
            });
        }

        // Prevent spam - check message length
        if (message.length < 10 || message.length > 5000) {
            return res.status(400).json({
                success: false,
                message: 'Message must be between 10 and 5000 characters'
            });
        }

        // Simple rate limiting - check if this email has sent multiple messages recently
        // (In production, use Redis or database for proper rate limiting)
        const now = new Date();
        const recentMessages = global.recentContactMessages || [];
        global.recentContactMessages = recentMessages.filter(
            msg => (now - msg.timestamp) < 3600000 // Keep messages from last hour
        );

        const recentFromEmail = recentMessages.filter(msg => msg.email === email);
        if (recentFromEmail.length >= 5) {
            return res.status(429).json({
                success: false,
                message: 'Too many messages from this email. Please try again later.'
            });
        }

        // Log the message for rate limiting
        recentMessages.push({ email, timestamp: now });

        // Create message object
        const messageData = {
            timestamp: new Date().toISOString(),
            name,
            email,
            phone,
            subject,
            message
        };

        // Try to send email if configured, otherwise save to file
        if (emailConfigured && emailTransporter) {
            try {
                // Prepare email content
                const adminEmailContent = `
                    <h2>New Contact Form Message</h2>
                    <p><strong>From:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    ${phone ? `<p><strong>Phone:</strong> ${phone}</p>` : ''}
                    <p><strong>Subject:</strong> ${subject}</p>
                    <hr>
                    <h3>Message:</h3>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                `;

                const userEmailContent = `
                    <h2>Thank you for contacting Tito Renz Resort!</h2>
                    <p>Hi ${name},</p>
                    <p>We have received your message and will get back to you as soon as possible.</p>
                    <hr>
                    <h3>Your Message:</h3>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <p>${message.replace(/\n/g, '<br>')}</p>
                    <hr>
                    <p style="color: #999; font-size: 12px;">
                        If you have any urgent concerns, please call us at 0977 246 8920 or 0916 640 3411.
                    </p>
                `;

                // Send email to admin
                await emailTransporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: process.env.ADMIN_EMAIL || 'titorenznorzagaray@gmail.com',
                    subject: `New Contact Form: ${subject} - From ${name}`,
                    html: adminEmailContent
                });

                // Send confirmation email to user
                await emailTransporter.sendMail({
                    from: process.env.EMAIL_USER,
                    to: email,
                    subject: 'Message Received - Tito Renz Resort',
                    html: userEmailContent
                });

                console.log(`✅ Contact message sent via email from ${name} (${email}): ${subject}`);

            } catch (emailError) {
                console.warn(`⚠️ Email sending failed, saving to file instead:`, emailError.message);
                // Save to file as fallback
                saveContactMessageToFile(messageData);
            }
        } else {
            // Email not configured - save to file
            console.log(`📝 Email not configured, saving contact message to file from ${name} (${email})`);
            saveContactMessageToFile(messageData);
        }

        // Success response
        res.status(200).json({
            success: true,
            message: 'Your message has been sent successfully. We will review it and get back to you soon.'
        });

    } catch (error) {
        console.error('❌ Error processing contact message:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to send message. Please try again or contact us directly.'
        });
    }
};

/**
 * Save contact message to file as fallback
 */
function saveContactMessageToFile(messageData) {
    try {
        const uploadsDir = path.join(__dirname, '../uploads');
        const messagesDir = path.join(uploadsDir, 'contact-messages');
        
        // Ensure directories exist
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }
        if (!fs.existsSync(messagesDir)) {
            fs.mkdirSync(messagesDir, { recursive: true });
        }

        // Create filename with timestamp
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `contact-${timestamp}.json`;
        const filepath = path.join(messagesDir, filename);

        // Save to file
        fs.writeFileSync(filepath, JSON.stringify(messageData, null, 2));
        console.log(`✅ Contact message saved to: ${filename}`);
    } catch (fileError) {
        console.error('Error saving contact message to file:', fileError);
    }
}

/**
 * Health check for contact service
 * GET /api/contact/health
 */
exports.contactServiceHealth = async (req, res) => {
    try {
        if (emailConfigured && emailTransporter) {
            // Verify email transporter if configured
            await emailTransporter.verify();
            res.status(200).json({
                success: true,
                message: 'Contact service is operational (Email enabled)'
            });
        } else {
            // Email not configured but file storage works
            res.status(200).json({
                success: true,
                message: 'Contact service is operational (Using local file storage)'
            });
        }
    } catch (error) {
        console.error('Contact service health check failed:', error);
        res.status(500).json({
            success: false,
            message: 'Contact service is unavailable',
            error: error.message
        });
    }
};
