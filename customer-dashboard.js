/**
 * Customer Dashboard View Component
 * Provides a customer-focused interface within the admin dashboard
 */

// Initialize customer dashboard view
function initCustomerDashboard() {
    const customerView = document.getElementById('customer-view-section');
    if (!customerView) return;

    loadCustomerReservations();
    loadCustomerProfile();
}

// Load customer's reservations
async function loadCustomerReservations() {
    // ADMIN: Show all reservations if admin, else show only user reservations
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const userRole = localStorage.getItem('qreserve_user_role');
    let reservations = [];
    try {
        let response;
        if (userRole === 'admin' || userRole === 'manager') {
            response = await fetch('http://localhost:3000/api/reservations/allreservation');
            const data = await response.json();
            const allReservations = data.reservations || [];
            // Filter out CART items - only show paid/confirmed reservations
            reservations = allReservations.filter(res => 
                res.status && res.status.toUpperCase() !== 'CART'
            );
        } else {
            if (!user.email) {
                console.error('No user email found');
                return;
            }
            response = await fetch(`http://localhost:3000/api/reservations/user/${user.email}`);
            const allReservations = await response.json();
            // Filter out CART items - only show paid/confirmed reservations
            reservations = allReservations.filter(res => 
                res.status && res.status.toUpperCase() !== 'CART'
            );
        }
        displayCustomerReservations(reservations);
    } catch (error) {
        console.error('Error loading customer reservations:', error);
        showToast('Failed to load your reservations', 'error');
    }
}

// Display customer reservations in a user-friendly format
function displayCustomerReservations(reservations) {
    const container = document.getElementById('customer-reservations-list');
    if (!container) return;

    if (reservations.length === 0) {
        container.innerHTML = `
            <div class="alert alert-info">
                <h4>No Reservations Yet</h4>
                <p>You haven't made any reservations yet. Browse our services to get started!</p>
                <a href="services-list.html" class="btn btn-primary mt-3">Browse Services</a>
            </div>
        `;
        return;
    }

    // For admin/manager, show all in a table with all fields
    const userRole = localStorage.getItem('qreserve_user_role');
    if (userRole === 'admin' || userRole === 'manager') {
        container.innerHTML = `
            <table class="data-table">
                <thead>
                    <tr>
                        <th>Reservation ID</th>
                        <th>Guest Name</th>
                        <th>Email</th>
                        <th>Service Type</th>
                        <th>Check-in</th>
                        <th>Check-out</th>
                        <th>Total Amount</th>
                        <th>Status</th>
                        <th>GCash Ref #</th>
                        <th>Payment Image</th>
                    </tr>
                </thead>
                <tbody>
                    ${reservations.map(r => `
                        <tr>
                            <td>${r.reservationId || r._id}</td>
                            <td>${r.full_name || ''}</td>
                            <td>${r.email || ''}</td>
                            <td>${r.serviceType || ''}</td>
                            <td>${r.check_in ? new Date(r.check_in).toLocaleString() : ''}</td>
                            <td>${r.check_out ? new Date(r.check_out).toLocaleString() : ''}</td>
                            <td>₱${r.finalTotal ? parseFloat(r.finalTotal).toLocaleString() : '0.00'}</td>
                            <td>${r.status || ''}</td>
                            <td>${r.gcashReferenceNumber || ''}</td>
                            <td>${r.receiptFileName ? `<a href="/uploads/${r.receiptFileName}" target="_blank">View Image</a>` : 'N/A'}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
        return;
    }

    // For customers, show reservations as cards
    container.innerHTML = reservations.map(reservation => `
        <div class="reservation-card mb-3 p-3 border rounded shadow-sm">
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <strong>Reservation ID:</strong> ${reservation.reservationId || reservation._id}<br>
                    <strong>Name:</strong> ${reservation.full_name || ''}<br>
                    <strong>Email:</strong> ${reservation.email || ''}<br>
                    <strong>Service:</strong> ${reservation.serviceType || ''}<br>
                    <strong>Check-in:</strong> ${reservation.check_in ? new Date(reservation.check_in).toLocaleString() : ''}<br>
                    <strong>Check-out:</strong> ${reservation.check_out ? new Date(reservation.check_out).toLocaleString() : ''}<br>
                    <strong>Total:</strong> ₱${reservation.finalTotal ? parseFloat(reservation.finalTotal).toLocaleString() : '0.00'}<br>
                    <strong>Status:</strong> <span class="badge bg-${getStatusColor(reservation.status)}">${reservation.status || ''}</span><br>
                    <strong>GCash Ref #:</strong> ${reservation.gcashReferenceNumber || 'N/A'}<br>
                </div>
                <div>
                    ${reservation.receiptFileName ? `<a href="/uploads/${reservation.receiptFileName}" target="_blank"><img src="/uploads/${reservation.receiptFileName}" alt="Payment Receipt" style="max-width:100px;max-height:100px;object-fit:contain;" /></a>` : '<span style="color:#999;">No receipt</span>'}
                </div>
            </div>
        </div>
    `).join('');
}

