// Load environment variables from .env file
require('dotenv').config();

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const bcrypt = require('bcrypt');
const multer = require('multer');
const path = require('path');
// ...existing code...
const fs = require('fs');
const app = express();
const PORT = process.env.PORT || 3000;

// --- MULTER SETUP (for file uploads) ---
const uploadDir = path.join(__dirname, 'uploads');
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


// --- MIDDLEWARE ---
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// --- DATABASE CONNECTION AND SERVER STARTUP ---
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });
    console.log('MongoDB connected');
    app.listen(PORT, () => {
      console.log(`Server running on http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('Database connection failed:', error.message);
    // Exit process with failure code
    process.exit(1);
  }
};

// Execute the connection function
connectDB();

// Import the Reservation Model
const Reservation = require('./models/Reservation');
const Account = require('./models/Account'); // <-- NEW: Your Account model
const Role = require('./models/Role');     // <-- NEW: Your Role model
const reservationRoutes = require('./routes/reservationRoutes');
const promoCodeRoutes = require('./routes/promoCodeRoutes');
const blockedDateRoutes = require('./routes/blockedDateRoutes');
const authRoutes = require('./routes/authRoutes');
const serviceRoutes = require('./routes/serviceRoutes');
const contactRoutes = require('./routes/contactRoutes');
// Note the '..' path to go up one directory from trr-backend to new website
app.use(express.static(path.join(__dirname, '..'))); // <--- CORRECTED PATH!
require('./models/BlockedDate');
app.use('/api/auth', authRoutes);

// USE THE NEW PROMO CODE ROUTE
app.use('/api/promocodes', promoCodeRoutes);
app.use('/api/blocked-dates', blockedDateRoutes);
app.use('/api/contact', contactRoutes);

// Service management (all routes now use MongoDB database)
app.use('/api/services', serviceRoutes);

app.use('/api/reservations', reservationRoutes);

// --- ROUTES (API Endpoints) ---

// Basic test route (still works on /)
app.get('/', (req, res) => {
  res.send('Tito Renz Resort API is running!');
});

// GET /api/reservations/user/:email: Fetches all reservations for a specific user
app.get('/api/reservations/user/:email', async (req, res) => {
    try {
        // 1. Get the email parameter from the URL
        const userEmail = req.params.email;

        // 2. Find all reservations in MongoDB matching the user's email
        // We use .find() to get an array of reservations
        const userReservations = await Reservation.find({ email: userEmail })
            .sort({ reservationDate: -1 }); // Sort by newest first

        // 3. Send the array back to the client
        res.status(200).json(userReservations);

    } catch (error) {
        console.error('Failed to fetch user reservations:', error.message);
        res.status(500).json({
            message: 'Server error while fetching reservation history.',
            error: error.message
        });
    }
});

// server.js - New GET route for fetching all accounts
app.get('/api/users', async (req, res) => {
    // 💡 Security Note: In a real-world app, you would add middleware here
    // to verify the user making this request is authenticated and has an 'Admin' or 'Manager' role.

    try {
        // Find ALL users, but explicitly exclude the sensitive 'password' field.
        // We also want to select the role_id, which we will use to find the role name on the frontend
        const users = await Account.find().select('-password'); 
        
        res.status(200).json(users);
        
    } catch (error) {
        console.error('Failed to fetch user list:', error.message);
        res.status(500).json({ message: 'Server error fetching user data.' });
    }
});

// server.js - PUT route to update a user's role
app.put('/api/users/:id/role', async (req, res) => {
    const userId = req.params.id;
    // We expect the new role name (e.g., 'Admin', 'Customer') in the request body
    const { newRoleName } = req.body; 

    // Note: Future security check for 'Admin' role goes here.

    try {
        // 1. Find the new role's ID based on the name provided
        const role = await Role.findOne({ role_name: newRoleName });
        if (!role) {
            return res.status(404).json({ message: 'Target role not found.' });
        }

        // 2. Update the user's role_id in the Account collection
        const updatedUser = await Account.findByIdAndUpdate(
            userId,
            { role_id: role._id },
            { new: true, select: '-password' } // Return the updated document, excluding password
        );

        if (!updatedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 3. Success response
        res.json({ 
            message: `User ${updatedUser.email} role updated to ${newRoleName}.`, 
            user: updatedUser 
        });

    } catch (error) {
        console.error('Error changing user role:', error.message);
        res.status(500).json({ message: 'Server error during role update.' });
    }
});

// server.js - New DELETE route to remove a user account
app.delete('/api/users/:id', async (req, res) => {
    const userId = req.params.id;
    
    // 💡 Security: Admin role check should go here.

    try {
        // 1. Find and remove the user by ID
        const deletedUser = await Account.findByIdAndDelete(userId);

        if (!deletedUser) {
            return res.status(404).json({ message: 'User not found.' });
        }

        // 2. Success response
        res.json({ 
            message: `User with ID ${userId} successfully deleted.`,
            user: deletedUser
        });

    } catch (error) {
        console.error('Error deleting user:', error.message);
        res.status(500).json({ message: 'Server error during user deletion.' });
    }
});


// --- NEW VIEW ROUTES ---
// The files are located in the parent directory (..)
app.get('/reserve.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'reserve.html'));
});

app.get('/payment.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'payment.html'));
});

app.get('/confirmation.html', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'confirmation.html'));
});
// -----------------------



// server.js - Route for GCash receipt upload
const reservationController = require('./controllers/reservationController');
app.post('/api/payment/upload', upload.single('receiptImage'), reservationController.uploadReceipt);

// We will add your PayMongo integration and other GET routes later...