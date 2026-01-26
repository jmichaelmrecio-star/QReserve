# API Routes Documentation

---

## Auth Routes (`/api/auth`)
- POST `/register` — Register a new user
- POST `/login` — User login
- POST `/verify-email` — Verify email address
- POST `/resend-verification` — Resend verification email
- POST `/request-password-reset` — Request password reset
- POST `/verify-password-otp` — Verify password reset OTP
- POST `/reset-password` — Reset password
- POST `/validate-password` — Validate password strength
- GET `/staff-token` — Generate staff check-in token
- POST `/admin/accounts/create` — Admin creates account
- PUT `/admin/accounts/:userId` — Admin updates account
- PUT `/admin/accounts/:userId/deactivate` — Admin deactivates account
- PUT `/admin/accounts/:userId/activate` — Admin activates account
- GET `/roles` — Get all roles
- PUT `/profile` — User updates own profile (auth required)

## Blocked Date Routes (`/api/blocked-dates`)
- POST `/` — Block a new date range
- GET `/` — Get all blocked date ranges (admin)
- GET `/active/list` — Get active/future blocked dates (public)
- DELETE `/:id` — Remove a blocked date

## Contact Routes (`/api/contact`)
- POST `/send-message` — Send a contact message
- GET `/health` — Contact service health check

## Promo Code Routes (`/api/promocodes`)
- POST `/create` — Create a new promo code
- GET `/all` — Get all promo codes
- GET `/active/list` — Get active promo codes
- DELETE `/:id` — Delete a promo code
- GET `/:code` — Lookup a promo code by code

## Reservation Routes (`/api/reservations`)
- POST `/send-email` — Send custom email for reservation (admin/manager)
- GET `/allreservation` — Get all reservations (public)
- GET `/pending` — Get pending reservations
- GET `/pending-payments` — Get pending payment verifications (admin/manager)
- POST `/create-reservation` — Create a reservation
- POST `/finalize-reservation` — Finalize a reservation
- GET `/details/:reservationId/:hash` — Get reservation details
- GET `/hash/:hash` — Get reservation by hash
- GET `/user/:email` — Get reservations for a user
- POST `/check-availability` — Check date/service availability
- GET `/service/:serviceId` — Get reservations by service
- GET `/admin/reports/generate` — Generate reservation reports
- PUT `/update-status/:id` — Update reservation status
- GET `/check-in/:reservationHash` — Staff check-in
- PUT `/:id/checkout` — Manual checkout override (admin/manager)
- GET `/:id` — Get reservation by ID
- PUT `/:id` — Update reservation status
- PATCH `/:id/approve-payment` — Approve payment (admin/manager)
- PATCH `/:id/reject-payment` — Reject payment (admin/manager)

## Service Routes (`/api/services`)
- GET `/` — Get all services
- GET `/:id` — Get service by ID
- POST `/calculate-price` — Calculate price for a service
- GET `/admin/all` — Get all services (admin)
- POST `/create` — Create a new service
- PUT `/:id` — Update a service
- PUT `/:id/activate` — Activate a service
- PUT `/:id/deactivate` — Deactivate a service
- DELETE `/:id` — Delete a service

## Hardcoded Services Routes (`/api/services-hardcoded`)
- GET `/` — Get all hardcoded services
- GET `/:id` — Get a hardcoded service by ID
- POST `/calculate-price` — Calculate price for a hardcoded service

---