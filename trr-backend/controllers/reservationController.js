// ============================================================
// IMPORTS - All at the top of the file
// ============================================================
const Reservation = require('../models/Reservation');
const BlockedDate = require('../models/BlockedDate');
const PromoCode = require('../models/PromoCode');
const Service = require('../models/Service');
const crypto = require('crypto');
const servicesData = require('../config/servicesData');
const mongoose = require('mongoose');
const emailService = require('../utils/emailService');
const PDFDocument = require('pdfkit');

// ============================================================
// HELPER FUNCTIONS - Defined before any exports
// ============================================================

// Helper function to generate a unique QR code string (UUID)
// NOTE: This function is not used since we use crypto.randomBytes(16).toString('hex') for reservationHash
function generateQRCodeString() {
    return crypto.randomUUID();
}

// Helper function to generate formal reservation ID (TRR-YYYYMMDD-###)
async function generateFormalReservationId() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `TRR-${year}${month}${day}`;
    
    // Find the last reservation created today
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const endOfDay = new Date(today.setHours(23, 59, 59, 999));
    
    const todaysReservations = await Reservation.find({
        dateCreated: { $gte: startOfDay, $lte: endOfDay }
    }).sort({ dateCreated: -1 }).limit(1);
    
    let sequenceNumber = 1;
    if (todaysReservations.length > 0 && todaysReservations[0].reservationId) {
        // Extract the base sequence number, supports multi-amenity suffix (e.g., -001-01)
        const lastId = todaysReservations[0].reservationId;
        const match = lastId.match(/-(\d{3})(?:-\d{2})?$/);
        if (match) {
            sequenceNumber = parseInt(match[1]) + 1;
        }
    }
    
    const formattedSequence = String(sequenceNumber).padStart(3, '0');
    return `${datePrefix}-${formattedSequence}`;
}

// Helper function to get service name from serviceId
async function getServiceName(serviceId) {
    if (!serviceId) return null;
    
    // First try to find in servicesData (for string IDs like 'villa_room_1')
    const serviceFromData = servicesData.find(s => s.id === serviceId);
    if (serviceFromData) {
        return serviceFromData.name;
    }
    
    // If not found and looks like a MongoDB ObjectId, query database
    if (mongoose.Types.ObjectId.isValid(serviceId)) {
        try {
            const serviceFromDB = await Service.findById(serviceId);
            return serviceFromDB ? serviceFromDB.name : null;
        } catch (err) {
            console.error('Error fetching service from database:', err);
            return null;
        }
    }
    
    return null;
}

// Helper function to calculate price from service data
function calculateServicePrice(service, durationId, guestCount = 1) {
    if (!service) return null;

    // For services with timeSlots (like Private Pool Area)
    if (service.timeSlots && service.timeSlots.length > 0) {
        const slot = service.timeSlots.find(ts => ts.id === durationId);
        if (!slot) return null;
        
        // Validate guest count is within the slot's range
        if (slot.guestRange) {
            if (guestCount < slot.guestRange.min || guestCount > slot.guestRange.max) {
                return null; // Guest count out of range
            }
        }
        return { price: slot.price, label: slot.label, inclusions: service.inclusions || [] };
    }

    // For services with durations (rooms and halls)
    if (service.durations && service.durations.length > 0) {
        const duration = service.durations.find(d => d.id === durationId);
        if (!duration) return null;
        return { price: duration.price, label: duration.label, inclusions: service.inclusions || [] };
    }

    return null;
}

// Helper: tolerant service lookup supporting custom string ids and MongoDB ObjectIds
async function findServiceByAnyId(serviceId, { includeInactive = false } = {}) {
    if (!serviceId) return null;

    const or = [{ id: serviceId }]; // custom/legacy string IDs like "private_pool_area"
    if (mongoose.isValidObjectId(serviceId)) {
        or.push({ _id: serviceId });
    }

    const query = { $or: or };
    if (!includeInactive) query.isActive = true;

    return Service.findOne(query);
}

// Helper: Validate reservation lead time requirements using Rolling 30-Minute Rule
// Standard Rooms (accommodation): Rolling 30-Minute Rule
//   - If current time is MM:00 to MM:30, can book current hour
//   - If current time is MM:31 to MM:59, must book next hour
//   - Resort operates 8:00 AM to 8:00 PM
// Venues (event/venue): Users must reserve at least 1 day (24 hours) before check-in date
async function validateLeadTime(serviceId, checkInDateTime, serviceTypeFromRequest) {
    try {
        // Get service details to determine type
        const service = await findServiceByAnyId(serviceId);
        
        if (!service) {
            // If service not found, skip validation (will fail later in other checks)
            return { valid: true };
        }

        const now = new Date();
        const currentMinutes = now.getMinutes();
        const currentHour = now.getHours();
        
        // Determine if this is a Standard Room or Venue based on service type/category
        const serviceType = serviceTypeFromRequest || service.type || '';
        const serviceCategory = service.category || '';
        
        // Venues: event_space, water_facility, or type is 'venue'
        const isVenue = serviceCategory.toLowerCase().includes('event_space') ||
                       serviceCategory.toLowerCase().includes('water_facility') ||
                       serviceType.toLowerCase() === 'venue';
        
        if (isVenue) {
            // Venues: Must reserve at least 1 day (24 hours) before check-in date
            const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
            
            if (checkInDateTime < twentyFourHoursFromNow) {
                return {
                    valid: false,
                    message: `${service.name || 'This venue'} requires at least 24 hours advance notice. Please select a check-in date that is at least 1 day away from today.`,
                    leadTimeType: 'venue'
                };
            }
        } else {
            // Standard Rooms (accommodation): Rolling 30-Minute Rule
            // Determine the earliest allowable check-in hour
            let earliestHour;
            if (currentMinutes <= 30) {
                // Within :00-:30 window, can book current hour
                earliestHour = currentHour;
            } else {
                // Within :31-:59 window, must book next hour
                earliestHour = currentHour + 1;
            }
            
            // Create the minimum allowed check-in time (start of the earliest hour)
            const minCheckInTime = new Date(now);
            minCheckInTime.setHours(earliestHour, 0, 0, 0);
            
            // If earliest hour is past operating hours (8 PM = 20:00) or before opening (8 AM),
            // adjust to next day 8 AM
            if (earliestHour >= 20 || earliestHour < 8) {
                minCheckInTime.setDate(minCheckInTime.getDate() + 1);
                minCheckInTime.setHours(8, 0, 0, 0);
            }
            
            // Validate the requested check-in time
            if (checkInDateTime < minCheckInTime) {
                const minTimeStr = minCheckInTime.toLocaleString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    hour: 'numeric',
                    minute: '2-digit',
                    hour12: true
                });
                return {
                    valid: false,
                    message: `${service.name || 'This room'} follows the Rolling 30-Minute Rule. The earliest available check-in time is ${minTimeStr}. Please select a later time.`,
                    leadTimeType: 'room'
                };
            }
        }

        return { valid: true };
    } catch (error) {
        console.error('❌ Error validating lead time:', error);
        // Don't fail the reservation if validation function has an error
        // Just log it and allow the reservation
        return { valid: true };
    }
}

// Helper: Create global resort lock when Private Pool is reserved
async function createPrivatePoolGlobalLock(reservation) {
    try {
        console.log('🔍 Checking if reservation is Private Pool:', {
            reservationId: reservation.reservationId,
            serviceName: reservation.serviceName,
            serviceType: reservation.serviceType
        });
        
        console.log('🔍 DEBUG - Reservation object keys:', Object.keys(reservation.toObject ? reservation.toObject() : reservation));
        console.log('🔍 DEBUG - Reservation email field:', reservation.email, 'full_name:', reservation.full_name);

        // Check if this is a Private Pool Area reservation
        const isPrivatePool = reservation.serviceName && 
                            reservation.serviceName.toLowerCase().includes('private pool');
        
        console.log(`   → isPrivatePool: ${isPrivatePool}`);

        if (!isPrivatePool) {
            console.log('ℹ️ Not a Private Pool reservation, skipping global lock');
            return;
        }

        console.log('🔒 Creating global resort lock for Private Pool reservation:', {
            reservationId: reservation.reservationId,
            checkIn: reservation.check_in,
            checkOut: reservation.check_out,
            accountId: reservation.accountId,
            email: reservation.email
        });

        // Create a BlockedDate that blocks ALL services for this time period
        // BUT stores the customer info so they can still book amenities
        const blockedDate = new BlockedDate({
            startDate: reservation.check_in,
            endDate: reservation.check_out,
            date: reservation.check_in, // Legacy field for backward compatibility
            serviceIds: [], // Empty array means all services
            appliesToAllServices: true,
            reason: `Private Pool Area Reserved (${reservation.reservationId})`,
            blockedBy: null, // Could be set to admin ID if available
            reservedByAccountId: reservation.accountId || null, // Store customer accountId
            reservedByEmail: reservation.email || null // Store customer email
        });

        await blockedDate.save();

        console.log('✅ Global resort lock created successfully:', {
            blockedDateId: blockedDate._id,
            startDate: blockedDate.startDate,
            endDate: blockedDate.endDate,
            reason: blockedDate.reason
        });

        return blockedDate;
    } catch (error) {
        console.error('❌ Error creating global resort lock:', error);
        // Don't throw - we don't want to fail the reservation if blocking fails
        // The double-booking prevention will still work as a fallback
    }
}

// Helper: Remove global resort lock when Private Pool is cancelled
async function removePrivatePoolGlobalLock(reservation) {
    try {
        // Check if this is a Private Pool Area reservation
        const isPrivatePool = reservation.serviceName && 
                            reservation.serviceName.toLowerCase().includes('private pool');
        
        if (!isPrivatePool) {
            console.log('ℹ️ Not a Private Pool reservation, skipping lock removal');
            return;
        }

        console.log('🔓 Removing global resort lock for cancelled Private Pool reservation:', {
            reservationId: reservation.reservationId
        });

        // Find and remove the blocked date associated with this reservation
        const result = await BlockedDate.deleteMany({
            appliesToAllServices: true,
            reason: { $regex: reservation.reservationId }
        });

        console.log('✅ Global resort lock removed:', {
            deletedCount: result.deletedCount
        });

        return result;
    } catch (error) {
        console.error('❌ Error removing global resort lock:', error);
        // Don't throw - we don't want to fail the cancellation if lock removal fails
    }
}

// ============================================================
// EXPORTS - All controller functions
// ============================================================

// Check for duplicate reservation or cart item for the same user, service, and date range
exports.checkCartDuplicate = async (req, res) => {
    try {
        const accountId = req.user.accountId;
        const { serviceId, checkin_date, checkout_date } = req.body;
        if (!serviceId || !checkin_date || !checkout_date) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }
        const checkIn = new Date(checkin_date);
        const checkOut = new Date(checkout_date);
        // Find any reservation or cart item for this user, service, and overlapping date range
        const existing = await Reservation.findOne({
            accountId,
            serviceId,
            status: { $in: ['CART', 'PENDING', 'CONFIRMED', 'PAID'] },
            $or: [
                { check_in: { $lt: checkOut }, check_out: { $gt: checkIn } }
            ]
        });
        if (existing) {
            return res.status(200).json({ success: true, duplicate: true, message: 'You already have a reservation or cart item for this service and date range.' });
        }
        return res.status(200).json({ success: true, duplicate: false });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to check for duplicate cart item.' });
    }
};
// --- CART API ENDPOINTS ---
// Get all cart items for logged-in user
exports.getCartItems = async (req, res) => {
    try {
        const accountId = req.user.accountId;
        const cartItems = await Reservation.find({ accountId, status: 'CART' });
        res.status(200).json({ success: true, cart: cartItems });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch cart items.' });
    }
};

// Add item to cart for logged-in user
exports.addCartItem = async (req, res) => {
    try {
        const accountId = req.user.accountId;
        const {
            serviceId,
            serviceType,
            number_of_guests,
            checkin_date,
            checkout_date,
            customer_name,
            customer_contact,
            customer_email,
            customer_address,
            basePrice,
            finalTotal,
            selectedDuration,
            selectedTimeSlot,
            discountCode,
            discountValue
        } = req.body;

        // Minimal validation (add more as needed)
        if (!serviceId || !checkin_date || !checkout_date) {
            return res.status(400).json({ success: false, message: 'Missing required fields.' });
        }

        const reservationHash = crypto.randomBytes(16).toString('hex');
        const formalReservationId = await generateFormalReservationId();

        // Calculate payment amounts (50% downpayment, 50% remaining balance)
        const downpayment = finalTotal * 0.5;
        const remaining = finalTotal * 0.5;

        const newReservation = new Reservation({
            accountId,
            serviceId,
            serviceType,
            serviceName: await getServiceName(serviceId),
            full_name: customer_name,
            check_in: new Date(checkin_date),
            check_out: new Date(checkout_date),
            guests: number_of_guests,
            phone: customer_contact,
            email: customer_email,
            address: customer_address,
            basePrice,
            finalTotal,
            totalAmount: finalTotal,
            downpaymentAmount: downpayment,
            remainingBalance: remaining,
            paymentType: 'downpayment',
            discountCode: discountCode || null,
            discountValue: discountValue || 0,
            reservationHash,
            reservationId: formalReservationId,
            selectedDuration: selectedDuration || null,
            selectedTimeSlot: selectedTimeSlot || null,
            status: 'CART',
            paymentStatus: 'CART',
        });

        await newReservation.save();
        res.status(201).json({ success: true, cartItem: newReservation });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to add item to cart.' });
    }
};

