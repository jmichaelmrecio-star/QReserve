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
        // Extract the sequence number from the last reservation ID
        const lastId = todaysReservations[0].reservationId;
        const match = lastId.match(/-(\d{3})$/);
        if (match) {
            sequenceNumber = parseInt(match[1]) + 1;
        }
    }
    
    const formattedSequence = String(sequenceNumber).padStart(3, '0');
    return `${datePrefix}-${formattedSequence}`;
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

        const newReservation = new Reservation({
            accountId,
            serviceId,
            serviceType,
            full_name: customer_name,
            check_in: new Date(checkin_date),
            check_out: new Date(checkout_date),
            guests: number_of_guests,
            phone: customer_contact,
            email: customer_email,
            address: customer_address,
            basePrice,
            finalTotal,
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
            const match = r.reservationId.match(/-(\d{3})$/);
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
                return res.status(400).json({
                    success: false,
                    message: `This service is unavailable from ${blockStartStr} to ${blockEndStr}. Reason: ${block.reason || 'Maintenance/Closure'}`
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
        const newReservation = new Reservation({
            accountId,
            serviceId,
            serviceType,
            full_name: fullName,
            check_in: checkIn,
            check_out: checkOut,
            guests: numberOfGuests,
            phone: contactNumber,
            email: reservationEmail,
            address,
            basePrice: expectedBasePrice,
            finalTotal: expectedFinalTotal,
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
            status: 'CART', 
            paymentStatus: 'CART',
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
        if (reservation.paymentStatus === 'PAID' && reservation.status !== 'PENDING') {
            // Use 409 Conflict status code
            return res.status(409).json({ success: false, message: "Reservation is already confirmed or payment has been processed." });
        }

        // 5. Update the payment and reservation statuses
        reservation.gcashReferenceNumber = gcashReferenceNumber;
        
        // Store only receipt file name, not base64 image
        reservation.receiptFileName = receiptFileName || 'receipt.jpg';
        reservation.receiptUploadedAt = new Date();
        
        // Handle downpayment or full payment
        if (paymentType === 'downpayment' && downpaymentAmount) {
            reservation.paymentStatus = 'DOWNPAYMENT_PAID';
            reservation.totalAmount = totalAmount;
            reservation.downpaymentAmount = downpaymentAmount;
            reservation.remainingBalance = remainingBalance;
            reservation.paymentType = 'downpayment';
            reservation.status = 'PENDING'; // Mark as PENDING after checkout, admin will mark as PAID
        } else {
            reservation.paymentStatus = 'PAID'; // Payment is complete, but status is still PENDING for admin approval
            reservation.status = 'PENDING';
        }
        
        // Save the updated reservation
        const updatedReservation = await reservation.save();

        // 6. Success Response
        res.status(200).json({
            success: true,
            message: paymentType === 'downpayment' 
                ? "Downpayment confirmed. Remaining balance will be paid upon check-in."
                : "Payment confirmed and reservation finalized.",
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

        // B. Robust Search Logic
        const query = { reservationHash: hash };
        
        if (mongoose.isValidObjectId(reservationId)) {
            // Priority: MongoDB Internal ID
            query._id = reservationId;
        } else {
            // Fallback: Formal string ID (e.g. TRR-20260121-001)
            query.reservationId = reservationId;
        }

        const reservation = await Reservation.findOne(query);

        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found or invalid access.' });
        }

        // 2. Return the necessary data for the summary
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
        const { serviceId, checkin_date, checkout_date } = req.body;
        
        if (!serviceId || !checkin_date || !checkout_date) {
            return res.status(400).json({ 
                message: 'Missing required fields', 
                available: true 
            });
        }
        
        const checkin = new Date(checkin_date);
        const checkout = new Date(checkout_date);
        
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
        
        res.json({ 
            available: overlapping.length === 0, 
            conflictingReservations: overlapping.length 
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
        const pendingPayments = await Reservation.find({
            paymentStatus: 'PENDING',
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
        const { paymentStatus, status } = req.body; // Expecting 'PAID' or 'DOWNPAYMENT_PAID'

        if (!id || !paymentStatus || !status) {
            return res.status(400).json({ message: 'Reservation ID, paymentStatus, and status are required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Only allow approval if current paymentStatus is PENDING
        if (reservation.paymentStatus !== 'PENDING') {
            return res.status(400).json({ message: `Payment for reservation ${id} is already ${reservation.paymentStatus}.` });
        }

        reservation.paymentStatus = paymentStatus;
        reservation.status = status; // Update main status to PAID
        reservation.updatedAt = new Date();

        await reservation.save();

        res.status(200).json({
            success: true,
            message: `Payment for reservation ${id} approved and status set to ${paymentStatus}.`,
            reservation
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
        const { paymentStatus, status } = req.body; // Expecting 'REJECTED'

        if (!id || !paymentStatus || !status) {
            return res.status(400).json({ message: 'Reservation ID, paymentStatus, and status are required.' });
        }

        const reservation = await Reservation.findById(id);
        if (!reservation) {
            return res.status(404).json({ message: 'Reservation not found.' });
        }

        // Only allow rejection if current paymentStatus is PENDING
        if (reservation.paymentStatus !== 'PENDING') {
            return res.status(400).json({ message: `Payment for reservation ${id} is already ${reservation.paymentStatus}.` });
        }

        reservation.paymentStatus = paymentStatus;
        reservation.status = status; // Revert to PENDING or set to a 'payment_rejected' status
        reservation.updatedAt = new Date();

        await reservation.save();

        res.status(200).json({
            success: true,
            message: `Payment for reservation ${id} rejected. Status set to ${paymentStatus}.`,
            reservation
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

        // Update each reservation
        const updatePromises = reservations.map(async (reservation) => {
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

            reservation.paymentStatus = (paymentType === 'full' ? 'PAID' : 'DOWNPAYMENT_PAID');
            reservation.status = 'PAID'; // Mark as PAID to allow check-in/admin approval flow
            
            return reservation.save();
        });

        await Promise.all(updatePromises);

        console.log(`✅ Payment receipt processed for ${hashes.length} reservation(s):`, hashes);

        res.status(200).json({
            success: true,
            message: hashes.length > 1 
                ? "Multiple reservations updated with payment proof." 
                : "Payment confirmed and reservation finalized.",
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
