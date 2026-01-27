const express = require('express');
const router = express.Router();
const serviceController = require('../controllers/serviceController');
const multer = require('multer');
const path = require('path');
const uploadDir = path.join(__dirname, '../uploads');
const fs = require('fs');
if (!fs.existsSync(uploadDir)) {
	fs.mkdirSync(uploadDir);
}
const storage = multer.diskStorage({
	destination: function (req, file, cb) {
		cb(null, uploadDir);
	},
	filename: function (req, file, cb) {
		const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
		cb(null, uniqueSuffix + path.extname(file.originalname));
	}
});
const upload = multer({ storage: storage });

// Public routes
router.get('/', serviceController.getAllServices);
router.get('/:id', serviceController.getServiceById);
router.post('/calculate-price', serviceController.calculatePrice);

// Admin routes (TODO: Add auth middleware)
router.get('/admin/all', serviceController.getAllServicesAdmin); // Get all services including inactive
router.post('/create', upload.fields([
	{ name: 'image', maxCount: 1 },
	{ name: 'gallery', maxCount: 10 }
]), serviceController.createService);
router.put('/:id', upload.fields([
	{ name: 'image', maxCount: 1 },
	{ name: 'gallery', maxCount: 10 }
]), serviceController.updateService);
router.put('/:id/activate', serviceController.activateService);
router.put('/:id/deactivate', serviceController.deleteService);
router.delete('/:id', serviceController.deleteService);

module.exports = router;