// Remove item from cart for logged-in user
exports.removeCartItem = async (req, res) => {
    try {
        const accountId = req.user.accountId;
        const { id } = req.params;
        const deleted = await Reservation.findOneAndDelete({ _id: id, accountId, status: 'CART' });
        if (!deleted) {
            return res.status(404).json({ success: false, message: 'Cart item not found.' });
        }
        res.status(200).json({ success: true });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove cart item.' });
    }
};

// Send custom email to customer for a reservation
exports.sendCustomEmail = async (req, res) => {
    try {
        const { reservationId, subject, body } = req.body;
        if (!reservationId || !subject || !body) {
            return res.status(400).json({ success: false, message: 'Missing reservationId, subject, or body.' });
        }
        const reservation = await Reservation.findById(reservationId);
        if (!reservation || !reservation.email) {
            return res.status(404).json({ success: false, message: 'Reservation or customer email not found.' });
        }
        
        try {
            await emailService.sendGenericEmail(reservation.email, subject, body);
            console.log(`✅ Custom email sent to ${reservation.email} for reservation ${reservation.reservationId}`);
            res.status(200).json({ success: true, message: 'Email sent successfully.' });
        } catch (emailError) {
            console.error('Email sending failed, but message was saved:', emailError.message);
            // Return success anyway since message was saved to file
            res.status(200).json({ 
                success: true, 
                message: 'Email service unavailable. Your message has been saved and will be sent when service is restored.' 
            });
        }
    } catch (error) {
        console.error('Error sending custom email:', error);
        res.status(500).json({ success: false, message: 'Failed to process email request.' });
    }
};

// Get all reservations (admin)
exports.getAllReservations = async (req, res) => {
    try {
        const reservations = await Reservation.find().sort({ dateCreated: -1 });
        res.status(200).json({ success: true, reservations });
    } catch (error) {
        console.error('Error fetching all reservations:', error);
        res.status(500).json({ success: false, message: 'Server error fetching all reservations.', error: error.message });
    }
};

// Helper function to generate a unique QR code string (UUID)
// NOTE: This function is not used since we use crypto.randomBytes(16).toString('hex') for reservationHash
function generateQRCodeString() {
    return crypto.randomUUID();
}

// Helper function to generate formal reservation ID (TRR-YYYYMMDD-###)
async function generateFormalReservationId() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const datePrefix = `TRR-${year}${month}${day}`;
    
    // Find ALL reservations created today (not just the last one) to be safe
    const startOfDay = new Date(year, today.getMonth(), today.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(year, today.getMonth(), today.getDate(), 23, 59, 59, 999);
    
    const todaysReservations = await Reservation.find({
        reservationId: { $regex: `^${datePrefix}` } // More reliable: check by prefix
    });
    
    let sequenceNumber = 1;
    
    // Extract all sequence numbers from today's reservations
    const existingSequences = todaysReservations
        .map(r => {
            const match = r.reservationId.match(/-(\d{3})(?:-\d{2})?$/);
            return match ? parseInt(match[1]) : 0;
        })
        .sort((a, b) => b - a); // Sort descending to get the highest
    
    if (existingSequences.length > 0 && existingSequences[0] > 0) {
        sequenceNumber = existingSequences[0] + 1;
    }
    
    const formattedSequence = String(sequenceNumber).padStart(3, '0');
    const newId = `${datePrefix}-${formattedSequence}`;
    console.log(`🆔 Generated Formal Reservation ID: ${newId} (Next in sequence after ${existingSequences[0] || 0})`);
    return newId;
}

// Helper function to calculate price from service data
function calculateServicePrice(service, durationId, guestCount = 1) {
    if (!service) return null;

    // For services with timeSlots (like Private Pool Area)
    if (service.timeSlots && service.timeSlots.length > 0) {
        const slot = service.timeSlots.find(ts => ts.id === durationId);
        if (!slot) return null;
        
        // Validate guest count is within the slot's range
        if (slot.guestRange) {
            if (guestCount < slot.guestRange.min || guestCount > slot.guestRange.max) {
                return null; // Guest count out of range
            }
        }
        return { price: slot.price, label: slot.label, inclusions: service.inclusions || [] };
    }

    // For services with durations (rooms and halls)
    if (service.durations && service.durations.length > 0) {
        const duration = service.durations.find(d => d.id === durationId);
        if (!duration) return null;
        return { price: duration.price, label: duration.label, inclusions: service.inclusions || [] };
    }

    return null;
}

// Helper: tolerant service lookup supporting custom string ids and MongoDB ObjectIds
async function findServiceByAnyId(serviceId, { includeInactive = false } = {}) {
    if (!serviceId) return null;

    const or = [{ id: serviceId }]; // custom/legacy string IDs like "private_pool_area"
    if (mongoose.isValidObjectId(serviceId)) {
        or.push({ _id: serviceId });
    }

    const query = { $or: or };
    if (!includeInactive) query.isActive = true;

    return Service.findOne(query);
}

exports.createReservation = async (req, res) => {
    try {
        console.log('📍 createReservation called with body:', JSON.stringify(req.body, null, 2));
        
        const {
            serviceId,
            serviceType,
            // Match Reservation Details (from fieldset 2)
            number_of_guests: numberOfGuests, // RENAME HERE
            checkin_date: checkInDateString, // Mapped to schema path 'check_in'
            checkout_date: checkOutDateString, // Mapped to schema path 'check_out'
            // Match Contact Details (from fieldset 3, div#guestDetailsForm)
            customer_name: fullName,
            customer_contact: contactNumber,
            customer_email: email,
            customer_address: address,
            customer_notes: notes,
            basePrice,
            finalTotal,
            // NEW: Duration-based pricing fields
            selectedDuration,
            selectedTimeSlot,
            discountCode,
            discountValue
            // ... any other fields like basePrice, etc.
        } = req.body;

        // --- A. Identify User and Validate Guest Data ---
        let accountId = null;
        let reservationEmail = email;
        let reservationContactNumber = contactNumber;

        if (req.user) {
            accountId = req.user.accountId; 
            // NOTE: Ideally, you'd fetch the user's current contact info here
        } else {
            // Guest user: Ensure mandatory contact fields are present
            if (!fullName || !email || !contactNumber) {
                return res.status(400).json({ success: false, message: 'Guest reservations require full contact details.' });
            }
        }

        // --- B. Server-Side Date Validation (Check Past Dates) ---
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        if (!checkInDateString || !checkOutDateString) {
            return res.status(400).json({ success: false, message: 'Check-in and Check-out dates are required.' });
        }

        // Convert the strings to Date objects
        const checkIn = new Date(checkInDateString);
        const checkOut = new Date(checkOutDateString);

        // NEW VALIDATION: Check if the resulting Date object is valid
        if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
            return res.status(400).json({ success: false, message: 'Invalid date format received for check-in or check-out.' });
        }


        if (checkIn < today || checkOut < today || checkOut <= checkIn) {
            return res.status(400).json({ success: false, message: 'Invalid dates. Check-in and Check-out must be future dates, and check-out must be after check-in.' });
        }

        // --- B2. Validate Lead Time Requirements ---
        console.log('⏰ Validating lead time requirements for serviceId:', serviceId);
        const leadTimeCheck = await validateLeadTime(serviceId, checkIn, serviceType);
        if (!leadTimeCheck.valid) {
            console.log('❌ Lead time validation failed:', leadTimeCheck.message);
            return res.status(400).json({
                success: false,
                message: leadTimeCheck.message,
                leadTimeType: leadTimeCheck.leadTimeType
            });
        }
        console.log('✅ Lead time validation passed');

        // --- C. Check for Blocked Dates (Server-Side Validation) ---
        const blockedDates = await BlockedDate.find();
        for (const block of blockedDates) {
            // Normalize fields to avoid crashes from legacy data
            const serviceIds = Array.isArray(block.serviceIds) ? block.serviceIds.map(id => id.toString()) : [];
            const appliesToAll = typeof block.appliesToAllServices === 'boolean'
                ? block.appliesToAllServices
                : serviceIds.length === 0;

            // Skip malformed records without usable dates
            if (!block.startDate || !block.endDate) continue;

            const blockStart = new Date(block.startDate);
            const blockEnd = new Date(block.endDate);

            // Check if service is affected (empty serviceIds means all services)
            const isServiceBlocked = appliesToAll || serviceIds.includes(serviceId?.toString());

            // Check if dates overlap
            if (isServiceBlocked && checkIn <= blockEnd && checkOut >= blockStart) {
                const blockStartStr = blockStart.toLocaleDateString();
                const blockEndStr = blockEnd.toLocaleDateString();
                
                // Check if this is a Private Pool global lock
                const isPrivatePoolBlock = block.reason && block.reason.includes('Private Pool Area Reserved');
                
                // CRITICAL: Allow the customer who booked the private pool to book amenities
                if (isPrivatePoolBlock) {
                    const isPoolBooker = (accountId && block.reservedByAccountId && 
                                         accountId.toString() === block.reservedByAccountId.toString()) ||
                                        (email && block.reservedByEmail && 
                                         email.toLowerCase() === block.reservedByEmail.toLowerCase());
                    
                    if (isPoolBooker) {
                        console.log('✅ Allowing pool booker to reserve amenities:', { accountId, email });
                        continue; // Skip this block since they booked the pool
                    }
                }
                
                const message = isPrivatePoolBlock
                    ? `Sorry, the resort is fully booked for ${blockStartStr} to ${blockEndStr} due to a private pool reservation.`
                    : `This service is unavailable from ${blockStartStr} to ${blockEndStr}. Reason: ${block.reason || 'Maintenance/Closure'}`;
                
                return res.status(400).json({
                    success: false,
                    message: message,
                    resortFullyBooked: isPrivatePoolBlock
                });
            }
        }

        // --- C2. CRITICAL: Check for Double Booking (Prevent Overlapping Reservations) ---
        const existingReservations = await Reservation.find({
            serviceId: serviceId,
            status: { $ne: 'CANCELLED' }, // Exclude cancelled reservations
            $or: [
                // Check if new reservation overlaps with existing ones
                // Overlap occurs if: new check-in < existing check-out AND new check-out > existing check-in
                {
                    check_in: { $lt: checkOut },
                    check_out: { $gt: checkIn }
                }
            ]
        });

        if (existingReservations.length > 0) {
            const conflictingReservation = existingReservations[0];
            const existingCheckinStr = new Date(conflictingReservation.check_in).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            const existingCheckoutStr = new Date(conflictingReservation.check_out).toLocaleString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            });
            
            console.error('DOUBLE BOOKING PREVENTED:', {
                attemptedService: serviceId,
                attemptedCheckin: checkIn,
                attemptedCheckout: checkOut,
                conflictingReservation: {
                    id: conflictingReservation._id,
                    checkin: conflictingReservation.check_in,
                    checkout: conflictingReservation.check_out,
                    customer: conflictingReservation.full_name,
                    status: conflictingReservation.status
                }
            });

            return res.status(409).json({
                success: false,
                message: `This service is already booked during your selected time. Existing reservation: ${existingCheckinStr} to ${existingCheckoutStr}. Please choose different dates.`,
                conflict: {
                    existingCheckin: existingCheckinStr,
                    existingCheckout: existingCheckoutStr,
                    status: conflictingReservation.status
                }
            });
        }

        // --- D. Service Validation & Price Calculation ---
        console.log('🔍 Looking for service with ID:', serviceId);
        let service = await findServiceByAnyId(serviceId);
        if (!service) {
            // Fallback to hardcoded services (legacy)
            service = servicesData.find(s => s.id === serviceId);
        }
        
        if (!service) {
            console.error('❌ Service not found for ID:', serviceId);
            return res.status(400).json({ success: false, message: 'Invalid service selected.' });
        }
        
        console.log('✅ Service found:', { id: service.id, _id: service._id, name: service.name });

        // Validate max guest limit from service data
        if (numberOfGuests > service.max_guests) {
            return res.status(400).json({ success: false, message: `The chosen service allows a maximum of ${service.max_guests} guests.` });
        }

        // Validate duration/timeslot and calculate expected price
        const durationOrSlot = selectedTimeSlot || selectedDuration;
        console.log('⏱️  Duration/Slot provided:', durationOrSlot);
        if (!durationOrSlot) {
            return res.status(400).json({ success: false, message: 'Duration or time slot selection is required.' });
        }

        console.log('🧮 Calculating price for duration:', durationOrSlot);
        const priceData = calculateServicePrice(service, durationOrSlot, numberOfGuests);
        console.log('💰 Price calculation result:', priceData);
        if (!priceData) {
            return res.status(400).json({ success: false, message: 'Invalid duration/time slot or guest count for the selected service.' });
        }

        // Server-side price validation (prevent frontend manipulation)
        const expectedBasePrice = priceData.price;
        const expectedFinalTotal = discountValue ? (expectedBasePrice - discountValue) : expectedBasePrice;
        
        console.log('💵 Price validation:', { expectedBasePrice, receivedBase: basePrice, expectedFinalTotal, receivedFinal: finalTotal });
        
        // Allow 1 peso tolerance for rounding differences
        if (Math.abs(parseFloat(basePrice) - expectedBasePrice) > 1 || Math.abs(parseFloat(finalTotal) - expectedFinalTotal) > 1) {
            console.error(`❌ Price mismatch: Expected base=${expectedBasePrice}, received=${basePrice}; Expected final=${expectedFinalTotal}, received=${finalTotal}`);
            return res.status(400).json({ 
                success: false, 
                message: 'Price validation failed. Please refresh and try again.',
                debug: { expectedBasePrice, expectedFinalTotal, receivedBase: basePrice, receivedFinal: finalTotal }
            });
        }

        // --- E. Generate Reservation Hash and Formal Reservation ID ---
        console.log('🔐 Generating reservation hash and formal ID...');
        const reservationHash = crypto.randomBytes(16).toString('hex');
        const formalReservationId = await generateFormalReservationId();
        console.log('✅ Generated IDs:', { reservationHash: reservationHash.substring(0, 8) + '...', formalReservationId });
        
        // --- F. Create Reservation Record ---
        console.log('📝 Creating reservation record...');
        
        // Calculate payment amounts (50% downpayment, 50% remaining balance)
        const downpayment = expectedFinalTotal * 0.5;
        const remaining = expectedFinalTotal * 0.5;
        
        const newReservation = new Reservation({
            accountId,
            serviceId,
            serviceType,
            serviceName: await getServiceName(serviceId),
            full_name: fullName,
            check_in: checkIn,
            check_out: checkOut,
            guests: numberOfGuests,
            phone: contactNumber,
            email: reservationEmail,
            address,
            basePrice: expectedBasePrice,
            finalTotal: expectedFinalTotal,
            totalAmount: expectedFinalTotal,
            downpaymentAmount: downpayment,
            remainingBalance: remaining,
            paymentType: 'downpayment',
            discountCode: discountCode || null,
            discountValue: discountValue || 0,
            reservationHash: reservationHash, // CRITICAL: Correctly defined and used here
            reservationId: formalReservationId, // Formal reservation ID (e.g., TRR-20260110-001)
            // NEW: Duration-based pricing fields
            selectedDuration: selectedDuration || null,
            selectedTimeSlot: selectedTimeSlot || null,
            durationLabel: priceData.label,
            inclusions: priceData.inclusions,
            // Initial Statuses
            status: 'PENDING', 
            paymentStatus: 'PENDING',
        });

        console.log('💾 Saving reservation to database...');
        await newReservation.save();
        console.log('✅ Reservation saved successfully:', newReservation._id);

        res.status(201).json({ 
            success: true, 
            message: 'Reservation created successfully. Proceed to payment.', 
            reservationId: newReservation._id,
            formalReservationId: formalReservationId, // Return formal ID
            reservationHash: reservationHash // CRITICAL: Correct key returned in the response
        });

    } catch (error) {
        console.error('❌ Error creating reservation:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code
        });
        res.status(500).json({ success: false, message: 'Failed to create reservation.', error: error.message });
    }
};