// Helper function to get status color
function getStatusColor(status) {
    const colors = {
        'Pending': 'warning',
        'Confirmed': 'success',
        'Checked-in': 'info',
        'Completed': 'secondary',
        'Cancelled': 'danger'
    };
    return colors[status] || 'secondary';
}

// Create a customer-friendly reservation card
function createCustomerReservationCard(reservation) {
    const checkIn = new Date(reservation.checkIn).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });
    const checkOut = new Date(reservation.checkOut).toLocaleDateString('en-US', { 
        year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' 
    });

    const statusColors = {
        'Pending': 'warning',
        'Confirmed': 'success',
        'Checked-in': 'info',
        'Completed': 'secondary',
        'Cancelled': 'danger'
    };

    return `
        <div class="card mb-3 shadow-sm">
            <div class="card-body">
                <div class="row">
                    <div class="col-md-8">
                        <h5 class="card-title">${reservation.serviceName}</h5>
                        <p class="card-text">
                            <strong>Reservation ID:</strong> ${reservation.reservationId}<br>
                            <strong>Check-in:</strong> ${checkIn}<br>
                            <strong>Check-out Time:</strong> ${checkOut}<br>
                            <strong>Guests:</strong> ${reservation.guests}<br>
                            <strong>Total Amount:</strong> ₱${parseFloat(reservation.totalCost).toLocaleString()}
                        </p>
                        ${reservation.promoCode ? `<span class="badge bg-success">Promo: ${reservation.promoCode}</span>` : ''}
                    </div>
                    <div class="col-md-4 text-end">
                        <span class="badge bg-${statusColors[reservation.status] || 'secondary'} mb-2" style="font-size: 1rem;">
                            ${reservation.status}
                        </span>
                        <div class="mt-3">
                            ${reservation.status === 'Pending' ? `
                                <button class="btn btn-sm btn-outline-danger" onclick="cancelReservation('${reservation._id}')">
                                    Cancel
                                </button>
                            ` : ''}
                            ${reservation.status === 'Confirmed' || reservation.status === 'Checked-in' ? `
                                <button class="btn btn-sm btn-primary" onclick="viewReservationQR('${reservation._id}')">
                                    View QR Code
                                </button>
                            ` : ''}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    `;
}

// Load customer profile information
async function loadCustomerProfile() {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    const container = document.getElementById('customer-profile-info');
    
    if (!container) return;

    container.innerHTML = `
        <div class="card">
            <div class="card-body">
                <h4 class="card-title">👤 My Profile</h4>
                <div class="row mt-3">
                    <div class="col-md-6">
                        <p><strong>Name:</strong> ${user.full_name || `${user.first_name} ${user.last_name}`}</p>
                        <p><strong>Email:</strong> ${user.email}</p>
                        <p><strong>Phone:</strong> ${user.phone || 'Not provided'}</p>
                    </div>
                  <div class="col-md-6 text-end">
                      <a href="customer-dashboard.html" class="btn btn-outline-primary">Edit Profile</a>
                  </div>
                </div>
            </div>
        </div>
    `;
}

