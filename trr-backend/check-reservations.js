const mongoose = require('mongoose');

// Import Reservation model
const Reservation = require('./models/Reservation');

// Connection string
const mongoURI = 'mongodb+srv://seancvpugosa_db_user:oasX4rZ1Hgemo0QT@cluster0.xxkjqwv.mongodb.net/?retryWrites=true&w=majority';

async function checkReservations() {
    try {
        await mongoose.connect(mongoURI);
        console.log('Connected to MongoDB');

        // Get all reservations
        const allReservations = await Reservation.find({}).sort({ dateCreated: -1 });
        console.log(`\n📊 Total Reservations: ${allReservations.length}\n`);

        // Show sample reservations with their payment status and dates
        console.log('Sample Reservations:');
        allReservations.slice(0, 10).forEach((res, idx) => {
            console.log(`\n${idx + 1}. ID: ${res.reservationId || res._id}`);
            console.log(`   Customer: ${res.full_name || res.customer_name}`);
            console.log(`   Payment Status: ${res.paymentStatus}`);
            console.log(`   Created: ${res.dateCreated}`);
            console.log(`   Check-in: ${res.check_in}`);
            console.log(`   Final Total: ${res.finalTotal}`);
        });

        // Check payment status breakdown
        const paymentBreakdown = await Reservation.aggregate([
            {
                $group: {
                    _id: '$paymentStatus',
                    count: { $sum: 1 }
                }
            }
        ]);
        
        console.log('\n\n💳 Payment Status Breakdown:');
        paymentBreakdown.forEach(item => {
            console.log(`   ${item._id || 'null'}: ${item.count}`);
        });

        // Check what dates exist for PAID and DOWNPAYMENT_PAID
        const paidReservations = await Reservation.find({
            paymentStatus: { $in: ['PAID', 'DOWNPAYMENT_PAID'] }
        }).sort({ dateCreated: -1 });

        console.log(`\n\n✅ Reservations with PAID/DOWNPAYMENT_PAID status: ${paidReservations.length}`);
        if (paidReservations.length > 0) {
            const earliest = paidReservations[paidReservations.length - 1];
            const latest = paidReservations[0];
            console.log(`\n📅 Date range for test:`);
            console.log(`   Start Date: ${earliest.dateCreated.toISOString().split('T')[0]}`);
            console.log(`   End Date: ${latest.dateCreated.toISOString().split('T')[0]}`);
        }

        await mongoose.disconnect();
        console.log('\n✅ Check complete');
    } catch (err) {
        console.error('Error:', err);
        process.exit(1);
    }
}

checkReservations();