// ============================================================
// MULTI-AMENITY RESERVATION CREATION
// ============================================================

/**
 * Create a multi-amenity reservation (multiple services in one transaction)
 * This handles the "shopping cart" flow where users select multiple amenities
 * with individual check-in/check-out dates and times.
 */
exports.createMultiAmenityReservation = async (req, res) => {
    try {
        console.log('📍 createMultiAmenityReservation called with body:', JSON.stringify(req.body, null, 2));
        
        const { customer, amenities, appliedPromo, pricing } = req.body;

        // --- A. Validate Input Structure ---
        if (!customer || !amenities || !Array.isArray(amenities) || amenities.length === 0) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid request: customer details and amenities array are required.' 
            });
        }

        if (!pricing || !pricing.finalTotal) {
            return res.status(400).json({ 
                success: false, 
                message: 'Invalid request: pricing information is required.' 
            });
        }

        // --- B. Validate Customer Details ---
        const { name, email, contact, address, notes } = customer;
        if (!name || !email || !contact || !address) {
            return res.status(400).json({ 
                success: false, 
                message: 'Customer name, email, contact, and address are required.' 
            });
        }

        // --- C. Identify User Account ---
        let accountId = null;
        if (req.user) {
            accountId = req.user.accountId;
        }

        // --- D. Validate Each Amenity ---
        const now = new Date(); // Use current date-time for validation

        // Helper function to parse time string (e.g., "8:00 PM", "5:00 PM", or simple "8")
        const parseTimeToHour = (timeStr) => {
            if (!timeStr || timeStr === '--') return 0;
            
            // If it's just a number string (e.g., "8", "20")
            if (/^\d+$/.test(timeStr)) {
                return parseInt(timeStr);
            }
            
            // Parse formatted time like "8:00 PM" or "5:00 PM"
            const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
            if (match) {
                let hour = parseInt(match[1]);
                const isPM = match[3].toUpperCase() === 'PM';
                
                // Convert to 24-hour format
                if (isPM && hour !== 12) {
                    hour += 12;
                } else if (!isPM && hour === 12) {
                    hour = 0;
                }
                
                return hour;
            }
            
            // Fallback: try to parse as integer
            return parseInt(timeStr) || 0;
        };

        for (let i = 0; i < amenities.length; i++) {
            const amenity = amenities[i];
            
            // Validate required fields
            if (!amenity.serviceId || !amenity.checkIn || !amenity.checkOut) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Amenity #${i + 1} (${amenity.serviceName || 'Unknown'}) is missing required fields.` 
                });
            }

            // Convert dates - handle both date-only and full datetime strings
            // Construct proper datetime if checkInTime and checkOutTime are provided
            let checkIn, checkOut;
            
            if (amenity.checkInTime) {
                // Parse check-in time (handles both "8" and "8:00 AM" formats)
                const checkInHour = parseTimeToHour(amenity.checkInTime);
                checkIn = new Date(amenity.checkIn);
                checkIn.setHours(checkInHour, 0, 0, 0);
            } else {
                checkIn = new Date(amenity.checkIn);
            }
            
            if (amenity.checkOutTime) {
                // Parse check-out time (handles both "20" and "8:00 PM" formats)
                const checkOutHour = parseTimeToHour(amenity.checkOutTime);
                checkOut = new Date(amenity.checkOut);
                checkOut.setHours(checkOutHour, 0, 0, 0);
            } else {
                checkOut = new Date(amenity.checkOut);
            }

            if (isNaN(checkIn.getTime()) || isNaN(checkOut.getTime())) {
                return res.status(400).json({ 
                    success: false, 
                    message: `Amenity #${i + 1} (${amenity.serviceName || 'Unknown'}) has invalid date format.` 
                });
            }

            // More lenient validation - allow bookings starting from today
            if (checkOut <= checkIn) {
                console.error('Invalid dates:', {
                    amenity: amenity.serviceName,
                    checkIn: checkIn.toISOString(),
                    checkOut: checkOut.toISOString(),
                    rawCheckInTime: amenity.checkInTime,
                    rawCheckOutTime: amenity.checkOutTime
                });
                return res.status(400).json({ 
                    success: false, 
                    message: `Amenity #${i + 1} (${amenity.serviceName || 'Unknown'}) has invalid dates: check-out must be after check-in.` 
                });
            }

            // Check for blocked dates
            const blockedDates = await BlockedDate.find();
            console.log(`🔍 Checking ${blockedDates.length} blocked dates for amenity #${i + 1} (${amenity.serviceName})`);
            console.log(`   Requested dates: ${checkIn.toISOString()} to ${checkOut.toISOString()}`);
            
            for (const block of blockedDates) {
                const serviceIds = Array.isArray(block.serviceIds) ? block.serviceIds.map(id => id.toString()) : [];
                const appliesToAll = typeof block.appliesToAllServices === 'boolean'
                    ? block.appliesToAllServices
                    : serviceIds.length === 0;

                if (!block.startDate || !block.endDate) {
                    console.log(`   ⏭️  Skipping block ${block._id}: missing dates`);
                    continue;
                }

                const blockStart = new Date(block.startDate);
                const blockEnd = new Date(block.endDate);

                const isServiceBlocked = appliesToAll || serviceIds.includes(amenity.serviceId?.toString());
                
                console.log(`   Block: ${blockStart.toISOString()} to ${blockEnd.toISOString()}`);
                console.log(`   - appliesToAll: ${appliesToAll}, serviceIds: ${serviceIds.join(',')}`);
                console.log(`   - isServiceBlocked: ${isServiceBlocked}`);

                if (isServiceBlocked && checkIn <= blockEnd && checkOut >= blockStart) {
                    const blockStartStr = blockStart.toLocaleDateString();
                    const blockEndStr = blockEnd.toLocaleDateString();
                    
                    // Check if this is a Private Pool global lock
                    const isPrivatePoolBlock = block.reason && block.reason.includes('Private Pool Area Reserved');
                    
                    // CRITICAL: Allow the customer who booked the private pool to book amenities
                    if (isPrivatePoolBlock) {
                        const isPoolBooker = (accountId && block.reservedByAccountId && 
                                             accountId.toString() === block.reservedByAccountId.toString()) ||
                                            (email && block.reservedByEmail && 
                                             email.toLowerCase() === block.reservedByEmail.toLowerCase());
                        
                        if (isPoolBooker) {
                            console.log('✅ Allowing pool booker to reserve amenities (multi):', { accountId, email });
                            continue; // Skip this block since they booked the pool
                        }
                    }
                    
                    const message = isPrivatePoolBlock
                        ? `Sorry, the resort is fully booked for ${blockStartStr} to ${blockEndStr} due to a private pool reservation.`
                        : `${amenity.serviceName || 'A service'} is unavailable from ${blockStartStr} to ${blockEndStr}. Reason: ${block.reason || 'Maintenance/Closure'}`;
                    
                    console.log(`❌ Blocked! Reason: ${message}`);
                    return res.status(400).json({
                        success: false,
                        message: message,
                        resortFullyBooked: isPrivatePoolBlock
                    });
                }
            }
            console.log(`✅ No blocking found for amenity #${i + 1}`);

            // Check for double booking
            const existingReservations = await Reservation.find({
                serviceId: amenity.serviceId,
                status: { $ne: 'CANCELLED' },
                $or: [
                    {
                        check_in: { $lt: checkOut },
                        check_out: { $gt: checkIn }
                    }
                ]
            });

            if (existingReservations.length > 0) {
                const conflict = existingReservations[0];
                const existingCheckinStr = new Date(conflict.check_in).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
                const existingCheckoutStr = new Date(conflict.check_out).toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });

                return res.status(409).json({
                    success: false,
                    message: `${amenity.serviceName || 'A service'} is already booked during your selected time. Existing reservation: ${existingCheckinStr} to ${existingCheckoutStr}. Please choose different dates.`,
                    conflict: {
                        serviceName: amenity.serviceName,
                        existingCheckin: existingCheckinStr,
                        existingCheckout: existingCheckoutStr
                    }
                });
            }
        }

        // --- D2. Validate Lead Time Requirements for Each Amenity ---
        console.log('⏰ Validating lead time requirements for multi-amenity...');
        for (let i = 0; i < amenities.length; i++) {
            const amenity = amenities[i];
            const checkIn = new Date(amenity.checkIn);
            
            // Parse check-in time if provided (reuse parseTimeToHour helper)
            if (amenity.checkInTime) {
                const parseTimeToHour = (timeStr) => {
                    if (!timeStr || timeStr === '--') return 0;
                    if (/^\d+$/.test(timeStr)) {
                        return parseInt(timeStr);
                    }
                    const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
                    if (match) {
                        let hour = parseInt(match[1]);
                        const isPM = match[3].toUpperCase() === 'PM';
                        if (isPM && hour !== 12) {
                            hour += 12;
                        } else if (!isPM && hour === 12) {
                            hour = 0;
                        }
                        return hour;
                    }
                    return parseInt(timeStr) || 0;
                };
                const checkInHour = parseTimeToHour(amenity.checkInTime);
                checkIn.setHours(checkInHour, 0, 0, 0);
            }

            const leadTimeCheck = await validateLeadTime(amenity.serviceId, checkIn, amenity.serviceType);
            if (!leadTimeCheck.valid) {
                console.log(`❌ Lead time validation failed for amenity #${i + 1}:`, leadTimeCheck.message);
                return res.status(400).json({
                    success: false,
                    message: `Amenity #${i + 1} (${amenity.serviceName || 'Unknown'}): ${leadTimeCheck.message}`,
                    leadTimeType: leadTimeCheck.leadTimeType
                });
            }
        }
        console.log('✅ Lead time validation passed for all amenities');

        // --- E. Generate Reservation Hash and Formal ID ---
        console.log('🔐 Generating reservation hash and formal ID...');
        const reservationHash = crypto.randomBytes(16).toString('hex');
        const formalReservationId = await generateFormalReservationId();
        console.log('✅ Generated IDs:', { reservationHash: reservationHash.substring(0, 8) + '...', formalReservationId });

        // --- F. Create Individual Reservation Records for Each Amenity ---
        // Strategy: Create separate reservation documents for each amenity, but link them with a common groupId
        const groupId = new mongoose.Types.ObjectId(); // Common ID to group related amenities
        const createdReservations = [];

        for (let i = 0; i < amenities.length; i++) {
            const amenity = amenities[i];
            
            // Parse check-in with time component
            let checkIn = new Date(amenity.checkIn);
            if (amenity.checkInTime) {
                const checkInHour = parseTimeToHour(amenity.checkInTime);
                checkIn.setHours(checkInHour, 0, 0, 0);
            }
            
            // Parse check-out with time component
            let checkOut = new Date(amenity.checkOut);
            if (amenity.checkOutTime) {
                const checkOutHour = parseTimeToHour(amenity.checkOutTime);
                checkOut.setHours(checkOutHour, 0, 0, 0);
            }

            // For multi-amenity, we'll use a modified formal ID with sequence suffix
            const amenityFormalId = `${formalReservationId}-${String(i + 1).padStart(2, '0')}`;

            // Calculate payment amounts for this amenity (50% downpayment, 50% remaining balance)
            const amenityPrice = amenity.price || 0;
            const amenityDownpayment = amenityPrice * 0.5;
            const amenityRemaining = amenityPrice * 0.5;

            const newReservation = new Reservation({
                accountId,
                serviceId: amenity.serviceId,
                serviceType: amenity.serviceType || 'Unknown',
                serviceName: amenity.serviceName || await getServiceName(amenity.serviceId) || 'N/A', // Store service name for easier display
                full_name: name,
                check_in: checkIn,
                check_out: checkOut,
                guests: amenity.guests || 1, // Multi-amenity can track guests per item
                phone: contact,
                email: email,
                address: address,
                basePrice: amenity.price || 0,
                finalTotal: amenity.price || 0, // Individual item price (discount applied at group level)
                totalAmount: amenityPrice,
                downpaymentAmount: amenityDownpayment,
                remainingBalance: amenityRemaining,
                paymentType: 'downpayment',
                discountCode: appliedPromo?.code || null,
                discountValue: 0, // Discount applied to total, not individual items
                reservationHash: i === 0 ? reservationHash : `${reservationHash}-${i}`, // First item gets main hash
                reservationId: amenityFormalId,
                selectedDuration: amenity.selectedDuration || null,
                selectedTimeSlot: amenity.selectedTimeSlot || null,
                durationLabel: amenity.durationLabel || 'N/A',
                inclusions: Array.isArray(amenity.inclusions) ? amenity.inclusions : [],
                status: 'PENDING',
                paymentStatus: 'PENDING',
                // Multi-amenity specific fields
                isMultiAmenity: true,
                multiAmenityGroupId: groupId,
                multiAmenityIndex: i,
                multiAmenityTotal: amenities.length,
                multiAmenityGroupPrimary: i === 0, // Mark first item as primary
                // Store check-in time separately for display
                checkInTimeSlot: amenity.checkInTime ? String(amenity.checkInTime) : null,
                checkOutTimeSlot: amenity.checkOutTime ? String(amenity.checkOutTime) : null
            });

            await newReservation.save();
            createdReservations.push(newReservation);
        }

        // --- G. Store Multi-Amenity Metadata ---
        // Store pricing information in the first (primary) reservation
        const primaryReservation = createdReservations[0];
        primaryReservation.basePrice = pricing.originalTotal;
        primaryReservation.finalTotal = pricing.finalTotal;
        primaryReservation.discountValue = pricing.discountAmount || 0;
        primaryReservation.multiAmenityGroupPrimary = true;
        await primaryReservation.save();

        console.log('✅ Multi-amenity reservations created:', {
            groupId: groupId.toString(),
            count: createdReservations.length,
            primaryReservationId: primaryReservation._id
        });

        res.status(201).json({
            success: true,
            message: 'Multi-amenity reservation created successfully. Proceed to payment.',
            reservationId: primaryReservation._id,
            formalReservationId: formalReservationId,
            reservationHash: reservationHash,
            groupId: groupId.toString(),
            amenityCount: amenities.length,
            finalTotal: pricing.finalTotal
        });

    } catch (error) {
        console.error('❌ Error creating multi-amenity reservation:', {
            message: error.message,
            stack: error.stack,
            name: error.name,
            code: error.code,
            errors: error.errors // Mongoose validation errors
        });
        
        // Check if it's a Mongoose validation error
        if (error.name === 'ValidationError') {
            const validationErrors = Object.keys(error.errors).map(key => 
                `${key}: ${error.errors[key].message}`
            ).join(', ');
            return res.status(400).json({ 
                success: false, 
                message: 'Validation error: ' + validationErrors,
                error: error.message 
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to create multi-amenity reservation.', 
            error: error.message,
            details: process.env.NODE_ENV === 'development' ? error.stack : undefined
        });
    }
};

