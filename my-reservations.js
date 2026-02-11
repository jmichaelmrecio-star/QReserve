// my-reservations.js
// This script will handle fetching and rendering the user's reservations in the my-reservations.html page.

let refreshIntervalId = null;

document.addEventListener('DOMContentLoaded', async function () {
    loadAndRenderReservations();
    
    // Set up auto-refresh: reload data every 30 seconds
    refreshIntervalId = setInterval(loadAndRenderReservations, 30000);
    
    // Reload on window focus (if user switches tabs/windows and comes back)
    window.addEventListener('focus', loadAndRenderReservations);
});

async function loadAndRenderReservations() {
    const tbody = document.getElementById('user-reservations-list');
    
    // Show loading state
    tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">Loading your reservations...</td></tr>';
    
    try {
        // Get logged-in user from session storage
        const loggedInUserStr = sessionStorage.getItem('loggedInUser');
        if (!loggedInUserStr) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#d97757;">Please log in to view your reservations.</td></tr>';
            return;
        }
        
        const loggedInUser = JSON.parse(loggedInUserStr);
        const userEmail = loggedInUser.email;
        
        if (!userEmail) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#d97757;">Error: User email not found.</td></tr>';
            return;
        }
        
        // Fetch reservations from API
        const response = await fetch('http://localhost:3000/api/reservations/user/' + encodeURIComponent(userEmail));
        
        if (!response.ok) {
            throw new Error('HTTP ' + response.status + ': ' + response.statusText);
        }
        
        const data = await response.json();
        
        if (!data.success || !Array.isArray(data.reservations)) {
            throw new Error('Invalid response format from server');
        }
        
        const reservations = data.reservations;
        
        // Filter out CART items and sort by date (most recent first)
        const activeReservations = reservations
            .filter(r => r.status !== 'CART')
            .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));
        
        if (activeReservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;">No reservations found. <a href="services-list.html" style="color:var(--primary-color);text-decoration:underline;">Book your first stay!</a></td></tr>';
            return;
        }
        
        // Render reservations
        tbody.innerHTML = '';
        activeReservations.forEach(res => {
            const tr = document.createElement('tr');
            
            // Format dates
            const checkinDate = res.check_in ? new Date(res.check_in).toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            }) : 'N/A';
            const checkoutDate = res.check_out ? new Date(res.check_out).toLocaleDateString('en-US', { 
                month: 'short', day: 'numeric', year: 'numeric' 
            }) : 'N/A';
            
            // Status badge classes
            const statusClassMap = {
                'PENDING': 'status-pending',
                'PAID': 'status-paid',
                'CONFIRMED': 'status-confirmed',
                'CHECKED_IN': 'status-checked-in',
                'COMPLETED': 'status-completed',
                'CANCELLED': 'status-cancelled',
                'REJECTED': 'status-rejected'
            };
            const statusClass = statusClassMap[res.status] || 'status-pending';
            
            // Calculate total paid based on payment type and payment status
            let totalPaidAmount = 0;
            let paymentTypeLabel = 'N/A';
            let paymentTypeBadgeClass = '';
            
            const finalTotal = parseFloat(res.finalTotal) || 0;
            const downPaymentAmount = finalTotal * 0.5;
            
            // Determine payment type
            if (res.paymentType === 'downpayment' || res.paymentType === 'down-payment') {
                paymentTypeLabel = '50% Down Payment';
                paymentTypeBadgeClass = 'badge-info';
                // Check both paymentStatus and main status for backward compatibility
                if (['partial-payment', 'partially-paid', 'fully-paid', 'PAID', 'CONFIRMED'].includes(res.paymentStatus) ||
                    ['PAID', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(res.status)) {
                    totalPaidAmount = downPaymentAmount;
                } else {
                    totalPaidAmount = 0;
                }
            } else if (res.paymentType === 'full') {
                paymentTypeLabel = '100% Full Payment';
                paymentTypeBadgeClass = 'badge-success';
                // Check both paymentStatus and main status for backward compatibility
                if (['full-payment', 'fully-paid', 'PAID', 'CONFIRMED'].includes(res.paymentStatus) ||
                    ['PAID', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(res.status)) {
                    totalPaidAmount = finalTotal;
                } else {
                    totalPaidAmount = 0;
                }
            } else {
                paymentTypeLabel = 'Standard';
                paymentTypeBadgeClass = 'badge-secondary';
                if (['PAID', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(res.status)) {
                    totalPaidAmount = finalTotal;
                } else {
                    totalPaidAmount = 0;
                }
            }
            
            const totalPaid = '₱' + totalPaidAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 });
            
            // Payment type badge
            const paymentTypeBadge = '<span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: 600; ' + (paymentTypeBadgeClass === 'badge-info' ? 'background:#d4e5f7;color:#0066cc;' : 'background:#d4edda;color:#155724;') + '">' + paymentTypeLabel + '</span>';
            
            // Receipt image
            const receiptImg = res.receiptFileName 
                ? '<a href="http://localhost:3000/uploads/' + res.receiptFileName + '" target="_blank"><img src="http://localhost:3000/uploads/' + res.receiptFileName + '" alt="Receipt" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 2px 8px #ccc;"></a>'
                : '<span style="color:#999;">No receipt</span>';
            
            const isPending = res.status === 'PENDING';
            const hasPaymentLink = (res._id || res.reservationId) && res.reservationHash;
            const paymentLink = hasPaymentLink
                ? 'payment.html?reservationId=' + encodeURIComponent(res._id || res.reservationId) + '&hash=' + encodeURIComponent(res.reservationHash)
                : '';

            const qrEnabled = ['CONFIRMED', 'CHECKED_IN', 'COMPLETED'].includes(res.status) && res.reservationHash;
            const canCancel = !['COMPLETED', 'CANCELLED', 'REJECTED'].includes(res.status);
            
            let actionButton = '';
            if (isPending) {
                actionButton = hasPaymentLink
                    ? '<a href="' + paymentLink + '" onclick="sessionStorage.setItem(\'payment_reservation_id\',\'' + (res._id || res.reservationId) + '\');sessionStorage.setItem(\'payment_reservation_hash\',\'' + res.reservationHash + '\');" style="display: inline-block; padding: 6px 12px; background-color: var(--primary-color); color: white; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; transition: background-color 0.3s; border: none; cursor: pointer;" onmouseover="this.style.backgroundColor=\'#1e7a34\'" onmouseout="this.style.backgroundColor=\'var(--primary-color)\'">Pay Now</a>'
                    : '<button style="display: inline-block; padding: 6px 12px; background-color: #cccccc; color: #666666; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; cursor: not-allowed;" disabled>Pay Now</button>';
            } else if (qrEnabled) {
                actionButton = '<a href="confirmation.html?hash=' + res.reservationHash + '" style="display: inline-block; padding: 6px 12px; background-color: var(--primary-color); color: white; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; transition: background-color 0.3s; border: none; cursor: pointer;" onmouseover="this.style.backgroundColor=\'#1e7a34\'" onmouseout="this.style.backgroundColor=\'var(--primary-color)\'">View QR</a>';
            } else {
                actionButton = '<button style="display: inline-block; padding: 6px 12px; background-color: #cccccc; color: #666666; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; cursor: not-allowed;" disabled>View QR</button>';
            }
            
            if (canCancel) {
                actionButton += ' <button onclick="customerCancelReservation(\'' + (res._id || res.reservationId) + '\', \'' + (res.serviceName || res.serviceType || 'Reservation') + '\')" style="display: inline-block; margin-left: 6px; padding: 6px 12px; background-color: #d97757; color: white; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; transition: background-color 0.3s; cursor: pointer;" onmouseover="this.style.backgroundColor=\'#c8644a\'" onmouseout="this.style.backgroundColor=\'#d97757\'">Cancel</button>';
            }
            
            const reservationId = res.isMultiAmenity 
                ? res.reservationId + '<br><small style="color:#007bff;">Multi-Amenity ' + (res.multiAmenityIndex + 1) + '/' + res.multiAmenityTotal + '</small>'
                : res.reservationId || res._id;
            
            tr.innerHTML = '<td><strong>' + reservationId + '</strong></td><td>' + (res.serviceName || res.serviceType || 'N/A') + '</td><td>' + checkinDate + '</td><td>' + checkoutDate + '</td><td><span class="' + statusClass + '">' + res.status + '</span></td><td>' + paymentTypeBadge + '</td><td>' + totalPaid + '</td><td>' + receiptImg + '</td><td>' + actionButton + '</td>';
            tbody.appendChild(tr);
        });
        
    } catch (error) {
        console.error('Error fetching reservations:', error);
        tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;padding:2rem;color:#d97757;">Failed to load reservations. ' + error.message + '<br><button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:var(--primary-color);color:white;border:none;border-radius:4px;cursor:pointer;">Retry</button></td></tr>';
    }
}

