// Store pending payments globally for expand functionality
let pendingPaymentsData = [];
let groupedPayments = { single: [], multi: [] };

function formatPaymentDetails(reservation) {
  const receiptUrl = reservation.receiptFileName ? `http://localhost:3000/uploads/${reservation.receiptFileName}` : '';
  const receiptCell = receiptUrl 
    ? `<a href="${receiptUrl}" target="_blank"><img src="${receiptUrl}" alt="Receipt" style="max-width:200px;max-height:200px;border-radius:4px;"></a>`
    : '<span class="text-muted">No receipt uploaded</span>';

  const uploadedDate = reservation.receiptUploadedAt ? new Date(reservation.receiptUploadedAt).toLocaleString() : 'N/A';
  
  // Determine payment type badge
  let paymentTypeBadge = '<span class="badge bg-info">50% Down Payment</span>';
  if (reservation.paymentType === 'fullpayment') {
    paymentTypeBadge = '<span class="badge bg-success">100% Full Payment</span>';
  }
  
  // Determine payment status badge
  let paymentStatusBadge = '<span class="badge bg-warning">Pending</span>';
  if (reservation.paymentStatus === 'partial-payment') {
    paymentStatusBadge = '<span class="badge bg-info">50% Submitted</span>';
  } else if (reservation.paymentStatus === 'partially-paid') {
    paymentStatusBadge = '<span class="badge bg-primary">50% Approved</span>';
  } else if (reservation.paymentStatus === 'full-payment') {
    paymentStatusBadge = '<span class="badge bg-info">100% Submitted</span>';
  } else if (reservation.paymentStatus === 'fully-paid') {
    paymentStatusBadge = '<span class="badge bg-success">100% Approved</span>';
  }
  
  // Calculate amounts
  const totalAmount = Number(reservation.finalTotal || 0);
  const downPaymentAmount = Math.round(totalAmount * 0.5 * 100) / 100;
  // Calculate amount actually submitted based on payment type
  const submittedAmount = reservation.paymentType === 'downpayment' ? downPaymentAmount : totalAmount;
  const paidAmount = reservation.paymentStatus === 'partially-paid' ? downPaymentAmount : (reservation.paymentStatus === 'fully-paid' ? totalAmount : 0);
  const remainingAmount = totalAmount - submittedAmount;
  
  return `
    <div class="details-container">
      <div class="detail-section">
        <h6>👤 Guest Details</h6>
        <p><strong>Name:</strong> ${escapeHtml(reservation.full_name || reservation.customer_name || 'N/A')}</p>
        <p><strong>Email:</strong> ${escapeHtml(reservation.email || 'N/A')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(reservation.phone || 'N/A')}</p>
      </div>
      <div class="detail-section">
        <h6>🏨 Service Details</h6>
        <p><strong>Service Type:</strong> ${escapeHtml(reservation.serviceType || 'N/A')}</p>
        <p><strong>Service Name:</strong> ${escapeHtml(reservation.serviceName || reservation.serviceId || 'N/A')}</p>
        <p><strong>Duration:</strong> ${escapeHtml(reservation.durationLabel || 'N/A')}</p>
        <p><strong>Number of Guests:</strong> ${reservation.guests || 'N/A'}</p>
      </div>
      <div class="detail-section">
        <h6>💳 Payment Details</h6>
        <p><strong>GCash Reference #:</strong> ${escapeHtml(reservation.gcashReferenceNumber || 'N/A')}</p>
        <p><strong>Total Reservation Cost:</strong> <span style="font-size:1.2em;color:#28a745;">₱${totalAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></p>
        <p><strong>Payment Type:</strong> ${paymentTypeBadge}</p>
        <p><strong>Amount Submitted for Approval:</strong> <span style="font-size:1.1em;color:#0066cc;">₱${submittedAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></p>
        ${remainingAmount > 0 ? `<p><strong>Remaining Balance:</strong> <span style="font-size:1.1em;color:#ff9800;">₱${remainingAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></p>` : ''}
        <p><strong>Payment Status:</strong> ${paymentStatusBadge}</p>
        <p><strong>Uploaded Date:</strong> ${uploadedDate}</p>
      </div>
      <div class="detail-section">
        <h6>📸 Receipt Image</h6>
        <div style="text-align:center;">${receiptCell}</div>
      </div>
    </div>
  `;
}

function togglePaymentDetails(btn, paymentId) {
  const row = btn.closest('tr');
  const nextRow = row.nextElementSibling;
  
  // If already expanded, collapse it
  if (nextRow && nextRow.classList.contains('payment-details-row')) {
    nextRow.remove();
    btn.textContent = '+';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-outline-primary');
  } else {
    // Expand: find payment data and insert detail row
    const payment = pendingPaymentsData.find(p => (p._id || p.reservationId) === paymentId);
    if (payment) {
      const detailHTML = formatPaymentDetails(payment);
      const detailRow = document.createElement('tr');
      detailRow.className = 'payment-details-row';
      detailRow.innerHTML = `<td colspan="9">${detailHTML}</td>`;
      row.after(detailRow);
      btn.textContent = '−';
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-danger');
    }
  }
}

async function renderPendingPayments() {
    const tbody = document.getElementById('pending-payments-list');
    if (!tbody) return;

    tbody.innerHTML = '<tr><td colspan="8" class="text-center">Loading pending payments...</td></tr>';

    try {
        const token = typeof getAuthToken === 'function' ? getAuthToken() : (sessionStorage.getItem('token') || localStorage.getItem('token') || '');
        
        const response = await fetch('http://localhost:3000/api/reservations/pending-payments', {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const pending = await response.json();

        if (!Array.isArray(pending) || pending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No pending payments.</td></tr>';
            return;
        }

        // Store globally for expand functionality
        pendingPaymentsData = pending;
        
        // Group reservations by multiAmenityGroupId when flagged as multi-amenity
        const multiAmenityGroups = {};
        const singleReservations = [];
        
        pending.forEach(reservation => {
            // Debug logging for classification
            console.log('📋 Classifying reservation:', {
                id: reservation.reservationId,
                serviceName: reservation.serviceName,
                isMultiAmenity: reservation.isMultiAmenity,
                hasGroupId: !!reservation.multiAmenityGroupId,
                groupId: reservation.multiAmenityGroupId
            });
            
            if (reservation.isMultiAmenity && reservation.multiAmenityGroupId) {
                const groupId = reservation.multiAmenityGroupId;
                if (!multiAmenityGroups[groupId]) {
                    multiAmenityGroups[groupId] = [];
                }
                multiAmenityGroups[groupId].push(reservation);
            } else {
                singleReservations.push(reservation);
            }
        });
        
        // Treat any reservation marked as multi-amenity as a multi-amenity group
        const trueMultiAmenity = [];
        Object.keys(multiAmenityGroups).forEach(groupId => {
            const group = multiAmenityGroups[groupId];
            if (group.length > 0) {
                trueMultiAmenity.push({ groupId, reservations: group });
            }
        });
        
        // Store grouped data
        groupedPayments = {
            single: singleReservations,
            multi: trueMultiAmenity
        };
        
        // Get filter value
        const filterSelect = document.getElementById('reservation-type-filter');
        const filterValue = filterSelect ? filterSelect.value : 'all';
        
        tbody.innerHTML = '';
        
        // Render based on filter
        if (filterValue === 'all' || filterValue === 'single') {
            renderSingleReservations(tbody, singleReservations);
        }
        
        if (filterValue === 'all' || filterValue === 'multi') {
            renderMultiAmenityGroups(tbody, trueMultiAmenity);
        }
        
        // If nothing to show after filtering
        if (tbody.children.length === 0) {
            tbody.innerHTML = '<tr><td colspan="9" class="text-center">No matching reservations found.</td></tr>';
        }

    } catch (error) {
        console.error('Error loading pending payments:', error);
        tbody.innerHTML = '<tr><td colspan="9" class="text-center text-danger">Failed to load pending payments.</td></tr>';
    }
}

function getPaymentActionLabel(paymentStatus) {
  if (paymentStatus === 'partial-payment') {
    return { button: 'Approve Partial (50%)', action: 'approve-partial' };
  } else if (paymentStatus === 'partially-paid') {
    return { button: 'Approve Full (Remaining 50%)', action: 'approve-full' };
  } else if (paymentStatus === 'full-payment') {
    return { button: 'Approve Full (100%)', action: 'approve-full' };
  }
  return { button: 'Approve', action: 'approve' };
}

function renderSingleReservations(tbody, reservations) {
    reservations.filter(reservation => !reservation.isMultiAmenity).forEach(reservation => {
        const reservationId = reservation.reservationId || reservation._id || 'N/A';
        const customerName = reservation.full_name || reservation.customer_name || 'N/A';
        const serviceName = reservation.serviceName || 'N/A';
        const serviceType = reservation.serviceType || 'N/A';
        const serviceDisplay = serviceName !== 'N/A' ? `${serviceName} <small>(${serviceType})</small>` : serviceType;
        const reference = reservation.gcashReferenceNumber || 'N/A';
        const totalAmount = Number(reservation.finalTotal || 0);
        // Calculate actual payment amount based on payment type
        const paymentAmount = reservation.paymentType === 'downpayment' ? (totalAmount * 0.5) : totalAmount;
        const amount = paymentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 });
        const uploaded = reservation.receiptUploadedAt ? new Date(reservation.receiptUploadedAt).toLocaleString() : 'N/A';
        
        // Determine payment type and action button
        let paymentTypeBadge = '<span class="badge bg-info">50% Down</span>';
        let paymentStatusBadge = '<span class="badge bg-warning">Pending</span>';
        
        if (reservation.paymentType === 'full') {
          paymentTypeBadge = '<span class="badge bg-success">Full 100%</span>';
        }
        
        if (reservation.paymentStatus === 'partial-payment') {
          paymentStatusBadge = '<span class="badge bg-info">50% Submitted</span>';
        } else if (reservation.paymentStatus === 'partially-paid') {
          paymentStatusBadge = '<span class="badge bg-primary">50% Approved</span>';
        } else if (reservation.paymentStatus === 'full-payment') {
          paymentStatusBadge = '<span class="badge bg-info">100% Submitted</span>';
        } else if (reservation.paymentStatus === 'fully-paid') {
          paymentStatusBadge = '<span class="badge bg-success">100% Approved</span>';
        }
        
        const actionLabel = getPaymentActionLabel(reservation.paymentStatus);
        const approveButtonClass = reservation.paymentStatus === 'partially-paid' ? 'btn-info' : 'btn-success';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${reservationId}</td>
            <td>${escapeHtml(customerName)}</td>
            <td>${serviceDisplay}</td>
            <td>${escapeHtml(reference)}</td>
            <td>${paymentTypeBadge}</td>
            <td>${paymentStatusBadge}</td>
            <td>₱${amount}</td>
            <td>${uploaded}</td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="btn btn-sm btn-outline-primary expand-payment-btn" onclick="togglePaymentDetails(this, '${reservation._id}')" style="width: 100%;">+</button>
                    <button class="btn ${approveButtonClass} btn-sm" data-action="${actionLabel.action}" data-id="${reservation._id}">${actionLabel.button}</button>
                    <button class="btn btn-danger btn-sm" data-action="reject" data-id="${reservation._id}">Reject</button>
                </div>
            </td>
        `;

        tbody.appendChild(row);
    });

    // Only attach listeners to single reservation buttons (not group buttons)
    tbody.querySelectorAll('button[data-action]:not([data-action*="group"])').forEach(btn => {
        btn.addEventListener('click', async function() {
            const action = this.getAttribute('data-action');
            const id = this.getAttribute('data-id');
            await handlePaymentAction(id, action, this);
        });
    });
}

function renderMultiAmenityGroups(tbody, groups) {
    groups.forEach((group, groupIndex) => {
        const firstRes = group.reservations[0];
        const customerName = firstRes.full_name || firstRes.customer_name || 'N/A';
        const reference = firstRes.gcashReferenceNumber || 'N/A';
        const totalAmount = group.reservations.reduce((sum, r) => sum + Number(r.finalTotal || 0), 0);
        // Calculate actual payment amount based on payment type
        const paymentAmount = firstRes.paymentType === 'downpayment' ? (totalAmount * 0.5) : totalAmount;
        const uploaded = firstRes.receiptUploadedAt ? new Date(firstRes.receiptUploadedAt).toLocaleString() : 'N/A';
        
        // Create list of service names for multi-amenity
        const servicesList = group.reservations.map(r => r.serviceName || r.serviceType || 'Unknown').join(', ');
        const servicesDisplay = `<strong>${group.reservations.length} Services:</strong><br><small>${servicesList}</small>`;
        
        // Determine payment type and status badges for the group
        let paymentTypeBadge = '<span class="badge bg-info">50% Down</span>';
        let paymentStatusBadge = '<span class="badge bg-warning">Pending</span>';
        
        if (firstRes.paymentType === 'full') {
          paymentTypeBadge = '<span class="badge bg-success">Full 100%</span>';
        }
        
        if (firstRes.paymentStatus === 'partial-payment') {
          paymentStatusBadge = '<span class="badge bg-info">50% Submitted</span>';
        } else if (firstRes.paymentStatus === 'partially-paid') {
          paymentStatusBadge = '<span class="badge bg-primary">50% Approved</span>';
        } else if (firstRes.paymentStatus === 'full-payment') {
          paymentStatusBadge = '<span class="badge bg-info">100% Submitted</span>';
        } else if (firstRes.paymentStatus === 'fully-paid') {
          paymentStatusBadge = '<span class="badge bg-success">100% Approved</span>';
        }
        
        const actionLabel = getPaymentActionLabel(firstRes.paymentStatus);
        const approveButtonClass = firstRes.paymentStatus === 'partially-paid' ? 'btn-info' : 'btn-success';
        
        // Create main group row
        const groupRow = document.createElement('tr');
        groupRow.style.backgroundColor = '#fff3cd';
        // Use the first reservation's formal ID, with fallback to group ID
        const displayId = firstRes.reservationId || (group.groupId ? String(group.groupId).substring(0, 12) + '...' : 'N/A');
        groupRow.innerHTML = `
            <td><span class="badge bg-warning">Multi-Amenity</span><br>${escapeHtml(displayId)}</td>
            <td>${escapeHtml(customerName)}</td>
            <td>${servicesDisplay}</td>
            <td>${escapeHtml(reference)}</td>
            <td>${paymentTypeBadge}</td>
            <td>${paymentStatusBadge}</td>
            <td><strong>₱${paymentAmount.toLocaleString('en-PH', { minimumFractionDigits: 2 })}</strong></td>
            <td>${uploaded}</td>
            <td>
                <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                    <button class="btn btn-sm btn-outline-warning expand-payment-btn" onclick="toggleMultiAmenityGroup(this, ${groupIndex})" style="width: 100%;">+</button>
                    <button class="btn ${approveButtonClass} btn-sm" data-action="${actionLabel.action}-group" data-group-index="${groupIndex}">${actionLabel.button}</button>
                    <button class="btn btn-danger btn-sm" data-action="reject-group" data-group-index="${groupIndex}">Reject All</button>
                </div>
            </td>
        `;
        
        tbody.appendChild(groupRow);
    });
    
    // Attach group action handlers
    tbody.querySelectorAll('button[data-action]').forEach(btn => {
        if (btn.getAttribute('data-action') && btn.getAttribute('data-action').includes('group')) {
            btn.addEventListener('click', async function() {
                const action = this.getAttribute('data-action');
                const groupIndex = parseInt(this.getAttribute('data-group-index'));
                await handleGroupPaymentAction(groupIndex, action, this);
            });
        }
    });
}

function toggleMultiAmenityGroup(btn, groupIndex) {
    const row = btn.closest('tr');
    const nextRow = row.nextElementSibling;
    
    // If already expanded, collapse it
    if (nextRow && nextRow.classList.contains('multi-amenity-details-row')) {
        nextRow.remove();
        btn.textContent = '+';
    } else {
        // Expand: show all reservations in the group
        const group = groupedPayments.multi[groupIndex];
        if (group && group.reservations) {
            let detailsHTML = '<div style="padding: 15px; background: #fff;">';
            detailsHTML += '<h6 class="mb-3">📋 Reservations in this Multi-Amenity Booking:</h6>';
            detailsHTML += '<div style="margin-bottom: 10px; padding: 8px 10px; border-radius: 6px; background: #fff3cd; color: #856404; font-size: 0.9rem;">Approvals are bundle-wide. Use Approve All/Reject All to keep the booking consistent.</div>';
            detailsHTML += '<table class="table table-sm table-bordered">';
            detailsHTML += '<thead><tr><th>Reservation ID</th><th>Service</th><th>Duration</th><th>Check-In</th><th>Amount</th></tr></thead><tbody>';
            
            group.reservations.forEach(res => {
                const resId = res.reservationId || res._id || 'N/A';
                const serviceName = res.serviceName || res.serviceId || 'N/A';
                const duration = res.durationLabel || 'N/A';
                const checkIn = res.check_in ? new Date(res.check_in).toLocaleDateString() : 'N/A';
                const amount = Number(res.finalTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
                
                detailsHTML += `<tr>
                    <td>${escapeHtml(resId)}</td>
                    <td>${escapeHtml(serviceName)}</td>
                    <td>${escapeHtml(duration)}</td>
                    <td>${checkIn}</td>
                    <td>₱${amount}</td>
                </tr>`;
            });
            
            detailsHTML += '</tbody></table>';
            
            // Show receipt image from first reservation
            const firstRes = group.reservations[0];
            if (firstRes.receiptFileName) {
                const receiptUrl = `http://localhost:3000/uploads/${firstRes.receiptFileName}`;
                detailsHTML += `<div class="mt-3"><h6>📸 Receipt:</h6><a href="${receiptUrl}" target="_blank"><img src="${receiptUrl}" alt="Receipt" style="max-width:300px;border-radius:4px;"></a></div>`;
            }
            
            detailsHTML += '</div>';
            
            const detailRow = document.createElement('tr');
            detailRow.className = 'multi-amenity-details-row';
            detailRow.innerHTML = `<td colspan="9">${detailsHTML}</td>`;
            row.after(detailRow);
            btn.textContent = '−';
        }
    }
}