// ... existing imports

/**
 * Finalizes the reservation after payment confirmation.
 * This function FINDS the existing PENDING reservation and UPDATES its status.
 */
// --- Finalize Reservation (Handle Payment Submission) ---
exports.finalizeReservation = async (req, res) => {
    // 1. Destructure the required fields from the frontend payload
    // FIX 1: Change expected input field from qrCodeHash to reservationHash
    const { 
        reservationHash, 
        gcashReferenceNumber,
        totalAmount,
        downpaymentAmount,
        remainingBalance,
        paymentType,
        receiptImage,
        receiptFileName
    } = req.body; 

    // 2. Basic Validation
    if (!reservationHash || !gcashReferenceNumber) {
        return res.status(400).json({ success: false, message: "Missing hash or GCash reference number in the request body." });
    }

    // Validate receipt image is provided
    if (!receiptImage) {
        return res.status(400).json({ success: false, message: "Payment receipt image is required." });
    }

    try {
        // 3. Find the reservation using the unique reservation hash
        // FIX 2: Query the database using the correct field name
        const reservation = await Reservation.findOne({ reservationHash: reservationHash }); 

        if (!reservation) {
            return res.status(404).json({ success: false, message: "Reservation not found using the provided hash." });
        }

        // 4. Idempotency Check: Prevent confirming an already confirmed/paid reservation
        if (reservation.paymentStatus === 'PAID' || reservation.paymentStatus === 'DOWNPAYMENT_PAID') {
            // Use 409 Conflict status code
            return res.status(409).json({ success: false, message: "Reservation is already confirmed or payment has been processed." });
        }

        // 5. Update the payment and reservation statuses
        reservation.gcashReferenceNumber = gcashReferenceNumber;
        
        // Store only receipt file name, not base64 image
        reservation.receiptFileName = receiptFileName || 'receipt.jpg';
        reservation.receiptUploadedAt = new Date();
        
        // Set payment status based on payment type chosen by customer
        if (paymentType === 'downpayment' && downpaymentAmount) {
            reservation.paymentStatus = 'partial-payment'; // 50% submitted, waiting for admin approval
            reservation.totalAmount = totalAmount;
            reservation.downpaymentAmount = downpaymentAmount;
            reservation.remainingBalance = remainingBalance;
            reservation.paymentType = 'downpayment';
            reservation.status = 'PENDING'; // Awaiting admin verification
        } else {
            reservation.paymentStatus = 'full-payment'; // 100% submitted, waiting for admin approval
            reservation.paymentType = 'fullpayment';
            reservation.status = 'PENDING';
        }
        
        // Save the updated reservation
        const updatedReservation = await reservation.save();

        // 6. Success Response
        res.status(200).json({
            success: true,
            message: paymentType === 'downpayment' 
                ? "Downpayment submitted. Awaiting admin verification."
                : "Payment submitted. Awaiting admin verification.",
            // FIX 3: Return the correct hash field in the response
            reservationHash: updatedReservation.reservationHash 
        });

    } catch (error) {
        console.error("Error finalizing reservation:", error);
        // Mongoose validation errors or other operational errors
        res.status(500).json({ success: false, message: "Internal server error during finalization." });
    }
};

exports.getReservationById = async (req, res) => {
    try {
        const reservationId = req.params.id;
        
        const reservation = await Reservation.findById(reservationId);
        
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }
        
        res.status(200).json(reservation);

    } catch (error) {
        console.error('Error fetching reservation by ID:', error);
        res.status(500).json({ message: 'Server error retrieving reservation.' });
    }
};

exports.getPendingReservations = async (req, res) => {
    try {
        // Query the database for paid reservations awaiting admin confirmation.
        const pendingReservations = await Reservation.find({ 
            status: 'PAID'
        })
        .sort({ check_in: 1 }); // Sort by check-in date, oldest first

        res.status(200).json(pendingReservations);

    } catch (error) {
        console.error('SERVER ERROR fetching pending reservations for Admin:', error);
        res.status(500).json({ 
            message: 'Internal server error while retrieving pending reservations.',
            details: error.message 
        });
    }
};

// Example in reservationController.js

exports.getReservationDetails = async (req, res) => {
    try {
        const { reservationId, hash } = req.params;
        const mongoose = require('mongoose');

        // First, find the reservation by ID
        let reservation;
        
        if (mongoose.isValidObjectId(reservationId)) {
            // Search by MongoDB _id
            reservation = await Reservation.findById(reservationId);
        } else {
            // Search by formatted reservation ID (e.g., TRR-20260121-001)
            reservation = await Reservation.findOne({ reservationId: reservationId });
        }

        // If reservation not found, return 404
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Verify the hash matches for security
        if (reservation.reservationHash !== hash) {
            return res.status(404).json({ message: 'Reservation not found or invalid access.' });
        }

        // Return the necessary data for the summary
        res.status(200).json({ 
            success: true, 
            reservation 
        });

    } catch (error) {
        console.error("Error fetching reservation details:", error);
        res.status(500).json({ message: 'Server error retrieving details.' });
    }
};

/**
 * Updates the status of a specific reservation. (Used by Admin Confirm/Cancel buttons)
 */
exports.updateReservationStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { status } = req.body;

        if (!status) {
            return res.status(400).json({ message: 'New status is required in the request body.' });
        }

        const normalizedStatus = status.toString().trim().toUpperCase();

        // Validate the status is one of the allowed admin actions
        // CHECKED_IN is used for manual/QR check-in from admin dashboard
        const allowedStatuses = ['CONFIRMED', 'CHECKED_IN', 'CANCELLED', 'COMPLETED'];
        if (!allowedStatuses.includes(normalizedStatus)) {
            return res.status(400).json({ message: `Invalid status provided: ${status}` });
        }

        const nextFields = { status: normalizedStatus };

        if (normalizedStatus === 'CANCELLED') {
            nextFields.paymentStatus = 'REFUNDED';
        } else if (['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(normalizedStatus)) {
            nextFields.paymentStatus = 'PAID';
            // Set payment confirmed timestamp if not already set
            const currentReservation = await Reservation.findById(id);
            if (currentReservation && !currentReservation.paymentConfirmedAt) {
                nextFields.paymentConfirmedAt = new Date();
            }
        }
        nextFields.updatedAt = new Date();

        // Find the reservation by ID and update the status field
        const updatedReservation = await Reservation.findByIdAndUpdate(
            id,
            nextFields,
            { new: true } // Returns the updated document
        );

        if (!updatedReservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Remove global lock if Private Pool reservation is cancelled
        if (normalizedStatus === 'CANCELLED') {
            await removePrivatePoolGlobalLock(updatedReservation);
        }

        res.status(200).json({ 
            message: `Reservation ${id} successfully updated to status: ${normalizedStatus}`,
            reservation: updatedReservation
        });

    } catch (error) {
        console.error('SERVER ERROR updating reservation status:', error);
        res.status(500).json({ 
            message: 'Internal server error while updating reservation status.',
            details: error.message 
        });
    }
};