// Cancel a reservation
async function cancelReservation(reservationId) {
    if (!confirm('Are you sure you want to cancel this reservation?')) {
        return;
    }

    try {
        const response = await fetch(`http://localhost:3000/api/reservations/${reservationId}`, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({ status: 'Cancelled' })
        });

        if (!response.ok) throw new Error('Failed to cancel reservation');

        showToast('Reservation cancelled successfully', 'success');
        loadCustomerReservations();
    } catch (error) {
        console.error('Error cancelling reservation:', error);
        showToast('Failed to cancel reservation', 'error');
    }
}

// View reservation QR code - CUSTOMER FRIENDLY (hides technical IDs)
function viewReservationQR(reservationId) {
    // Get the reservation to display formal ID
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    
    // Fetch reservation details to get formal ID
    fetch(`http://localhost:3000/api/reservations/user/${user.email}`, {
        headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
    })
    .then(res => res.json())
    .then(reservations => {
        // Find matching reservation
        const reservation = reservations.find(r => r._id === reservationId);
        const formalId = reservation?.reservationId || 'TRR-GUEST-CHECKIN';
        
        // Show customer-friendly modal with formal ID only (NOT the technical MongoDB ID)
        showModal('Your Check-In QR Code', `
            <div style="text-align: center; padding: 20px;">
                <p style="margin-bottom: 1rem; font-size: 1.1rem; color: #666;">
                    <strong>Reservation ID:</strong> <span style="color: var(--primary-color); font-size: 1.2rem; font-weight: bold;">${formalId}</span>
                </p>
                <div id="qr-code-container" style="background: white; padding: 15px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></div>
                <p style="margin-top: 1rem; font-size: 0.95rem; color: #666;">
                    📱 Show this QR code to the staff when you arrive for check-in
                </p>
                <div style="margin-top: 1.5rem; padding: 1rem; background: #f8f9fa; border-radius: 8px; border-left: 4px solid var(--primary-color);">
                    <p style="margin: 0; font-size: 0.9rem; color: #555;">
                        <strong>ℹ️ Tip:</strong> You can also provide your Reservation ID to the staff if they can't scan the QR code.
                    </p>
                </div>
            </div>
        `, 'info');

        // Generate QR code after modal is shown
        setTimeout(() => {
            const container = document.getElementById('qr-code-container');
            if (container) {
                // QR code encodes only the formal reservation ID (not the technical MongoDB ID)
                new QRCode(container, {
                    text: formalId,
                    width: 256,
                    height: 256,
                    colorDark: '#000000',
                    colorLight: '#ffffff'
                });
            }
        }, 100);
    })
    .catch(error => {
        console.error('Error loading reservation details:', error);
        // Fallback: show QR with just the reservation ID
        showModal('Your Check-In QR Code', `
            <div style="text-align: center; padding: 20px;">
                <div id="qr-code-container" style="background: white; padding: 15px; border-radius: 8px; display: inline-block; box-shadow: 0 2px 8px rgba(0,0,0,0.1);"></div>
                <p style="margin-top: 1rem; font-size: 0.95rem; color: #666;">
                    📱 Show this QR code to the staff when you arrive for check-in
                </p>
            </div>
        `, 'info');
        
        setTimeout(() => {
            const container = document.getElementById('qr-code-container');
            if (container) {
                new QRCode(container, {
                    text: reservationId,
                    width: 256,
                    height: 256
                });
            }
        }, 100);
    });
}

// Export functions
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        initCustomerDashboard,
        loadCustomerReservations,
        cancelReservation,
        viewReservationQR
    };
}
