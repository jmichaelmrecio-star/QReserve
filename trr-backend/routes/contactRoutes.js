const express = require('express');
const router = express.Router();
const contactController = require('../controllers/contactController');

/**
 * Contact Routes
 * Handle contact form submissions and inquiries
 */

// POST: Send a contact message
router.post('/send-message', contactController.sendContactMessage);

// GET: Health check for contact service
router.get('/health', contactController.contactServiceHealth);

module.exports = router;
