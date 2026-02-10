const mongoose = require('mongoose');

// Define the structure of a Reservation document
const ReservationSchema = new mongoose.Schema({
    // Guest Information
    full_name: { type: String, required: true },
    email: { type: String, required: true },
    phone: { type: String, required: true },

    // This field links to the Account model, but is optional (null for guests)
    accountId: { 
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Account',
        required: false, // <-- CRITICAL: Set to false
        default: null     // <-- Set default to null
    },
    
    // Reservation Details
    serviceId: { type: String, required: true },
    serviceType: { type: String, required: true },
    serviceName: { type: String, required: false }, // Human-readable service name for display
    check_in: { type: Date, required: true }, // Store as a Date object for easy sorting/comparison
    check_out: { type: Date, required: true }, // <-- RE-ADDED
    guests: { type: Number, required: true },    // <-- RE-ADDED
    address: { type: String, required: false }, // Address from the form
    
    // Duration & Time Slot Details (for duration-based pricing)
    selectedDuration: { type: String, required: false }, // e.g., 'duration_12h', 'duration_22h'
    selectedTimeSlot: { type: String, required: false }, // e.g., 'slot_day_30_40' for pool area
    durationLabel: { type: String, required: false }, // e.g., '12 Hours', 'Day (7am - 5pm) - 30 to 40 pax'
    inclusions: { type: [String], default: [] }, // Array of included amenities/services
    
    // Financial Data (Crucial for DFD 8.0)
    basePrice: { type: Number, required: true },
    discountCode: { type: String },
    discountValue: { type: Number, default: 0 },
    finalTotal: { type: Number, required: true },
    
    // Downpayment Information
    totalAmount: { type: Number, required: false }, // Total reservation cost
    downpaymentAmount: { type: Number, required: false }, // Amount paid as downpayment
    remainingBalance: { type: Number, required: false }, // Amount remaining to be paid
    paymentType: { type: String, enum: ['full', 'downpayment'], default: 'downpayment' }, // Payment type
    
    // System Status
    dateCreated: {
        type: Date,
        default: Date.now, // Automatically set the date
        // REMOVE 'required: true' if it exists
    },
    status: { type: String, default: 'pending' }, // e.g., 'pending', 'confirmed', 'cancelled'
    
    // Check-in and Check-out Tracking
    checkInTime: { type: Date, required: false }, // Time when guest checked in
    checkOutTime: { type: Date, required: false }, // Time when guest checked out
    checkoutPerformedBy: { type: String, required: false }, // Email/ID of admin who performed checkout

    // CRITICAL: DOES THIS FIELD EXIST IN YOUR SCHEMA?
    gcashReferenceNumber: {
        type: String,
        required: false, // It's optional for old reservations, but present for new ones
        trim: true,
        default: null
    },

    // *** CRITICAL FIX: Renamed field to match controller lookup ***
    reservationHash: { 
        type: String,
        required: false, // Will be generated and set upon creation
        unique: true,
        sparse: true, // Allows null values but enforces uniqueness for non-null values
    },
    
    // Formal Reservation ID (Human-readable format: TRR-YYYYMMDD-###)
    reservationId: {
        type: String,
        required: false,
        unique: true,
        sparse: true,
    },
    
    // Payment Data
    paymentRef: { type: String }, // Now less critical, will be replaced by PayMongo ID
    paymentStatus: { type: String, default: 'pending' }, // e.g., 'pending', 'paid', 'failed'
    
    // GCash Receipt Image (for payment proof)
    receiptImage: {
        type: String, // Base64 encoded image or file path
        required: false,
    },
    receiptFileName: {
        type: String,
        required: false,
    },
    receiptUploadedAt: {
        type: Date,
        required: false,
    },
    paymentConfirmedAt: {
        type: Date,
        required: false,
    },
    
    // QR Code Data
    qrCodeData: { type: String },
    
    // Multi-Amenity Reservation Fields
    isMultiAmenity: { 
        type: Boolean, 
        default: false // True if this reservation is part of a multi-amenity booking
    },
    multiAmenityGroupId: { 
        type: mongoose.Schema.Types.ObjectId, 
        required: false // Common ID shared by all amenities in the same booking
    },
    multiAmenityIndex: { 
        type: Number, 
        required: false // Position of this amenity in the group (0-indexed)
    },
    multiAmenityTotal: { 
        type: Number, 
        required: false // Total number of amenities in the group
    },
    multiAmenityGroupPrimary: { 
        type: Boolean, 
        default: false // True for the first item in a multi-amenity group (holds total pricing)
    },
    checkInTimeSlot: { 
        type: String, 
        required: false // Time slot for check-in (e.g., "8", "14", "20" or "8:00 AM")
    },
    checkOutTimeSlot: { 
        type: String, 
        required: false // Time slot for check-out (e.g., "6:00 AM", "8:00 PM")
    }
});

module.exports = mongoose.model('Reservation', ReservationSchema);