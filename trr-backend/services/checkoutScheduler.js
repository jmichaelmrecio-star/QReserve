/**
 * Automatic Checkout Scheduler
 * Runs daily to automatically mark reservations as COMPLETED after their checkout date
 * Also sends email notifications to customers
 */

const Reservation = require('../models/Reservation');
const emailService = require('../utils/emailService');

class CheckoutScheduler {
    constructor() {
        this.isRunning = false;
        this.schedulerInterval = null;
    }

    /**
     * Start the scheduler
     * Runs every 1 hour (or adjust as needed)
     */
    start() {
        if (this.isRunning) {
            console.log('⚠️ Checkout scheduler is already running');
            return;
        }

        this.isRunning = true;
        console.log('🔄 Starting automatic checkout scheduler...');

        // Run immediately on start
        this.processCheckouts();

        // Then run every hour (adjust interval as needed)
        this.schedulerInterval = setInterval(() => {
            this.processCheckouts();
        }, 60 * 60 * 1000); // 1 hour

        console.log('✅ Checkout scheduler started (runs every 1 hour)');
    }

    /**
     * Stop the scheduler
     */
    stop() {
        if (this.schedulerInterval) {
            clearInterval(this.schedulerInterval);
            this.isRunning = false;
            console.log('🛑 Checkout scheduler stopped');
        }
    }

    /**
     * Main processing function
     */
    async processCheckouts() {
        try {
            const now = new Date();
            console.log(`\n📅 Running checkout scheduler at ${now.toLocaleString()}`);

            // Find all reservations with:
            // 1. checkOutDate in the past
            // 2. Status is not already COMPLETED
            // 3. PaymentStatus is PAID or DOWNPAYMENT_PAID
            const reservationsToCheckout = await Reservation.find({
                check_out: { $lt: now },
                status: { $ne: 'COMPLETED' },
                paymentStatus: { $in: ['PAID', 'DOWNPAYMENT_PAID'] }
            });

            if (reservationsToCheckout.length === 0) {
                console.log('✓ No reservations need automatic checkout');
                return;
            }

            console.log(`\n🔍 Found ${reservationsToCheckout.length} reservation(s) needing automatic checkout:`);

            let successCount = 0;
            let failureCount = 0;

            // Process each reservation
            for (const reservation of reservationsToCheckout) {
                try {
                    // Update status to COMPLETED
                    reservation.status = 'COMPLETED';
                    await reservation.save();

                    console.log(`✅ Auto-checked out: ${reservation.reservationId} (${reservation.full_name || reservation.customer_name})`);

                    // Send notification email to customer
                    if (reservation.email) {
                        try {
                            await this.sendCheckoutNotificationEmail(reservation);
                            console.log(`📧 Notification sent to: ${reservation.email}`);
                        } catch (emailError) {
                            console.warn(`⚠️ Failed to send notification email to ${reservation.email}:`, emailError.message);
                        }
                    }

                    successCount++;
                } catch (error) {
                    console.error(`❌ Error auto-checking out ${reservation.reservationId}:`, error.message);
                    failureCount++;
                }
            }

            // Summary
            console.log(`\n📊 Checkout Scheduler Summary:`);
            console.log(`   Processed: ${successCount + failureCount}`);
            console.log(`   Successful: ${successCount}`);
            console.log(`   Failed: ${failureCount}\n`);

        } catch (error) {
            console.error('❌ Fatal error in checkout scheduler:', error);
        }
    }

    /**
     * Send checkout notification email to customer
     */
    async sendCheckoutNotificationEmail(reservation) {
        const customerName = reservation.full_name || reservation.customer_name || 'Guest';
        const checkOutDate = reservation.check_out ? new Date(reservation.check_out).toLocaleDateString() : 'N/A';
        const serviceType = reservation.serviceType || 'Service';

        const emailBody = `
            <h2>Your Reservation Has Been Completed</h2>
            <p>Hi ${customerName},</p>
            
            <p>Your reservation has been automatically marked as completed based on your checkout date.</p>
            
            <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Reservation Details:</h3>
                <p><strong>Reservation ID:</strong> ${reservation.reservationId || 'N/A'}</p>
                <p><strong>Service:</strong> ${serviceType}</p>
                <p><strong>Checkout Date:</strong> ${checkOutDate}</p>
                <p><strong>Status:</strong> Completed</p>
            </div>
            
            <p>Thank you for choosing Tito Renz Resort! We hope you had a wonderful experience.</p>
            
            <p>If you have any feedback or concerns, please don't hesitate to reach out to us:</p>
            <p>
                <strong>Contact Us:</strong><br>
                📞 0977 246 8920 or 0916 640 3411<br>
                📧 titorenznorzagaray@gmail.com
            </p>
            
            <p style="color: #999; font-size: 12px; margin-top: 30px;">
                This is an automated message from Tito Renz Resort.
            </p>
        `;

        return emailService.sendGenericEmail(
            reservation.email,
            'Reservation Completed - Tito Renz Resort',
            emailBody
        );
    }
}

// Export singleton instance
module.exports = new CheckoutScheduler();
