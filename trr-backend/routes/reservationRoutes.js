// Check for duplicate reservation or cart item for the same user, service, and date range
// ...existing code...
// ...existing code...

// --- routes/reservationRoutes.js (Example) ---
const express = require('express');
const router = express.Router();
const Reservation = require('../models/Reservation'); // Import your Mongoose model
// Assuming you have a reservationController file:
const reservationController = require('../controllers/reservationController');
// --- ADD THIS LINE ---
const { verifyToken, requireRole } = require('../middleware/authMiddleware');
const { requireAdmin, requireAdminOrManager, requireCustomer } = require('../middleware/roleMiddleware');// --- CRITICAL FIX: Place SPECIFIC routes FIRST ---

// Send custom email to customer for a reservation
router.post('/send-email', reservationController.sendCustomEmail);

// Get all reservations (public)
router.get('/allreservation', reservationController.getAllReservations);

// --- 1. NEW ROUTE (Specific name: 'pending') - MUST be first!
router.get('/pending', reservationController.getPendingReservations);

// --- NEW ROUTE (Specific name: 'pending-payments') - MUST be first!
router.get('/pending-payments', reservationController.getPendingPaymentVerifications);

// --- 2. MULTIPLE PARAMETER/DETAIL ROUTES (Must come before generic /:id) ---
router.post('/create-reservation', reservationController.createReservation);
router.post('/create-multi-amenity', reservationController.createMultiAmenityReservation);
router.post('/finalize-reservation', reservationController.finalizeReservation);

// FIX: This route needs to be higher up, above the generic /:id route!
router.get('/details/:reservationId/:hash', reservationController.getReservationDetails);
// NEW: Route for public access to reservation details using a short hash
router.get('/hash/:hash', reservationController.getReservationByHash)

// This user-specific route should also be above /:id
router.get('/user/:email', reservationController.getUserReservations);

// NEW: Routes for date validation and availability
router.post('/check-availability', reservationController.checkAvailability);
router.post('/check-service-types-availability', reservationController.checkServiceTypesAvailability);
router.get('/service/:serviceId', reservationController.getReservationsByService);

// Admin/Staff specific routes
router.get(
    '/admin/reports/generate',
    reservationController.generateReports
);// Adding the PUT routes for completeness and order:
router.put('/update-status/:id', reservationController.updateReservationStatus);

// Customer cancellation request with reason
router.put('/request-cancel/:id', reservationController.requestCancellation);
router.get(
    '/check-in/:reservationHash', 
    reservationController.staffCheckIn
);

// Manual Checkout Override Route (Admin/Manager Only)
router.put(
    '/:id/checkout',
    reservationController.checkoutReservation
);

// --- 3. GENERIC SINGLE PARAMETER ROUTES (Must be last) ---

// This route must be last to avoid catching more specific routes like '/details'
router.get('/:id', reservationController.getReservationById);
router.put('/:id', reservationController.updateReservationStatus);
// --- CART API ENDPOINTS ---
// Get all cart items for logged-in user
router.get('/cart', verifyToken, reservationController.getCartItems);

// Add item to cart for logged-in user
router.post('/cart', verifyToken, reservationController.addCartItem);

// Remove item from cart for logged-in user
router.delete('/cart/:id', verifyToken, reservationController.removeCartItem);
router.post('/cart/check-duplicate', verifyToken, reservationController.checkCartDuplicate);

// New route to approve a payment
router.patch(
    '/:id/approve-payment',
    verifyToken,
    requireRole('Admin', 'Manager'),
    reservationController.approvePayment
);

// New route to approve partial payment (50% down payment)
router.patch(
    '/:id/approve-partial',
    verifyToken,
    requireRole('Admin', 'Manager'),
    reservationController.approvePartialPayment
);

// New route to approve full payment (100% or remaining 50%)
router.patch(
    '/:id/approve-full',
    verifyToken,
    requireRole('Admin', 'Manager'),
    reservationController.approveFullPayment
);

// New route to reject a payment
router.patch(
    '/:id/reject-payment',
    verifyToken,
    requireRole('Admin', 'Manager'),
    reservationController.rejectPayment
);

// Admin cleanup endpoint - TEMPORARY (should be protected in production)
router.delete('/admin/cleanup/today', async (req, res) => {
    try {
        const today = new Date();
        const year = today.getFullYear();
        const month = String(today.getMonth() + 1).padStart(2, '0');
        const day = String(today.getDate()).padStart(2, '0');
        const datePrefix = `TRR-${year}${month}${day}`;

        const Reservation = require('../models/Reservation');
        const result = await Reservation.deleteMany({
            reservationId: { $regex: `^${datePrefix}` }
        });

        res.json({
            success: true,
            message: `Deleted ${result.deletedCount} test reservations from today`,
            deletedCount: result.deletedCount,
            datePrefix: datePrefix
        });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;