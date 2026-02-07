// Store pending payments globally for expand functionality
let pendingPaymentsData = [];

function formatPaymentDetails(reservation) {
  const receiptUrl = reservation.receiptFileName ? `http://localhost:3000/uploads/${reservation.receiptFileName}` : '';
  const receiptCell = receiptUrl 
    ? `<a href="${receiptUrl}" target="_blank"><img src="${receiptUrl}" alt="Receipt" style="max-width:200px;max-height:200px;border-radius:4px;"></a>`
    : '<span class="text-muted">No receipt uploaded</span>';

  const uploadedDate = reservation.receiptUploadedAt ? new Date(reservation.receiptUploadedAt).toLocaleString() : 'N/A';
  
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
        <p><strong>Final Total:</strong> <span style="font-size:1.2em;color:#28a745;">₱${(Number(reservation.finalTotal || 0)).toLocaleString('en-PH', { minimumFractionDigits: 2 })}</span></p>
        <p><strong>Payment Status:</strong> <span class="badge bg-warning">${escapeHtml(reservation.paymentStatus || 'PENDING')}</span></p>
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
      detailRow.innerHTML = `<td colspan="8">${detailHTML}</td>`;
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
        const response = await fetch('http://localhost:3000/api/reservations/pending-payments');
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const pending = await response.json();

        if (!Array.isArray(pending) || pending.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No pending payments.</td></tr>';
            return;
        }

        // Store globally for expand functionality
        pendingPaymentsData = pending;
        tbody.innerHTML = '';

        pending.forEach(reservation => {
            const reservationId = reservation.reservationId || reservation._id || 'N/A';
            const customerName = reservation.full_name || reservation.customer_name || 'N/A';
            const serviceType = reservation.serviceType || 'N/A';
            const reference = reservation.gcashReferenceNumber || 'N/A';
            const amount = Number(reservation.finalTotal || 0).toLocaleString('en-PH', { minimumFractionDigits: 2 });
            const uploaded = reservation.receiptUploadedAt ? new Date(reservation.receiptUploadedAt).toLocaleString() : 'N/A';

            const row = document.createElement('tr');
            row.innerHTML = `
                <td><button class="btn btn-sm btn-outline-primary expand-payment-btn" onclick="togglePaymentDetails(this, '${reservation._id}')">+</button></td>
                <td>${reservationId}</td>
                <td>${escapeHtml(customerName)}</td>
                <td>${escapeHtml(serviceType)}</td>
                <td>${escapeHtml(reference)}</td>
                <td>₱${amount}</td>
                <td>${uploaded}</td>
                <td>
                    <button class="btn btn-success btn-sm" data-action="approve" data-id="${reservation._id}">Approve</button>
                    <button class="btn btn-danger btn-sm" data-action="reject" data-id="${reservation._id}">Reject</button>
                </td>
            `;

            tbody.appendChild(row);
        });

        tbody.querySelectorAll('button[data-action]').forEach(btn => {
            btn.addEventListener('click', async function() {
                const action = this.getAttribute('data-action');
                const id = this.getAttribute('data-id');
                await handlePaymentAction(id, action, this);
            });
        });

    } catch (error) {
        console.error('Error loading pending payments:', error);
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-danger">Failed to load pending payments.</td></tr>';
    }
}

async function handlePaymentAction(reservationId, action, buttonEl) {
    const token = sessionStorage.getItem('token') || localStorage.getItem('token') || '';
    const isApprove = action === 'approve';

    const endpoint = isApprove
        ? `http://localhost:3000/api/reservations/${reservationId}/approve-payment`
        : `http://localhost:3000/api/reservations/${reservationId}/reject-payment`;

    const payload = isApprove
        ? { status: 'PAID' }
        : { status: 'REJECTED', paymentStatus: 'REJECTED' };

    if (!isApprove) {
        const confirmReject = confirm('Reject this payment? The reservation will be marked as rejected.');
        if (!confirmReject) return;
    }

    buttonEl.disabled = true;
    const originalText = buttonEl.textContent;
    buttonEl.textContent = isApprove ? 'Approving...' : 'Rejecting...';

    try {
        const response = await fetch(endpoint, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify(payload)
        });

        const result = await response.json();
        if (!response.ok || !result.success) {
            throw new Error(result.message || 'Action failed');
        }

        showToast(isApprove ? 'Payment approved.' : 'Payment rejected.', 'success');
        
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
