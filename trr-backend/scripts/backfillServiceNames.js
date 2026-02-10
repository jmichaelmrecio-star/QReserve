/**
 * Migration Script: Backfill serviceName for existing reservations
 * 
 * This script updates existing reservations that don't have serviceName populated.
 * It queries the Service collection to get the service name based on serviceId.
 */

const mongoose = require('mongoose');
require('dotenv').config();

// Import models
const Reservation = require('../models/Reservation');
const Service = require('../models/Service');
const servicesData = require('../config/servicesData');

// MongoDB Connection String
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/tito-renz-resort';

async function backfillServiceNames() {
    try {
        // Connect to MongoDB
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        // Find all reservations without serviceName
        const reservations = await Reservation.find({
            $or: [
                { serviceName: { $exists: false } },
                { serviceName: null },
                { serviceName: '' }
            ]
        });

        console.log(`📊 Found ${reservations.length} reservations without serviceName`);

        let updated = 0;
        let failed = 0;

        for (const reservation of reservations) {
            try {
                let serviceName = null;

                // First try to find in servicesData (for string IDs like 'villa_room_1')
                const serviceFromData = servicesData.find(s => s.id === reservation.serviceId);
                if (serviceFromData) {
                    serviceName = serviceFromData.name;
                } 
                // If not found and looks like a MongoDB ObjectId, query database
                else if (mongoose.Types.ObjectId.isValid(reservation.serviceId)) {
                    const serviceFromDB = await Service.findById(reservation.serviceId);
                    if (serviceFromDB) {
                        serviceName = serviceFromDB.name;
                    }
                }

                if (serviceName) {
                    reservation.serviceName = serviceName;
                    await reservation.save();
                    updated++;
                    console.log(`✅ Updated reservation ${reservation.reservationId || reservation._id}: ${serviceName}`);
                } else {
                    failed++;
                    console.log(`⚠️  Could not find service for reservation ${reservation.reservationId || reservation._id} with serviceId: ${reservation.serviceId}`);
                }
            } catch (err) {
                failed++;
                console.error(`❌ Error updating reservation ${reservation._id}:`, err.message);
            }
        }

        console.log('\n📈 Migration Summary:');
        console.log(`   Total processed: ${reservations.length}`);
        console.log(`   ✅ Successfully updated: ${updated}`);
        console.log(`   ❌ Failed: ${failed}`);

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
backfillServiceNames();