function customerCancelReservation(reservationId, serviceName) {
    const modal = document.getElementById('cancelReservationModal');
    const serviceNameEl = document.getElementById('cancelServiceName');
    const confirmBtn = document.getElementById('confirmCancelBtn');
    const keepBtn = document.getElementById('keepReservationBtn');
    
    if (!modal) {
        console.error('Cancel reservation modal not found');
        return;
    }
    
    serviceNameEl.textContent = serviceName || 'your';
    
    modal.style.display = 'flex';
    document.body.style.overflow = 'hidden';
    
    confirmBtn.onclick = async function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
        
        try {
            const response = await fetch('http://localhost:3000/api/reservations/update-status/' + reservationId, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer ' + (sessionStorage.getItem('authToken') || '')
                },
                body: JSON.stringify({ status: 'CANCELLED' })
            });
            
            if (response.ok) {
                showToast('Your reservation has been cancelled successfully.', 'success');
                setTimeout(() => {
                    loadAndRenderReservations();
                }, 1500);
            } else {
                const error = await response.json();
                showToast(error.message || 'Failed to cancel reservation. Please try again.', 'danger');
            }
        } catch (error) {
            console.error('Error cancelling reservation:', error);
            showToast('Error: ' + error.message, 'danger');
        }
    };
    
    keepBtn.onclick = function() {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    };
}

window.customerCancelReservation = customerCancelReservation;
window.loadAndRenderReservations = loadAndRenderReservations;