async function handleGroupPaymentAction(groupIndex, action, buttonEl) {
    const group = groupedPayments.multi[groupIndex];
    if (!group || !group.reservations) return;
    
    const isApprove = action.startsWith('approve');
    let confirmMsg = '';
    
    if (action === 'approve-partial-group') {
        confirmMsg = `Approve the 50% down payment for all ${group.reservations.length} reservations in this multi-amenity booking?`;
    } else if (action === 'approve-full-group') {
        confirmMsg = `Approve the full payment for all ${group.reservations.length} reservations in this multi-amenity booking?`;
    } else if (action === 'reject-group') {
        confirmMsg = `Reject all ${group.reservations.length} reservations in this multi-amenity booking?`;
    } else if (action === 'approve-group') {
        // Legacy support
        confirmMsg = `Approve all ${group.reservations.length} reservations in this multi-amenity booking?`;
    }
    
    if (!confirm(confirmMsg)) return;
    
    buttonEl.disabled = true;
    const originalText = buttonEl.textContent;
    buttonEl.textContent = isApprove ? 'Processing...' : 'Rejecting...';
    
    const token = typeof getAuthToken === 'function' ? getAuthToken() : (sessionStorage.getItem('token') || localStorage.getItem('token') || '');
    
    console.log('🔐 DEBUG - handleGroupPaymentAction: Token length:', token.length, 'Token exists:', !!token, 'Action:', action);
    
    if (!token) {
        showToast('Authentication token not found. Please log in again.', 'danger');
        buttonEl.disabled = false;
        buttonEl.textContent = originalText;
        return;
    }
    
    // For multi-amenity groups, the backend automatically updates ALL reservations in the group
    // when we approve/reject just ONE reservation. So we only need to call the endpoint once.
    const firstReservation = group.reservations[0];
    
    try {
        let endpoint, payload;
        
        if (action === 'approve-partial-group') {
            endpoint = `http://localhost:3000/api/reservations/${firstReservation._id}/approve-partial`;
            payload = { paymentType: 'partial' };
        } else if (action === 'approve-full-group') {
            endpoint = `http://localhost:3000/api/reservations/${firstReservation._id}/approve-full`;
            payload = { paymentType: 'full' };
        } else if (action === 'reject-group') {
            endpoint = `http://localhost:3000/api/reservations/${firstReservation._id}/reject-payment`;
            payload = { status: 'REJECTED', paymentStatus: 'REJECTED' };
        } else if (action === 'approve-group') {
            // Legacy support
            endpoint = `http://localhost:3000/api/reservations/${firstReservation._id}/approve-payment`;
            payload = { status: 'PAID' };
        }
        
        console.log('🚀 DEBUG - Multi-Amenity Fetch:', { endpoint, method: 'PATCH', token: `Bearer ${token.substring(0, 20)}...`, payload });
        
        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });
        
        let result = {};
        try {
            result = await response.json();
        } catch (e) {
            console.log('⚠️ Could not parse JSON response, using empty object');
            result = {};
        }
        console.log('📡 DEBUG - Response Status:', response.status, 'Response Data:', result);
        
        // If status is 200 (OK), consider it a success even if response body is empty
        if (response.ok) {
            let actionMsg = 'processed';
            if (action === 'approve-partial-group') actionMsg = 'partially approved';
            else if (action === 'approve-full-group') actionMsg = 'fully approved';
            else if (action === 'reject-group') actionMsg = 'rejected';
            else if (action === 'approve-group') actionMsg = 'approved';
            
            showToast(`All ${group.reservations.length} reservations ${actionMsg} successfully!`, 'success');
        } else {
            const errorMsg = result.message || 'Unknown error';
            console.error('❌ API Error:', response.status, errorMsg);
            showToast(`Failed to process reservations: ${errorMsg}`, 'danger');
        }
    } catch (error) {
        console.error(`Error processing multi-amenity group:`, error);
        showToast(`Error: ${error.message}`, 'danger');
    }
    
    // Refresh tables
    renderPendingPayments();
    if (typeof renderAdminReservations === 'function') {
        setTimeout(() => renderAdminReservations(), 300);
    }
    
    buttonEl.disabled = false;
    buttonEl.textContent = originalText;
}