// Customer cancellation request (stores reason + cancels reservation)
exports.requestCancellation = async (req, res) => {
    try {
        const { id } = req.params;
        const { reason, requestedBy, requestedByEmail } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Reservation ID is required.' });
        }

        if (!reason || !reason.toString().trim()) {
            return res.status(400).json({ message: 'Cancellation reason is required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        let reservationsToUpdate = [reservation];
        if (reservation.isMultiAmenity && reservation.multiAmenityGroupId) {
            reservationsToUpdate = await Reservation.find({
                multiAmenityGroupId: reservation.multiAmenityGroupId
            }).sort({ multiAmenityIndex: 1 });
        }

        const cancelReason = reason.toString().trim();
        const cancelRequestedAt = new Date();

        for (const r of reservationsToUpdate) {
            r.status = 'CANCELLED';
            r.paymentStatus = 'REFUNDED';
            r.cancelReason = cancelReason;
            r.cancelRequestedAt = cancelRequestedAt;
            r.cancelRequestedBy = requestedBy || r.full_name || null;
            r.cancelRequestedByEmail = requestedByEmail || r.email || null;
            r.updatedAt = new Date();
            await r.save();
        }

        // Remove global lock if Private Pool reservation is cancelled
        for (const r of reservationsToUpdate) {
            await removePrivatePoolGlobalLock(r);
        }

        res.status(200).json({
            success: true,
            message: `Cancellation request processed for reservation ${id}.`,
            reservation: reservationsToUpdate[0]
        });
    } catch (error) {
        console.error('SERVER ERROR requesting cancellation:', error);
        res.status(500).json({
            message: 'Internal server error while requesting cancellation.',
            details: error.message
        });
    }
};

// Function to get all reservations for a specific user email
exports.getUserReservations = async (req, res) => {
    try {
        const { email } = req.params;
        if (!email) {
            return res.status(400).json({ success: false, message: 'Email parameter is required.' });
        }
        
        // Find reservations matching the email or the accountId (if linked)
        const reservations = await Reservation.find({ email: decodeURIComponent(email) }).sort({ dateCreated: -1 });
        
        res.status(200).json({
            success: true,
            reservations: reservations
        });
        
    } catch (error) {
        console.error('SERVER ERROR fetching user reservations:', error);
        res.status(500).json({ success: false, message: 'Error fetching user reservations.', details: error.message });
    }
};

exports.blockDateForMaintenance = async (req, res) => {
    try {
        // NOTE: You must have a middleware function (like requireRole('Admin', 'Manager')) 
        // checking the user's role before this function runs.

        const { date, reason } = req.body;

        if (!date || !reason) {
            return res.status(400).json({ message: 'Missing date or reason for blocking.' });
        }

        const blockDate = new Date(date);
        blockDate.setUTCHours(0, 0, 0, 0); // Normalize date to start of day

        // Check if the date is already blocked
        const existingBlock = await BlockedDate.findOne({ date: blockDate });
        if (existingBlock) {
            return res.status(400).json({ message: `Date ${date} is already blocked for maintenance.` });
        }

        // Create the new blocked date entry
        const newBlockedDate = new BlockedDate({
            date: blockDate,
            reason: reason,
            blockedBy: req.user ? req.user.accountId : null, // Record who blocked it
        });

        await newBlockedDate.save();

        res.status(201).json({ 
            success: true, 
            message: `Successfully blocked date ${date} for maintenance.`,
            blockedDate: newBlockedDate
        });

    } catch (error) {
        console.error('Error blocking date:', error);
        res.status(500).json({ success: false, message: 'Failed to block date.' });
    }
};

// reservationController.js

exports.staffCheckIn = async (req, res) => {
    try {
        // --- 1. Get Hash from URL Parameters ---
        // We are renaming the variable here to be explicit
        const { reservationHash: hashFromUrl } = req.params; // <-- CHANGE IS HERE

        if (!hashFromUrl) { // Use the new variable name
            return res.status(400).json({ success: false, message: 'Reservation Hash is missing from the URL.' });
        }

        // --- 2. Find Reservation by hash OR reservationId ---
        let reservation = await Reservation.findOne({ reservationHash: hashFromUrl });
        // If not found by hash, try by reservationId
        if (!reservation) {
            reservation = await Reservation.findOne({ reservationId: hashFromUrl });
        }
        if (!reservation) {
            return res.status(404).json({ success: false, message: 'No matching reservation found for this hash or ID.' });
        }
        
        // --- 3. Payment Status Check (CRITICAL) ---
        if (reservation.paymentStatus !== 'PAID') {
            return res.status(403).json({ 
                success: false, 
                message: `Check-in Failed: Payment status is ${reservation.paymentStatus}. Payment must be PAID.`,
                status: 'PAYMENT_PENDING',
                reservationDetails: {
                    formalReservationId: reservation.reservationId || reservation._id,
                    guestName: reservation.full_name || 'Registered User',
                    email: reservation.email,
                    phone: reservation.phone,
                    service: reservation.serviceType,
                    checkIn: reservation.check_in,
                    checkOut: reservation.check_out,
                    guests: reservation.guests,
                    paymentStatus: reservation.paymentStatus,
                    totalPaid: reservation.finalTotal,
                    paymentType: reservation.paymentType,
                    downpaymentAmount: reservation.downpaymentAmount,
                    remainingBalance: reservation.remainingBalance
                }
            });
        }
        
        // --- 4. Already Checked In Check ---
        if (reservation.status === 'CHECKED_IN') {
            // Return success status and reservation details
            return res.status(200).json({ 
                success: true, 
                message: 'Reservation is already marked as checked-in.',
                status: 'ALREADY_CHECKED_IN',
                reservationDetails: {
                    formalReservationId: reservation.reservationId || reservation._id,
                    guestName: reservation.full_name || 'Registered User',
                    email: reservation.email,
                    phone: reservation.phone,
                    service: reservation.serviceType,
                    checkIn: reservation.check_in,
                    checkOut: reservation.check_out,
                    guests: reservation.guests,
                    paymentStatus: reservation.paymentStatus,
                    totalPaid: reservation.finalTotal,
                    paymentType: reservation.paymentType,
                    downpaymentAmount: reservation.downpaymentAmount,
                    remainingBalance: reservation.remainingBalance
                }
            });
        }

        // --- 5. Perform Check-in Update ---
        reservation.status = 'CHECKED_IN';
        reservation.checkInTime = new Date();
        await reservation.save();

        // --- 6. Success Response ---
        res.status(200).json({ 
            success: true, 
            message: `Check-in successful for ${reservation.full_name || 'Guest User'}.`,
            status: 'CHECKED_IN',
            reservationDetails: {
                formalReservationId: reservation.reservationId || reservation._id,
                guestName: reservation.full_name || 'Registered User',
                email: reservation.email,
                phone: reservation.phone,
                service: reservation.serviceType,
                checkIn: reservation.check_in,
                checkOut: reservation.check_out,
                guests: reservation.guests,
                paymentStatus: reservation.paymentStatus,
                totalPaid: reservation.finalTotal,
                paymentType: reservation.paymentType,
                downpaymentAmount: reservation.downpaymentAmount,
                remainingBalance: reservation.remainingBalance
            }
        });

    } catch (error) {
        console.error('Error during staff check-in:', error);
        res.status(500).json({ success: false, message: 'Internal server error during check-in.', status: 'ERROR' });
    }
};

// Manual Checkout Override - Admin/Staff Only
exports.checkoutReservation = async (req, res) => {
    try {
        const { id: reservationId } = req.params;
        const { checkoutOverride, performedBy } = req.body;

        // Validate reservation ID
        if (!reservationId) {
            return res.status(400).json({ 
                success: false, 
                message: 'Reservation ID is required.' 
            });
        }

        // Find the reservation
        const reservation = await Reservation.findById(reservationId);
        
        if (!reservation) {
            return res.status(404).json({ 
                success: false, 
                message: 'Reservation not found.' 
            });
        }

        // Check if already completed
        if (reservation.status === 'COMPLETED') {
            return res.status(200).json({ 
                success: true, 
                message: 'Reservation is already marked as completed.',
                status: 'ALREADY_COMPLETED',
                reservation
            });
        }

        // Verify reservation is checked-in before allowing checkout
        if (reservation.status !== 'CHECKED_IN') {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot checkout. Reservation status is ${reservation.status}. Must be CHECKED_IN to checkout.`,
                currentStatus: reservation.status
            });
        }

        // Perform checkout
        reservation.status = 'COMPLETED';
        reservation.checkOutTime = new Date();
        
        // Track who performed the checkout (optional)
        if (performedBy) {
            reservation.checkoutPerformedBy = performedBy;
        }

        await reservation.save();

        res.status(200).json({ 
            success: true, 
            message: `Checkout successful for ${reservation.full_name || 'Guest'}.`,
            status: 'COMPLETED',
            reservation: {
                id: reservation._id,
                guestName: reservation.full_name,
                service: reservation.serviceType,
                checkInTime: reservation.checkInTime,
                checkOutTime: reservation.checkOutTime,
                status: reservation.status
            }
        });

    } catch (error) {
        console.error('Error during checkout:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error during checkout.',
            error: error.message 
        });
    }
};

exports.generateReports = async (req, res) => {
    try {
        // Get query parameters: startDate, endDate, serviceType (optional), generatedBy
        const { startDate, endDate, serviceType, generatedBy } = req.query;

        console.log('📊 Report Generation Request');
        console.log('   Raw startDate from query:', startDate);
        console.log('   Raw endDate from query:', endDate);
        console.log('   Service Type filter:', serviceType || 'all');
        console.log('   Generated by:', generatedBy || 'Unknown');

        if (!startDate || !endDate) {
            return res.status(400).json({ message: 'Start and End dates are required for report generation.' });
        }

        // Parse dates carefully - the format from HTML date input is YYYY-MM-DD
        const [startYear, startMonth, startDay] = startDate.split('-');
        const [endYear, endMonth, endDay] = endDate.split('-');
        
        const start = new Date(parseInt(startYear), parseInt(startMonth) - 1, parseInt(startDay), 0, 0, 0, 0);
        const end = new Date(parseInt(endYear), parseInt(endMonth) - 1, parseInt(endDay), 23, 59, 59, 999);

        console.log('   Parsed start Date object:', start);
        console.log('   Parsed end Date object:', end);

        // Build query filter - only COMPLETED reservations (paid + checked out)
        let query = {
            check_in: { $gte: start, $lte: end },
            paymentStatus: { $in: ['PAID', 'DOWNPAYMENT_PAID'] },
            checkOutTime: { $exists: true, $ne: null } // Guest must have checked out
        };

        // Add service type filter if specified and not 'all'
        if (serviceType && serviceType !== 'all' && serviceType.trim() !== '') {
            // Case-insensitive service type filter
            query.serviceType = { $regex: new RegExp(`^${serviceType}$`, 'i') };
        }

        // Fetch reservations matching the query
        const reservations = await Reservation.find(query).sort({ check_in: -1 });

        console.log('   Found completed reservations:', reservations.length);

        // Calculate totals and service breakdown
        const totalIncome = reservations.reduce((sum, r) => sum + (r.finalTotal || 0), 0);
        const totalReservations = reservations.length;

        const serviceBreakdown = {};
        reservations.forEach(r => {
            const svcType = r.serviceType || 'Unknown';
            if (!serviceBreakdown[svcType]) {
                serviceBreakdown[svcType] = { count: 0, revenue: 0 };
            }
            serviceBreakdown[svcType].count += 1;
            serviceBreakdown[svcType].revenue += (r.finalTotal || 0);
        });

        // Create PDF document
        const doc = new PDFDocument({
            size: 'A4',
            margin: 40,
            bufferPages: true
        });

        // Set response headers for PDF
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="tito_renz_reservation_report_${startDate}_to_${endDate}.pdf"`);

        // Pipe document to response
        doc.pipe(res);

        // ============================================================
        // PDF CONTENT
        // ============================================================

        // Header
        doc.fontSize(24).font('Helvetica-Bold').text('TITO RENZ RESORT', { align: 'center' });
        doc.fontSize(14).font('Helvetica').text('Reservation Report', { align: 'center' });
        doc.moveDown(0.3);
        
        // Report info
        doc.fontSize(10).font('Helvetica');
        doc.text(`Report Period: ${startDate} to ${endDate}`, { align: 'center' });
        doc.text(`Generated On: ${new Date().toLocaleString()}`, { align: 'center' });
        doc.text(`Generated By: ${generatedBy || 'Unknown User'}`, { align: 'center' });
        if (serviceType && serviceType !== 'all') {
            doc.text(`Service Type Filter: ${serviceType.toUpperCase()}`, { align: 'center' });
        }
        doc.moveDown(0.5);

        // Horizontal line
        doc.strokeColor('#cccccc').lineWidth(1);
        doc.moveTo(40, doc.y).lineTo(555, doc.y).stroke();
        doc.moveDown(0.5);

        // Summary Section
        doc.fontSize(12).font('Helvetica-Bold').text('SUMMARY', { underline: true });
        doc.moveDown(0.2);
        doc.fontSize(10).font('Helvetica');
        doc.text(`Total Completed Reservations: ${totalReservations}`, { indent: 20 });
        doc.text(`Total Income: PHP ${totalIncome.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, { indent: 20 });
        doc.moveDown(0.4);

        // Service Breakdown Section
        if (Object.keys(serviceBreakdown).length > 0) {
            doc.fontSize(12).font('Helvetica-Bold').text('BREAKDOWN BY SERVICE TYPE', { underline: true });
            doc.moveDown(0.2);
            doc.fontSize(9).font('Helvetica');
            
            // Table header
            const colX = [60, 250, 400];
            doc.font('Helvetica-Bold');
            doc.text('Service Type', colX[0], doc.y);
            doc.text('Reservations', colX[1], doc.y);
            doc.text('Revenue', colX[2], doc.y);
            doc.moveDown(0.3);
            
            // Table rows
            doc.font('Helvetica');
            for (const [serviceType, data] of Object.entries(serviceBreakdown)) {
                doc.text(serviceType, colX[0]);
                doc.text(data.count.toString(), colX[1]);
                doc.text(`PHP ${data.revenue.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`, colX[2]);
                doc.moveDown(0.2);
            }
            doc.moveDown(0.3);
        }

        // Detailed Reservations Section
        if (reservations.length > 0) {
            doc.addPage();
            doc.fontSize(12).font('Helvetica-Bold').text('DETAILED RESERVATION LIST', { underline: true });
            doc.moveDown(0.3);
            doc.fontSize(8).font('Helvetica');

            // Table header
            const colWidths = {
                id: 80,
                customer: 90,
                service: 70,
                checkIn: 70,
                amount: 80,
                status: 60
            };
            const startX = 40;
            let currentX = startX;

            // Header row background
            doc.rect(startX - 5, doc.y - 3, 550, 15).fillAndStroke('#f0f0f0', '#cccccc');
            doc.fillColor('black').font('Helvetica-Bold');
            
            const headers = ['Res. ID', 'Customer', 'Service', 'Check-in', 'Total', 'Status'];
            const colPositions = [
                startX,
                startX + 85,
                startX + 180,
                startX + 255,
                startX + 330,
                startX + 415
            ];

            headers.forEach((header, idx) => {
                doc.text(header, colPositions[idx], doc.y, { width: 75 });
            });
            doc.moveDown(0.8);

            // Data rows
            doc.font('Helvetica');
            doc.fillColor('black');
            
            reservations.forEach((r, idx) => {
                const yPos = doc.y;
                const resId = r.reservationId || r._id.toString().slice(-6);
                const customerName = (r.full_name || r.customer_name || 'N/A').substring(0, 15);
                const svcType = (r.serviceType || 'N/A').substring(0, 10);
                const checkIn = r.check_in ? new Date(r.check_in).toLocaleDateString() : 'N/A';
                const amount = `PHP ${(r.finalTotal || 0).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
                const status = r.status || 'N/A';

                doc.text(resId, colPositions[0], yPos, { width: 75 });
                doc.text(customerName, colPositions[1], yPos, { width: 90 });
                doc.text(svcType, colPositions[2], yPos, { width: 70 });
                doc.text(checkIn, colPositions[3], yPos, { width: 70 });
                doc.text(amount, colPositions[4], yPos, { width: 75 });
                doc.text(status.substring(0, 10), colPositions[5], yPos, { width: 60 });

                doc.moveDown(0.6);

                // Add page break if needed
                if (doc.y > 750) {
                    doc.addPage();
                }
            });
        }

        // Footer
        const pageCount = doc.bufferedPageRange().count;
        for (let i = 0; i < pageCount; i++) {
            doc.switchToPage(i);
            doc.fontSize(8).font('Helvetica').fillColor('#999999');
            doc.text(`Page ${i + 1} of ${pageCount}`, 50, doc.page.height - 30, { align: 'center' });
        }

        // Finalize PDF
        doc.end();

    } catch (error) {
        console.error('Error generating report:', error);
        res.status(500).json({ success: false, message: 'Failed to generate report.', details: error.message });
    }
};

exports.getReservationByHash = async (req, res) => {
    try {
        const { hash } = req.params;

        if (!hash) {
            return res.status(400).json({ success: false, message: "Reservation hash is required." });
        }

        // Handle both single hash and comma-separated hashes (e.g. from Cart checkout)
        const hashes = hash.split(',').map(h => h.trim()).filter(h => h !== '');
        
        if (hashes.length === 0) {
            return res.status(400).json({ success: false, message: "No valid reservation hashes provided." });
        }

        const reservation = await Reservation.findOne({ reservationHash: { $in: hashes } });

        if (!reservation) {
            // Use a 404 Not Found error if the hash doesn't match any reservation
            return res.status(404).json({ success: false, message: "Reservation not found or invalid hash." });
        }

        // 2. Success: Return the reservation data.
        res.status(200).json({
            success: true,
            reservation: reservation
            // Add a friendly message if needed: message: "Reservation details retrieved successfully."
        });

    } catch (error) {
        console.error("Error retrieving reservation by hash:", error);
        res.status(500).json({ success: false, message: "Server error while retrieving reservation." });
    }
};

/**
 * Check if a service is available for the given date range
 * @route POST /api/reservations/check-availability
 * @body { serviceId, checkin_date, checkout_date }
 */
exports.checkAvailability = async (req, res) => {
    try {
        const { serviceId, checkin_date, checkout_date, email } = req.body;
        
        if (!serviceId || !checkin_date || !checkout_date) {
            return res.status(400).json({ 
                message: 'Missing required fields', 
                available: true 
            });
        }
        
        const checkin = new Date(checkin_date);
        const checkout = new Date(checkout_date);
        
        // Get user info from request (if authenticated)
        let accountId = null;
        let userEmail = email; // From request body
        if (req.user) {
            accountId = req.user.accountId;
        }
        
        // Tolerant service lookup
        const service = await findServiceByAnyId(serviceId);
        if (!service) {
            return res.status(404).json({ message: 'Service not found', available: true });
        }

        // Find overlapping reservations (excluding cancelled/rejected)
        const overlapping = await Reservation.find({
            $or: [
                { serviceId: serviceId },
                { serviceId: service.id },
                { serviceId: service._id?.toString() }
            ],
            status: { $nin: ['cancelled', 'rejected'] },
            // Overlap: new check_in < existing check_out AND new check_out > existing check_in
            check_in: { $lt: checkout },
            check_out: { $gt: checkin }
        });
        
        if (overlapping.length > 0) {
            return res.json({ 
                available: false, 
                conflictingReservations: overlapping.length,
                reason: 'This amenity is already reserved for the selected date/time'
            });
        }

        // Check for blocked dates (including global resort locks from Private Pool)
        const blockedDates = await BlockedDate.find({
            $or: [
                // Global blocks (Private Pool reservations block everything)
                { appliesToAllServices: true },
                // Specific service blocks
                { serviceIds: { $in: [serviceId, service.id, service._id?.toString()] } }
            ],
            // Overlap: new check_in < existing endDate AND new check_out > existing startDate
            startDate: { $lt: checkout },
            endDate: { $gt: checkin }
        });

        if (blockedDates.length > 0) {
            // Check if this is a Private Pool block and if the current user is the pool booker
            const block = blockedDates[0];
            const isPrivatePoolBlock = block.reason && block.reason.includes('Private Pool Area Reserved');
            
            if (isPrivatePoolBlock) {
                const isPoolBooker = (accountId && block.reservedByAccountId && 
                                     accountId.toString() === block.reservedByAccountId.toString()) ||
                                    (userEmail && block.reservedByEmail && 
                                     userEmail.toLowerCase() === block.reservedByEmail.toLowerCase());
                
                if (isPoolBooker) {
                    console.log('✅ Allowing pool booker to check availability:', { accountId, userEmail });
                    // They booked the pool, so amenities are available for them
                    return res.json({ 
                        available: true, 
                        conflictingReservations: 0 
                    });
                }
            }
            
            const blockReason = block.reason || 'This date/time is blocked';
            return res.json({
                available: false,
                conflictingReservations: 0,
                blockedDates: blockedDates.length,
                reason: blockReason
            });
        }
        
        res.json({ 
            available: true, 
            conflictingReservations: 0 
        });
    } catch (error) {
        console.error('Error checking availability:', error);
        res.status(500).json({ 
            message: error.message, 
            available: true 
        });
    }
};

/**
 * Check availability for multiple service types by date and time
 * Returns list of available service IDs that match the requested types
 * @route POST /api/reservations/check-service-types-availability
 * @body { checkInDate, checkInTime, checkOutDate, serviceTypes: ['villa', 'room', etc.] }
 */
exports.checkServiceTypesAvailability = async (req, res) => {
    try {
        const { checkInDate, checkInTime, checkOutDate, checkOutTime, serviceTypes, email } = req.body;
        
        if (!checkInDate || !checkInTime || !checkOutDate || !serviceTypes || serviceTypes.length === 0) {
            return res.status(400).json({ 
                message: 'Missing required fields: checkInDate, checkInTime, checkOutDate, serviceTypes', 
                availableServices: [] 
            });
        }

        // Get user info from request (if authenticated)
        let accountId = null;
        let userEmail = email; // From request body
        if (req.user) {
            accountId = req.user.accountId;
        }

        // Convert dates to proper format
        const checkinDateTime = new Date(`${checkInDate}T${String(parseInt(checkInTime, 10)).padStart(2, '0')}:00:00`);
        const checkoutDateTime = checkOutTime
            ? new Date(`${checkOutDate}T${String(parseInt(checkOutTime, 10)).padStart(2, '0')}:00:00`)
            : new Date(checkOutDate);
        
        // If checkout time is not provided, set to end of day
        const checkoutWindowEnd = new Date(checkoutDateTime);
        if (!checkOutTime) {
            checkoutWindowEnd.setHours(23, 59, 59, 999);
        }

        // Get all services (filter inactive in memory; some records may not have isActive)
        const allServices = await Service.find({});

        if (!allServices || allServices.length === 0) {
            return res.json({ 
                message: 'No services found', 
                availableServices: [] 
            });
        }

        // Filter services by type (case-insensitive)
        const matchingTypeServices = allServices.filter(service => {
            if (service.isActive === false) return false;
            if (!service.type) return false;
            const serviceType = service.type.toLowerCase();
            return serviceTypes.some(type => 
                serviceType.includes(type.toLowerCase())
            );
        });

        if (matchingTypeServices.length === 0) {
            return res.json({ 
                message: 'No services found with requested types', 
                availableServices: [] 
            });
        }

        // For each matching service, check if it has conflicting reservations
        const availableServiceIds = [];

        for (const service of matchingTypeServices) {
            // Find overlapping reservations for this service
            const overlappingReservations = await Reservation.find({
                $or: [
                    { serviceId: service._id?.toString() },
                    { serviceId: service.id },
                    { serviceId: service._id }
                ],
                status: { $nin: ['cancelled', 'rejected', 'CANCELLED', 'REJECTED'] },
                // Overlap check: new check_in < existing check_out AND new check_out > existing check_in
                check_in: { $lt: checkoutWindowEnd },
                check_out: { $gt: checkinDateTime }
            });

            // If no conflicting reservations, service is available
            if (overlappingReservations.length === 0) {
                availableServiceIds.push((service._id || service.id).toString());
            }
        }

        // Also check blocked dates
        const startOfCheckIn = new Date(checkInDate);
        startOfCheckIn.setHours(0, 0, 0, 0);
        const endOfCheckOut = new Date(checkOutDate);
        endOfCheckOut.setHours(23, 59, 59, 999);

        const blockedDates = await BlockedDate.find({
            $or: [
                {
                    startDate: { $lte: checkoutWindowEnd },
                    endDate: { $gte: checkinDateTime }
                },
                {
                    date: { $gte: startOfCheckIn, $lte: endOfCheckOut }
                }
            ]
        });

        // Filter out services that match blocked dates
        const finalAvailableIds = availableServiceIds.filter(serviceId => {
            const blockedForService = blockedDates.some(bd => {
                if (bd.appliesToAllServices) {
                    // Check if this is a Private Pool global lock
                    if (bd.reason && bd.reason.includes('Private Pool Area Reserved')) {
                        // CRITICAL: Allow the customer who booked the private pool to book amenities
                        const isPoolBooker = (accountId && bd.reservedByAccountId && 
                                             accountId.toString() === bd.reservedByAccountId.toString()) ||
                                            (userEmail && bd.reservedByEmail && 
                                             userEmail.toLowerCase() === bd.reservedByEmail.toLowerCase());
                        
                        if (isPoolBooker) {
                            console.log(`✅ Pool booker can access service ${serviceId}:`, { accountId, userEmail });
                            return false; // Don't block this service for the pool booker
                        }
                        
                        console.log(`🔒 Service ${serviceId} blocked by Private Pool reservation: ${bd.reason}`);
                    }
                    return true;
                }
                if (!bd.serviceIds || bd.serviceIds.length === 0) return false;
                return bd.serviceIds.some(bdServiceId => 
                    bdServiceId.toString() === serviceId || bdServiceId === serviceId
                );
            });
            return !blockedForService;
        });

        // Check if resort is fully blocked due to Private Pool reservation (for non-pool-bookers)
        let hasPrivatePoolBlock = blockedDates.some(bd => {
            if (bd.appliesToAllServices && bd.reason && bd.reason.includes('Private Pool Area Reserved')) {
                // Check if current user is the pool booker
                const isPoolBooker = (accountId && bd.reservedByAccountId && 
                                     accountId.toString() === bd.reservedByAccountId.toString()) ||
                                    (userEmail && bd.reservedByEmail && 
                                     userEmail.toLowerCase() === bd.reservedByEmail.toLowerCase());
                return !isPoolBooker; // Only block if NOT the pool booker
            }
            return false;
        });

        res.json({ 
            availableServices: finalAvailableIds,
            totalMatching: matchingTypeServices.length,
            totalAvailable: finalAvailableIds.length,
            checkInDate,
            checkInTime,
            checkOutDate,
            checkOutTime: checkOutTime || null,
            serviceTypes,
            resortFullyBooked: hasPrivatePoolBlock,
            blockReason: hasPrivatePoolBlock 
                ? 'The resort is fully booked due to a private pool reservation for this date and time.'
                : null
        });

    } catch (error) {
        console.error('Error checking service types availability:', error);
        res.status(500).json({ 
            message: error.message, 
            availableServices: [] 
        });
    }
};

/**
 * Get all reservations for a specific service
 * @route GET /api/reservations/service/:serviceId
 */
exports.getReservationsByService = async (req, res) => {
    try {
        const { serviceId } = req.params;
        
        if (!serviceId) {
            return res.status(400).json({ message: 'Missing serviceId' });
        }
        
        // Tolerant service lookup (allow inactive for history)
        const service = await findServiceByAnyId(serviceId, { includeInactive: true });
        if (!service) {
            return res.status(404).json({ message: 'Service not found' });
        }

        // Query reservations using BOTH the custom id and MongoDB _id as stored
        const reservations = await Reservation.find({ 
            $or: [
                { serviceId: serviceId },
                { serviceId: service.id },
                { serviceId: service._id?.toString() }
            ],
            status: { $nin: ['cancelled', 'rejected'] }
        })
        .select('serviceId check_in check_out status full_name customer_name')
        .sort({ check_in: 1 });
        
        res.json(reservations);
    } catch (error) {
        console.error('Error fetching reservations by service:', error);
        res.status(500).json({ message: error.message });
    }
};

/**
 * Fetches reservations with 'PENDING' payment status for admin verification.
 */
exports.getPendingPaymentVerifications = async (req, res) => {
    try {
        // Include all reservations that need payment verification:
        // - 'partial-payment': 50% submitted, waiting for admin to approve
        // - 'partially-paid': 50% approved, waiting for remaining 50% payment
        // - 'full-payment': 100% submitted, waiting for admin to approve
        // - 'PENDING': Legacy status for old reservations
        // Exclude 'fully-paid': Already completed payment process
        const pendingPayments = await Reservation.find({
            paymentStatus: { $in: ['PENDING', 'partial-payment', 'partially-paid', 'full-payment'] },
            receiptFileName: { $exists: true, $ne: null } // Ensure a receipt was uploaded
        }).sort({ receiptUploadedAt: 1 }); // Sort by upload time, oldest first

        res.status(200).json(pendingPayments);
    } catch (error) {
        console.error('SERVER ERROR fetching pending payment verifications:', error);
        res.status(500).json({
            message: 'Internal server error while retrieving pending payments.',
            details: error.message
        });
    }
};

/**
 * Approves a payment for a reservation, updating paymentStatus and status.
 */
exports.approvePayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus, status } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Reservation ID is required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Only allow approval if current paymentStatus is PENDING
        if (reservation.paymentStatus !== 'PENDING') {
            return res.status(400).json({ message: `Payment for reservation ${id} is already ${reservation.paymentStatus}.` });
        }

        const resolvedPaymentStatus = paymentStatus || (reservation.paymentType === 'full' ? 'PAID' : 'DOWNPAYMENT_PAID');
        const resolvedStatus = status || 'PAID';

        let reservationsToUpdate = [reservation];
        if (reservation.isMultiAmenity && reservation.multiAmenityGroupId) {
            reservationsToUpdate = await Reservation.find({
                multiAmenityGroupId: reservation.multiAmenityGroupId
            }).sort({ multiAmenityIndex: 1 });
        }

        for (const r of reservationsToUpdate) {
            r.paymentStatus = resolvedPaymentStatus;
            r.status = resolvedStatus;
            r.paymentConfirmedAt = new Date();
            r.updatedAt = new Date();
            await r.save();
        }

        // Check if any reservation in the group is Private Pool and create global lock
        for (const r of reservationsToUpdate) {
            await createPrivatePoolGlobalLock(r);
        }

        // Send QR code email after approval
        try {
            const hashes = reservationsToUpdate.map(r => r.reservationHash).filter(Boolean);
            const hashString = hashes.join(',');
            const confirmationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirmation.html?hash=${encodeURIComponent(hashString)}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(hashString)}`;

            const emailSubject = 'Reservation Approved - Your QR Code';
            const emailBody = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333;">
                    <h2>Your reservation has been approved!</h2>
                    <p>Your payment was verified. Please use the QR code below for check-in.</p>
                    <p style="margin: 16px 0;"><img src="${qrImageUrl}" alt="Reservation QR Code" style="width: 220px; height: 220px;" /></p>
                    <p>If the image does not load, you can open your QR code here:</p>
                    <p><a href="${confirmationUrl}">${confirmationUrl}</a></p>
                    <p>Thank you for choosing Tito Renz Resort!</p>
                </div>
            `;

            await emailService.sendGenericEmail(reservation.email, emailSubject, emailBody);
        } catch (emailError) {
            console.error('Email sending failed after approval:', emailError.message);
        }

        res.status(200).json({
            success: true,
            message: `Payment for reservation ${id} approved and status set to ${resolvedPaymentStatus}.`,
            reservation: reservationsToUpdate[0]
        });
    } catch (error) {
        console.error('SERVER ERROR approving payment:', error);
        res.status(500).json({
            message: 'Internal server error while approving payment.',
            details: error.message
        });
    }
};

