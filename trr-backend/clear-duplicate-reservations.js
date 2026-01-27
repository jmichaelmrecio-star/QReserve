const mongoose = require('mongoose');

async function clearDuplicates() {
    try {
        console.log('🔄 Connecting to MongoDB...');
        const conn = await mongoose.connect('mongodb://127.0.0.1:27017/test', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('✅ Connected to MongoDB');

        // Get the Reservation model
        const Reservation = require('./models/Reservation');

        // Delete all reservations from today with TRR-20260127 prefix
        console.log('🗑️  Deleting reservations with TRR-20260127 prefix...');
        const result = await Reservation.deleteMany({
            reservationId: { $regex: '^TRR-20260127' }
        });

        console.log(`✅ Deleted ${result.deletedCount} reservations from today (TRR-20260127-*)`);
        
        // Show remaining reservations from today
        const remaining = await Reservation.find({
            reservationId: { $regex: '^TRR-20260127' }
        });
        console.log(`📊 Remaining reservations from today: ${remaining.length}`);

        if (remaining.length === 0) {
            console.log('✨ Successfully cleared all duplicate reservations!');
        }

        await mongoose.connection.close();
        console.log('✅ Connection closed. Done!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error.message);
        console.error(error.stack);
        process.exit(1);
    }
}

clearDuplicates();