async function handlePaymentAction(reservationId, action, buttonEl) {
    const token = typeof getAuthToken === 'function' ? getAuthToken() : (sessionStorage.getItem('token') || localStorage.getItem('token') || '');
    
    console.log('🔐 DEBUG - handlePaymentAction: Token length:', token.length, 'Token exists:', !!token, 'Reservation:', reservationId, 'Action:', action);
    
    if (!token) {
        showToast('Authentication token not found. Please log in again.', 'danger');
        return;
    }
    
    const isApprove = action.startsWith('approve');

    let endpoint, payload, confirmMsg;
    
    if (action === 'approve-partial') {
        endpoint = `http://localhost:3000/api/reservations/${reservationId}/approve-partial`;
        payload = { paymentType: 'partial' };
        confirmMsg = 'Approve this 50% down payment?';
    } else if (action === 'approve-full') {
        endpoint = `http://localhost:3000/api/reservations/${reservationId}/approve-full`;
        payload = { paymentType: 'full' };
        confirmMsg = 'Approve this full payment?';
    } else if (action === 'reject') {
        endpoint = `http://localhost:3000/api/reservations/${reservationId}/reject-payment`;
        payload = { status: 'REJECTED', paymentStatus: 'REJECTED' };
        confirmMsg = 'Reject this payment? The reservation will be marked as rejected.';
    } else {
        // Legacy support
        endpoint = `http://localhost:3000/api/reservations/${reservationId}/approve-payment`;
        payload = { status: 'PAID' };
        confirmMsg = 'Approve this payment?';
    }

    if (!isApprove && action !== 'reject') {
        if (!confirm(confirmMsg)) return;
    } else if (action === 'reject') {
        if (!confirm(confirmMsg)) return;
    }

    buttonEl.disabled = true;
    const originalText = buttonEl.textContent;
    buttonEl.textContent = isApprove ? 'Processing...' : 'Rejecting...';

    try {
        console.log('🚀 DEBUG - Payment Fetch:', { endpoint, method: 'PATCH', token: `Bearer ${token.substring(0, 20)}...`, payload });
        
        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        let result = {};
        try {
            result = await response.json();
        } catch (e) {
            console.log('⚠️ Could not parse JSON response, using empty object');
            result = {};
        }
        console.log('📡 DEBUG - Response Status:', response.status, 'Response Data:', result);
        
        // If status is 200 (OK), consider it a success even if response body is empty
        if (response.ok) {
            let actionText = 'processed';
            if (action === 'approve-partial') actionText = 'partially approved (50%)';
            else if (action === 'approve-full') actionText = 'fully approved';
            else if (action === 'reject') actionText = 'rejected';
            else if (action === 'approve') actionText = 'approved';
            showToast(`Payment ${actionText} successfully!`, 'success');
        } else {
            const errorMsg = result.message || 'Action failed';
            console.error('❌ API Error:', response.status, errorMsg);
            throw new Error(errorMsg);
        }
        
        // Refresh both tables: payment verifications and admin reservations
        renderPendingPayments();
        if (typeof renderAdminReservations === 'function') {
            setTimeout(() => renderAdminReservations(), 300);
        }
    } catch (error) {
        console.error('Payment action error:', error);
        showToast(error.message || 'Failed to update payment status.', 'error');
    } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = originalText;
    }
}

function escapeHtml(text) {
    if (!text) return '';
    return text.replace(/[&<>"']/g, function (c) {
        return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]||c;
    });
}

window.renderPendingPayments = renderPendingPayments;
window.togglePaymentDetails = togglePaymentDetails;
window.toggleMultiAmenityGroup = toggleMultiAmenityGroup;
