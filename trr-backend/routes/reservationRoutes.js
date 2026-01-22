
// --- routes/reservationRoutes.js (Example) ---
const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation'); // Import your Mongoose model
// Assuming you have a reservationController file:
const reservationController = require('../controllers/reservationController');
// --- ADD THIS LINE ---
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { requireAdmin, requireAdminOrManager, requireCustomer } = require('../middleware/roleMiddleware');// --- CRITICAL FIX: Place SPECIFIC routes FIRST ---

// Get all reservations (public)
router.get('/allreservation', reservationController.getAllReservations);

// --- 1. NEW ROUTE (Specific name: 'pending') - MUST be first!
router.get('/pending', reservationController.getPendingReservations);

// --- NEW ROUTE (Specific name: 'pending-payments') - MUST be first!
router.get('/pending-payments', verifyToken, requireRole('Admin', 'Manager'), reservationController.getPendingPaymentVerifications);

// --- 2. MULTIPLE PARAMETER/DETAIL ROUTES (Must come before generic /:id) ---
router.post('/create-reservation', reservationController.createReservation);
router.post('/finalize-reservation', reservationController.finalizeReservation);

// FIX: This route needs to be higher up, above the generic /:id route!
router.get('/details/:reservationId/:hash', reservationController.getReservationDetails);
// NEW: Route for public access to reservation details using a short hash
router.get('/hash/:hash', reservationController.getReservationByHash)

// This user-specific route should also be above /:id
router.get('/user/:email', reservationController.getUserReservations);

// NEW: Routes for date validation and availability
router.post('/check-availability', reservationController.checkAvailability);
router.get('/service/:serviceId', reservationController.getReservationsByService);

// Admin/Staff specific routes
router.get(
    '/admin/reports/generate',
    reservationController.generateReports
);// Adding the PUT routes for completeness and order:
router.put('/update-status/:id', reservationController.updateReservationStatus);
router.patch(
    '/check-in/:reservationHash', 
    verifyToken, // <-- STEP 1: Authenticate via JWT
    requireRole('Staff', 'Admin', 'Manager'), // <-- STEP 2: Authorize role
    reservationController.staffCheckIn
);

// Manual Checkout Override Route (Admin/Manager Only)
router.put(
    '/:id/checkout',
    verifyToken, // JWT Authentication
    requireRole('Admin', 'Manager'), // Only Admin and Manager can checkout
    reservationController.checkoutReservation
);

// --- 3. GENERIC SINGLE PARAMETER ROUTES (Must be last) ---

// This route must be last to avoid catching more specific routes like '/details'
router.get('/:id', reservationController.getReservationById);
router.put('/:id', reservationController.updateReservationStatus);

// New route to approve a payment
router.patch(
    '/:id/approve-payment',
    verifyToken,
    requireRole('Admin', 'Manager'),
    reservationController.approvePayment
);

// New route to reject a payment
router.patch(
    '/:id/reject-payment',
    verifyToken,
    requireRole('Admin', 'Manager'),
    reservationController.rejectPayment
);


module.exports = router;