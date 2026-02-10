/**
 * Migration Script: Backfill payment amounts for existing reservations
 * 
 * This script updates existing reservations to populate:
 * - downpaymentAmount (50% of finalTotal)
 * - remainingBalance (50% of finalTotal)
 * - totalAmount (equals finalTotal)
 * - paymentType (default to 'downpayment')
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Reservation = require('../models/Reservation');

// MongoDB Connection String
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tito-renz-resort';

async function backfillPaymentAmounts() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all reservations that need payment amounts backfilled
        const reservations = await Reservation.find({
            $or: [
                { downpaymentAmount: { $exists: false } },
                { downpaymentAmount: null },
                { downpaymentAmount: 0 },
                { remainingBalance: { $exists: false } },
                { remainingBalance: null },
                { remainingBalance: 0 },
                { totalAmount: { $exists: false } },
                { totalAmount: null }
            ],
            finalTotal: { $exists: true, $ne: null, $ne: 0 },
            status: { $ne: 'CART' } // Don't update CART items
        });

        console.log(`📊 Found ${reservations.length} reservations needing payment amount updates`);

        let updated = 0;
        let skipped = 0;

        for (const reservation of reservations) {
            try {
                const finalTotal = reservation.finalTotal || 0;
                
                if (finalTotal <= 0) {
                    skipped++;
                    console.log(`⏭️  Skipped reservation ${reservation.reservationId || reservation._id}: finalTotal is 0`);
                    continue;
                }

                // Calculate 50/50 split
                const downpayment = finalTotal * 0.5;
                const remaining = finalTotal * 0.5;

                // Update fields
                reservation.downpaymentAmount = downpayment;
                reservation.remainingBalance = remaining;
                reservation.totalAmount = finalTotal;
                
                // Set payment type if not already set
                if (!reservation.paymentType) {
                    reservation.paymentType = 'downpayment';
                }

                await reservation.save();
                updated++;
                console.log(`✅ Updated reservation ${reservation.reservationId || reservation._id}: ₱${finalTotal.toLocaleString()} (Down: ₱${downpayment.toLocaleString()}, Remaining: ₱${remaining.toLocaleString()})`);

            } catch (err) {
                console.error(`❌ Error updating reservation ${reservation._id}:`, err.message);
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`   Total processed: ${reservations.length}`);
        console.log(`   ✅ Successfully updated: ${updated}`);
        console.log(`   ⏭️  Skipped: ${skipped}`);

        // Close connection
        await mongoose.connection.close();
        console.log('\n🔌 Database connection closed');
        console.log('✨ Migration complete!');

    } catch (error) {
        console.error('❌ Migration failed:', error);
        process.exit(1);
    }
}

// Run the migration
backfillPaymentAmounts();
