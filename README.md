# Tito Renz Resort Norzagaray Reservation System
Welcome to the Tito Renz Resort Norzagaray Reservation System! This project is a comprehensive web-based application designed to manage resort operations, including reservations, payments, user management, and more.

### Made by Team Angat from IT235
### Contributors: Apuli, Jhazel John & Recio, John Michael
### Purpose: Made to comply to the requirements of the subject MCSPROJ.

## Table of Contents

- [Project Structure](#project-structure)
- [Setup Instructions](#setup-instructions)
- [Usage Instructions](#usage-instructions)
- [Folder Details](#folder-details)
- [Contributing](#contributing)
- [License](#license)

## Project Structure

The project is organized as follows:

```
index.html - Main landing page for the customer portal.
login.html - Login page for users.
register.html - Registration page for new users.
password-reset.html - Page for resetting user passwords.
confirmation.html - Email confirmation page.
contact.html - Contact form for customer inquiries.
customer-dashboard.html - Dashboard for customers to manage their reservations.
feedback.html - Page for customers to provide feedback.
help.html - Help and FAQ page.
my-reservations.html - Page for customers to view their reservations.
payment.html - Payment processing page.
reserve.html - Reservation form for booking services.
send-email-modal.html - Modal for sending emails.
services-list.html - Page displaying available resort services.
style.css - Global stylesheet for the frontend.

admin/
  admin-actions.html - Page for admin-specific actions.
  admin-dashboard.html - Main dashboard for administrators.
  admin-profile-modal.html - Modal for editing admin profiles.
  admin-promo-codes.html - Page for managing promotional codes.
  admin-reschedule.html - Page for rescheduling reservations.
  admin-reservations.html - Page for managing reservations.
  admin-schedule.html - Page for managing resort schedules.
  admin-services.html - Page for managing resort services.
  admin-users.html - Page for managing user accounts.
  checkin.html - Page for managing check-ins.
  payment-verifications.html - Page for verifying payments.
  admin-component-loader.js - Script for dynamically loading admin components.
  admin-reschedule.js - Script for rescheduling logic.
  admin-reservations.js - Script for reservation management.
  admin-schedule.js - Script for schedule management.
  admin-services.js - Script for managing services.
  admin-system.js - Core script for admin system functionalities.

feedback/
  (Contains feedback-related files for customer feedback management.)

manager/
  manager-dashboard.html - Dashboard for managers to oversee operations.
  manager-promo-codes.html - Page for managing promotional codes by managers.
  manager-reservations.html - Page for managing reservations by managers.
  manager-schedule.html - Page for managing schedules by managers.

resort/
  test.account_tbl.json - Sample data for user accounts.
  test.blockeddates.json - Sample data for blocked dates.
  test.promocodes.json - Sample data for promotional codes.
  test.reservations.json - Sample data for reservations.
  test.role_tbl.json - Sample data for user roles.
  test.services.json - Sample data for resort services.

trr-backend/
  server.js - Entry point for the backend server.
  package.json - Contains project metadata and dependencies.
  ALL_API_ROUTES.md - Documentation for all API routes.
  BACKEND_UPDATES.md - Notes on backend updates.
  MIGRATION_INSTRUCTIONS.md - Instructions for database migrations.
  config/
    servicesData.js - Configuration for services data.
  controllers/
    authController.js - Handles user authentication logic.
    blockedDateController.js - Manages blocked dates.
    contactController.js - Handles contact form submissions.
    promoCodeController.js - Manages promotional codes.
    reservationController.js - Handles reservation-related logic.
    serviceController.js - Manages resort services.
  middleware/
    authMiddleware.js - Middleware for authentication.
    index.js - Middleware index file.
    roleMiddleware.js - Middleware for role-based access control.
  models/
    Account.js - Mongoose model for user accounts.
    BlockedDate.js - Mongoose model for blocked dates.
    PromoCode.js - Mongoose model for promotional codes.
    Reservation.js - Mongoose model for reservations.
    Role.js - Mongoose model for user roles.
    Service.js - Mongoose model for resort services.
  routes/
    authRoutes.js - API routes for authentication.
    blockedDateRoutes.js - API routes for blocked dates.
    contactRoutes.js - API routes for contact form.
    (other route files for additional functionalities.)
  scripts/
    check-reservations.js - Script to check reservations.
    clear-duplicate-reservations.js - Script to clear duplicate reservations.
    fixBlockedDateIndex.js - Script to fix blocked date index.
    migrateServices.js - Script to migrate services.
  uploads/
    (Contains uploaded files.)
  utils/
    (Contains utility functions used across the backend.)
```

### Key Folders:

- **admin/**: Contains admin-related pages and scripts.
- **feedback/**: Handles feedback-related functionalities.
- **manager/**: Manager-specific pages and scripts.
- **resort/**: Contains JSON data for testing purposes.
- **trr-backend/**: Backend code for the system, including API routes, controllers, models, and utilities.

## Setup Instructions

### Prerequisites

- Node.js (v16 or later)
- MongoDB (v5.0 or later)
- Git

### Steps

1. Clone the repository:

   ```bash
   git clone <repository-url>
   cd tito-renz-resort-web-system-mern
   ```

2. Install dependencies for the backend:

   ```bash
   cd trr-backend
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

5. Open the frontend:
   - Open the `index.html` file in your browser to access the frontend.

## Usage Instructions

1. **Admin Panel**:
   - Navigate to `admin/admin-dashboard.html` to access the admin dashboard.
   - Manage users, reservations, and services.

2. **Manager Panel**:
   - Navigate to `manager/manager-dashboard.html` to access the manager dashboard.
   - Oversee reservations and schedules.

3. **Customer Portal**:
   - Open `index.html` to access the main customer-facing website.
   - Customers can make reservations, view amenities, and manage their bookings.

## Folder Details

Each folder contains a `README.md` file with specific details about its purpose and usage. Refer to those files for more information.

## Contributing

We welcome contributions! Please follow these steps:

1. Fork the repository.
2. Create a new branch for your feature or bug fix.
3. Commit your changes and push them to your fork.
4. Submit a pull request with a detailed description of your changes.

## License

This project is licensed under the MIT License. See the LICENSE file for details.
