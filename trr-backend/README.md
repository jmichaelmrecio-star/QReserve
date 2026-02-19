# Backend (trr-backend)

This folder contains the backend code for the Tito Renz Resort Web System. The backend is built using Node.js and Express.js, and it handles the API, database interactions, and server-side logic.

## Files and Directories

- **server.js**: Entry point for the backend server.
- **package.json**: Contains project metadata and dependencies.
- **config/**: Configuration files for the backend.
  - **servicesData.js**: Configuration for services data.
- **controllers/**: Contains controller files for handling API logic.
  - **authController.js**: Handles authentication-related logic.
  - **blockedDateController.js**: Manages blocked dates.
  - **contactController.js**: Handles contact form submissions.
  - **promoCodeController.js**: Manages promo codes.
  - **reservationController.js**: Handles reservation-related logic.
  - **serviceController.js**: Manages resort services.
- **middleware/**: Middleware functions for authentication and role-based access control.
  - **authMiddleware.js**: Middleware for authentication.
  - **roleMiddleware.js**: Middleware for role-based access.
  - **index.js**: Middleware index file.
- **models/**: Mongoose models for MongoDB collections.
  - **Account.js**: Model for user accounts.
  - **BlockedDate.js**: Model for blocked dates.
  - **PromoCode.js**: Model for promo codes.
  - **Reservation.js**: Model for reservations.
  - **Role.js**: Model for user roles.
  - **Service.js**: Model for resort services.
- **routes/**: API route definitions.
  - **authRoutes.js**: Routes for authentication.
  - **blockedDateRoutes.js**: Routes for blocked dates.
  - **contactRoutes.js**: Routes for contact form.
  - ...
- **scripts/**: Utility scripts for database migrations and maintenance.
  - **check-reservations.js**: Script to check reservations.
  - **clear-duplicate-reservations.js**: Script to clear duplicate reservations.
  - **fixBlockedDateIndex.js**: Script to fix blocked date index.
  - **migrateServices.js**: Script to migrate services.
- **uploads/**: Directory for uploaded files.
- **utils/**: Utility functions used across the backend.

## Setup Instructions

1. Navigate to the `trr-backend` folder:

   ```bash
   cd trr-backend
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Set up the environment variables:
   - Create a `.env` file in the `trr-backend` folder.
   - Add the following variables:
     ```env
     MONGO_URI=<your-mongodb-connection-string>
     JWT_SECRET=<your-jwt-secret>
     PORT=5000
     ```

4. Start the backend server:
   ```bash
   npm start
   ```

## API Documentation

Refer to the [ALL_API_ROUTES.md](ALL_API_ROUTES.md) file for detailed API documentation.

## Notes

- Ensure MongoDB is running and accessible before starting the server.
- Use the provided scripts in the `scripts/` folder for database maintenance and migrations.