/**
 * Rejects a payment for a reservation, updating paymentStatus.
 */
exports.rejectPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentStatus, status } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Reservation ID is required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Allow rejection for any pending or in-progress payment status
        const rejectableStatuses = ['PENDING', 'partial-payment', 'partially-paid', 'full-payment'];
        if (!rejectableStatuses.includes(reservation.paymentStatus)) {
            return res.status(400).json({ message: `Cannot reject payment for reservation ${id} with status: ${reservation.paymentStatus}` });
        }

        const resolvedPaymentStatus = paymentStatus || 'REJECTED';
        const resolvedStatus = status || 'REJECTED';

        let reservationsToUpdate = [reservation];
        if (reservation.isMultiAmenity && reservation.multiAmenityGroupId) {
            reservationsToUpdate = await Reservation.find({
                multiAmenityGroupId: reservation.multiAmenityGroupId
            }).sort({ multiAmenityIndex: 1 });
        }

        for (const r of reservationsToUpdate) {
            r.paymentStatus = resolvedPaymentStatus;
            r.status = resolvedStatus;
            r.updatedAt = new Date();
            await r.save();
        }

        // Remove global lock if Private Pool reservation is rejected
        for (const r of reservationsToUpdate) {
            await removePrivatePoolGlobalLock(r);
        }

        // Send rejection notification email
        try {
            const emailService = require('../utils/emailService');
            const serviceName = reservation.serviceName || 'Your Reservation';
            const emailSubject = 'Reservation Payment Rejected - Tito Renz Resort';
            const emailBody = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1>Payment Rejected</h1>
                    </div>
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2>Hi ${reservation.full_name},</h2>
                        <p>Unfortunately, we were unable to verify your payment submission for the following reservation:</p>
                        <div style="background: white; padding: 15px; margin: 20px 0; border-left: 4px solid #dc3545; border-radius: 5px;">
                            <p><strong>Reservation ID:</strong> ${reservation.reservationId || 'N/A'}</p>
                            <p><strong>Service:</strong> ${serviceName}</p>
                            <p><strong>Check-in Date:</strong> ${new Date(reservation.check_in).toLocaleDateString()}</p>
                            <p><strong>Amount:</strong> ₱${reservation.finalTotal?.toFixed(2) || '0.00'}</p>
                        </div>
                        <p><strong>Reason for Rejection:</strong></p>
                        <p>Your payment proof did not meet our verification requirements. Please review your receipt and try again.</p>
                        <p style="margin: 20px 0;"><a href="${process.env.FRONTEND_URL || 'http://localhost:3000'}/payment.html" style="display: inline-block; background: #dc3545; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold;">Resume Payment</a></p>
                        <p>If you have questions, please contact our support team.</p>
                        <p>Best regards,<br>The Tito Renz Resort Team</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
                        <p>&copy; ${new Date().getFullYear()} Tito Renz Resort. All rights reserved.</p>
                    </div>
                </div>
            `;
            await emailService.sendGenericEmail(reservation.email, emailSubject, emailBody);
        } catch (emailError) {
            console.error('Email sending failed for rejection notification:', emailError.message);
        }

        res.status(200).json({
            success: true,
            message: `Payment for reservation ${id} rejected. Status set to ${resolvedPaymentStatus}.`,
            reservation: reservationsToUpdate[0]
        });
    } catch (error) {
        console.error('SERVER ERROR rejecting payment:', error);
        res.status(500).json({
            message: 'Internal server error while rejecting payment.',
            details: error.message
        });
    }
};

/**
 * Approves the 50% partial payment (down payment) for a reservation
 */
exports.approvePartialPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentType } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Reservation ID is required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Only allow approval if current paymentStatus is 'partial-payment' (50% down payment submitted)
        // or 'PENDING' for legacy reservations
        if (!['PENDING', 'partial-payment'].includes(reservation.paymentStatus)) {
            return res.status(400).json({ message: `Cannot approve partial payment for reservation ${id} with status: ${reservation.paymentStatus}` });
        }

        let reservationsToUpdate = [reservation];
        if (reservation.isMultiAmenity && reservation.multiAmenityGroupId) {
            reservationsToUpdate = await Reservation.find({
                multiAmenityGroupId: reservation.multiAmenityGroupId
            }).sort({ multiAmenityIndex: 1 });
        }

        for (const r of reservationsToUpdate) {
            r.paymentStatus = 'partially-paid';
            r.status = 'CONFIRMED';
            r.updatedAt = new Date();
            await r.save();
        }

        // Send partial payment approval email with QR code
        try {
            const emailService = require('../utils/emailService');
            const serviceName = reservation.serviceName || 'Your Reservation';
            const checkInDate = new Date(reservation.check_in).toLocaleDateString();
            const remainingAmount = (reservation.finalTotal * 0.5).toFixed(2);
            
            const hashes = reservationsToUpdate.map(r => r.reservationHash).filter(Boolean);
            const hashString = hashes.join(',');
            const confirmationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirmation.html?hash=${encodeURIComponent(hashString)}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(hashString)}`;

            const emailSubject = '50% Down Payment Approved - Your QR Code is Ready';
            const emailBody = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1>✓ Down Payment Approved</h1>
                    </div>
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2>Hi ${reservation.full_name},</h2>
                        <p>Great news! Your 50% down payment has been verified and approved.</p>
                        
                        <div style="background: white; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; border: 2px solid #28a745;">
                            <p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">Your Check-in QR Code</p>
                            <img src="${qrImageUrl}" alt="Reservation QR Code" style="width: 220px; height: 220px; border-radius: 5px;" />
                            <p style="color: #666; margin: 15px 0 0 0; font-size: 12px;">Screenshot or save this code on your phone</p>
                        </div>
                        
                        <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #28a745;">
                            <h3 style="color: #28a745; margin-top: 0;">Reservation Details</h3>
                            <p><strong>Reservation ID:</strong> ${reservation.reservationId || 'N/A'}</p>
                            <p><strong>Service:</strong> ${serviceName}</p>
                            <p><strong>Check-in Date:</strong> ${checkInDate}</p>
                            <p><strong>Total Amount:</strong> ₱${reservation.finalTotal?.toFixed(2) || '0.00'}</p>
                            <hr style="border: none; border-top: 1px solid #e9ecef;">
                            <p><strong style="color: #28a745;">✓ Amount Paid (50%):</strong> ₱${(reservation.finalTotal * 0.5).toFixed(2)}</p>
                            <p><strong style="color: #ffc107;">Remaining Due (50%):</strong> ₱${remainingAmount}</p>
                        </div>
                        
                        <p>If the QR code image does not load, you can open it here:</p>
                        <p><a href="${confirmationUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">${confirmationUrl}</a></p>
                        
                        <div style="background: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #ffc107;">
                            <p style="margin: 0;"><strong>⏰ Important Reminder:</strong></p>
                            <p style="margin: 10px 0 0 0;">Please bring your QR code and pay the remaining 50% (₱${remainingAmount}) at check-in on ${checkInDate}.</p>
                        </div>
                        
                        <p>Your reservation is now confirmed! We look forward to welcoming you to Tito Renz Resort.</p>
                        <p>Best regards,<br>The Tito Renz Resort Team</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
                        <p>&copy; ${new Date().getFullYear()} Tito Renz Resort. All rights reserved.</p>
                    </div>
                </div>
            `;
            await emailService.sendGenericEmail(reservation.email, emailSubject, emailBody);
        } catch (emailError) {
            console.error('Email sending failed for partial approval:', emailError.message);
        }

        res.status(200).json({
            success: true,
            message: `50% down payment for reservation ${id} approved. Status set to partially-paid.`,
            reservation: reservationsToUpdate[0]
        });
    } catch (error) {
        console.error('SERVER ERROR approving partial payment:', error);
        res.status(500).json({
            message: 'Internal server error while approving partial payment.',
            details: error.message
        });
    }
};

/**
 * Approves the full payment (100%) for a reservation (either remaining 50% after partial, or full 100%)
 */
exports.approveFullPayment = async (req, res) => {
    try {
        const { id } = req.params;
        const { paymentType } = req.body;

        if (!id) {
            return res.status(400).json({ message: 'Reservation ID is required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Allow approval if paymentStatus is either PENDING (legacy), full-payment (100% submitted), or partially-paid (remaining 50%)
        if (!['PENDING', 'full-payment', 'partially-paid'].includes(reservation.paymentStatus)) {
            return res.status(400).json({ message: `Cannot approve full payment for reservation ${id} with status: ${reservation.paymentStatus}` });
        }

        const isRemainingPayment = reservation.paymentStatus === 'partially-paid';

        let reservationsToUpdate = [reservation];
        if (reservation.isMultiAmenity && reservation.multiAmenityGroupId) {
            reservationsToUpdate = await Reservation.find({
                multiAmenityGroupId: reservation.multiAmenityGroupId
            }).sort({ multiAmenityIndex: 1 });
        }

        for (const r of reservationsToUpdate) {
            r.paymentStatus = 'fully-paid';
            r.status = 'CONFIRMED';
            r.paymentConfirmedAt = new Date();
            r.updatedAt = new Date();
            await r.save();
        }

        // Create private pool global lock for any private pool reservations
        for (const r of reservationsToUpdate) {
            await createPrivatePoolGlobalLock(r);
        }

        // Send full payment approval and QR code email
        try {
            const emailService = require('../utils/emailService');
            const serviceName = reservation.serviceName || 'Your Reservation';
            const checkInDate = new Date(reservation.check_in).toLocaleDateString();
            
            const hashes = reservationsToUpdate.map(r => r.reservationHash).filter(Boolean);
            const hashString = hashes.join(',');
            const confirmationUrl = `${process.env.FRONTEND_URL || 'http://localhost:3000'}/confirmation.html?hash=${encodeURIComponent(hashString)}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(hashString)}`;

            const emailSubject = isRemainingPayment 
                ? 'Full Payment Approved - Your QR Code is Ready' 
                : 'Payment Approved - Your QR Code is Ready';
            
            const emailBody = `
                <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto;">
                    <div style="background: linear-gradient(135deg, #28a745 0%, #20c997 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
                        <h1>✓ Payment Approved!</h1>
                    </div>
                    <div style="background: #f9f9f9; padding: 30px; border-radius: 0 0 10px 10px;">
                        <h2>Hi ${reservation.full_name},</h2>
                        <p>${isRemainingPayment ? 'Thank you for completing the remaining payment!' : 'Your full payment has been verified and approved.'}</p>
                        <p>Your reservation is now fully paid and confirmed. Please use the QR code below for check-in.</p>
                        
                        <div style="background: white; padding: 20px; margin: 20px 0; text-align: center; border-radius: 5px; border: 2px solid #28a745;">
                            <p style="color: #666; margin: 0 0 15px 0; font-size: 14px;">Your Check-in QR Code</p>
                            <img src="${qrImageUrl}" alt="Reservation QR Code" style="width: 220px; height: 220px; border-radius: 5px;" />
                            <p style="color: #666; margin: 15px 0 0 0; font-size: 12px;">Screenshot or save this code on your phone</p>
                        </div>
                        
                        <div style="background: white; padding: 20px; margin: 20px 0; border-radius: 5px; border-left: 4px solid #28a745;">
                            <h3 style="color: #28a745; margin-top: 0;">Reservation Details</h3>
                            <p><strong>Reservation ID:</strong> ${reservation.reservationId || 'N/A'}</p>
                            <p><strong>Service:</strong> ${serviceName}</p>
                            <p><strong>Check-in Date:</strong> ${checkInDate}</p>
                            <p><strong>Total Amount:</strong> ₱${reservation.finalTotal?.toFixed(2) || '0.00'}</p>
                            <p style="color: #28a745;"><strong>✓ Status: FULLY PAID</strong></p>
                        </div>
                        
                        <p>If the QR code image does not load, you can open it here:</p>
                        <p><a href="${confirmationUrl}" style="color: #667eea; text-decoration: none; word-break: break-all;">${confirmationUrl}</a></p>
                        
                        <div style="background: #d4edda; padding: 15px; border-radius: 5px; margin: 20px 0; border-left: 4px solid #28a745;">
                            <p style="margin: 0;"><strong>✓ What's Next?</strong></p>
                            <p style="margin: 10px 0 0 0;">Present this QR code at check-in. We're excited to welcome you to Tito Renz Resort!</p>
                        </div>
                        
                        <p>Thank you for choosing Tito Renz Resort!</p>
                        <p>Best regards,<br>The Tito Renz Resort Team</p>
                    </div>
                    <div style="text-align: center; margin-top: 20px; color: #888; font-size: 12px;">
                        <p>&copy; ${new Date().getFullYear()} Tito Renz Resort. All rights reserved.</p>
                    </div>
                </div>
            `;
            await emailService.sendGenericEmail(reservation.email, emailSubject, emailBody);
        } catch (emailError) {
            console.error('Email sending failed for full payment approval:', emailError.message);
        }

        res.status(200).json({
            success: true,
            message: `Full payment for reservation ${id} approved. Status set to fully-paid.`,
            reservation: reservationsToUpdate[0]
        });
    } catch (error) {
        console.error('SERVER ERROR approving full payment:', error);
        res.status(500).json({
            message: 'Internal server error while approving full payment.',
            details: error.message
        });
    }
};

/**
 * Handles GCash receipt upload and confirms payment for one or multiple reservations.
 */
exports.uploadReceipt = async (req, res) => {
    try {
        const { 
            reservationHash, 
            gcashReferenceNumber,
            totalAmount,
            downpaymentAmount,
            remainingBalance,
            paymentType 
        } = req.body;

        const receiptFile = req.file;

        if (!reservationHash || !gcashReferenceNumber || !receiptFile) {
            return res.status(400).json({ 
                success: false, 
                message: "Missing reservation hash, GCash reference, or receipt image." 
            });
        }

        // Handle both single hash and comma-separated hashes
        const hashes = reservationHash.split(',').map(h => h.trim()).filter(h => h !== '');

        if (hashes.length === 0) {
            return res.status(400).json({ success: false, message: "No valid reservation hashes provided." });
        }

        const reservations = await Reservation.find({ reservationHash: { $in: hashes } });

        if (reservations.length === 0) {
            return res.status(404).json({ success: false, message: "No reservations found for the provided hash(es)." });
        }

        // Check if any reservation is part of a multi-amenity group
        // If so, find ALL items in that group to update them together
        const multiAmenityGroupIds = reservations
            .filter(r => r.isMultiAmenity && r.multiAmenityGroupId)
            .map(r => r.multiAmenityGroupId);
        
        let allReservationsToUpdate = [...reservations];
        
        if (multiAmenityGroupIds.length > 0) {
            // Find all reservations in these multi-amenity groups
            const groupReservations = await Reservation.find({
                multiAmenityGroupId: { $in: multiAmenityGroupIds }
            });
            
            // Merge with existing reservations (avoid duplicates)
            const existingIds = new Set(reservations.map(r => r._id.toString()));
            groupReservations.forEach(gr => {
                if (!existingIds.has(gr._id.toString())) {
                    allReservationsToUpdate.push(gr);
                }
            });
            
            console.log(`📦 Multi-amenity group detected. Updating ${allReservationsToUpdate.length} items in group(s).`);
        }

        // Update each reservation
        const updatePromises = allReservationsToUpdate.map(async (reservation) => {
            if (['PAID', 'DOWNPAYMENT_PAID'].includes(reservation.paymentStatus)) {
                return reservation;
            }

            reservation.gcashReferenceNumber = gcashReferenceNumber;
            reservation.receiptFileName = receiptFile.filename;
            reservation.receiptUploadedAt = new Date();
            reservation.paymentType = paymentType || 'downpayment';
            
            // If it's a single reservation, we can set specific amounts if provided
            if (hashes.length === 1) {
                if (downpaymentAmount) {
                    // Strip non-numeric chars for storage
                    const cleanDownpayment = parseFloat(downpaymentAmount.toString().replace(/,/g, ''));
                    if (!isNaN(cleanDownpayment)) reservation.downpaymentAmount = cleanDownpayment;
                }
                if (remainingBalance) {
                    const cleanBalance = parseFloat(remainingBalance.toString().replace(/,/g, ''));
                    if (!isNaN(cleanBalance)) reservation.remainingBalance = cleanBalance;
                }
                if (totalAmount) {
                    const cleanTotal = parseFloat(totalAmount.toString().replace(/,/g, ''));
                    if (!isNaN(cleanTotal)) reservation.finalTotal = cleanTotal;
                }
            }

            // Set paymentStatus based on payment type
            if (paymentType === 'downpayment') {
                reservation.paymentStatus = 'partial-payment'; // 50% down payment submitted
            } else if (paymentType === 'full') {
                reservation.paymentStatus = 'full-payment'; // 100% full payment submitted
            } else {
                // Default/legacy: assume partial payment
                reservation.paymentStatus = 'partial-payment';
            }
            reservation.status = 'PENDING'; // Awaiting admin verification
            
            return reservation.save();
        });

        await Promise.all(updatePromises);

        console.log(`✅ Payment receipt processed for ${hashes.length} reservation(s):`, hashes);

        res.status(200).json({
            success: true,
            message: hashes.length > 1 
                ? "Payment proof submitted. Awaiting admin verification for all reservations." 
                : "Payment proof submitted. Awaiting admin verification.",
            hashesUpdated: hashes
        });

    } catch (error) {
        console.error("Error in uploadReceipt:", error);
        res.status(500).json({ success: false, message: "Internal server error during receipt upload." });
    }
};

// Log request bodies for debugging
const originalCreateReservation = exports.createReservation;
exports.createReservation = async (req, res) => {
    console.log('=== CREATE RESERVATION REQUEST ===');
    console.log('BODY:', JSON.stringify(req.body, null, 2));
    console.log('=== END REQUEST ===');
    return originalCreateReservation.call(this, req, res);
};
