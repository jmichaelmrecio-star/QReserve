/**
 * payment-system.js
 * Handles GCash payment processing and summary display.
 */

function getUrlParameter(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

let paymentSubmissionInProgress = false;

function formatAmenityDateTime(dateStr, timeStr) {
  if (!dateStr) return "Not Selected";

  let displayDate = dateStr;
  try {
    displayDate = new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric"
    });
  } catch (e) {
    displayDate = dateStr;
  }

  if (!timeStr) return displayDate;
  const normalizedTime = String(timeStr).includes(":") ? timeStr : formatTime24To12(parseInt(timeStr));
  return `${displayDate} ${normalizedTime}`;
}

function formatTime24To12(hour24) {
  const hour = parseInt(hour24);
  if (Number.isNaN(hour)) return "N/A";
  const ampm = hour >= 12 ? "PM" : "AM";
  const hour12 = hour % 12 || 12;
  return `${hour12}:00 ${ampm}`;
}

async function processGCashPayment(event, reservationId, reservationHash) {
  event.preventDefault();
  if (paymentSubmissionInProgress) return;

  const gcashReferenceNumber = document.getElementById("gcashReferenceNumber").value.trim();
  
  // Validate GCash reference number format (must be 10-13 digits only)
  if (!/^\d{10,13}$/.test(gcashReferenceNumber)) {
    showAlert("Invalid GCash reference number. Please enter 10-13 digits only.", "error");
    return;
  }
  
  let finalHash = reservationHash || sessionStorage.getItem("payment_reservation_hash");

  if (!finalHash || !window.gcashReceiptFile) {
    showAlert("Please provide the reference number and upload the receipt.", "warning");
    return;
  }

  paymentSubmissionInProgress = true;
  const btn = document.getElementById("submit-payment-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing Payment...";
  }

  const formData = new FormData();
  formData.append("reservationHash", finalHash);
  formData.append("gcashReferenceNumber", gcashReferenceNumber);
  formData.append("receiptImage", window.gcashReceiptFile);
  formData.append("paymentType", "downpayment");

  try {
    const response = await fetch("http://localhost:3000/api/payment/upload", {
      method: "POST",
      body: formData
    });

    const result = await response.json();
    if (response.ok) {
      showAlert("Payment submitted. Awaiting admin verification. Your QR code will be emailed after approval.", "success");
      setTimeout(() => {
        window.location.href = "customer-dashboard.html";
      }, 1500);
    } else {
      showAlert(result.message || "Payment submission failed.", "error");
      paymentSubmissionInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit Payment for Verification";
      }
    }
  } catch (error) {
    console.error("Payment error:", error);
    paymentSubmissionInProgress = false;
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Submit Payment for Verification";
    }
  }
}

function renderMultiAmenityItems(amenities) {
  const section = document.getElementById("cart-items-section");
  const container = document.getElementById("cart-items-for-payment");
  if (!section || !container) return;

  if (!Array.isArray(amenities) || amenities.length === 0) {
    section.style.display = "none";
    return;
  }

  section.style.display = "block";
  container.innerHTML = "";

  amenities.forEach((item, index) => {
    const card = document.createElement("div");
    card.style.border = "1px solid #e0e0e0";
    card.style.borderRadius = "8px";
    card.style.padding = "1rem";
    card.style.background = "#fff";
    card.style.marginBottom = "0.75rem";

    const checkInText = formatAmenityDateTime(item.checkIn, item.checkInTime);
    const checkOutText = formatAmenityDateTime(item.checkOut, item.checkOutTime);
    const inclusionsId = `inclusions-${index}`;
    const toggleBtnId = `toggle-inclusions-${index}`;
    
    const hasInclusions = Array.isArray(item.inclusions) && item.inclusions.length > 0;
    const inclusionsHTML = hasInclusions 
      ? item.inclusions.map(inc => `<li style="margin: 0.25rem 0;">${inc}</li>`).join('')
      : '<li style="margin: 0.25rem 0; color: #999;">No inclusions listed</li>';

    card.innerHTML = `
      <div style="font-weight: 600; font-size: 0.95rem; margin-bottom: 0.5rem; color: #333;">
        <span style="font-weight: 700;">Amenity name:</span> ${item.serviceName || "Service"}
      </div>
      
      <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
        <span style="font-weight: 700;">Duration of stay:</span> ${item.durationLabel || "N/A"}
      </div>
      
      <div style="color: #666; font-size: 0.9rem; margin-bottom: 0.5rem;">
        <span style="font-weight: 700;">Number of guests:</span> ${item.guests || 1}
      </div>
      
      <div style="color: #666; font-size: 0.9rem; margin-bottom: 1rem;">
        <span style="font-weight: 700;">Check-in and Check-out date and time:</span> ${checkInText} → ${checkOutText}
      </div>
      
      ${hasInclusions ? `
      <div style="margin-bottom: 1rem;">
        <div style="font-weight: 700; color: #333; font-size: 0.95rem; margin-bottom: 0.5rem;">Inclusions:</div>
        <button type="button" id="${toggleBtnId}" style="
          background: none;
          border: none;
          color: #28a745;
          cursor: pointer;
          font-weight: 600;
          padding: 0;
          font-size: 0.9rem;
          display: flex;
          align-items: center;
          gap: 0.5rem;
        ">
          <span style="display: inline-block; transition: transform 0.3s;">▶</span>
          <span>${item.inclusions.length} item${item.inclusions.length !== 1 ? 's' : ''}</span>
        </button>
        <div id="${inclusionsId}" style="
          display: none;
          margin-top: 0.5rem;
          padding: 0.75rem;
          background: #f8f9fa;
          border-left: 3px solid #28a745;
          border-radius: 4px;
        ">
          <ul style="
            margin: 0;
            padding-left: 1.5rem;
            list-style-type: disc;
            color: #555;
            font-size: 0.9rem;
          ">
            ${inclusionsHTML}
          </ul>
        </div>
      </div>
      ` : ''}
      
      <div style="
        margin-top: 1rem;
        padding-top: 1rem;
        border-top: 1px solid #e9ecef;
        font-weight: 600;
        font-size: 1.1rem;
        color: #28a745;
      ">
        <span style="font-weight: 700;">Price:</span> ₱${Number(item.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
      </div>
    `;

    container.appendChild(card);

    // Add toggle functionality for inclusions
    if (hasInclusions) {
      const toggleBtn = document.getElementById(toggleBtnId);
      const inclusionsContent = document.getElementById(inclusionsId);
      const arrow = toggleBtn.querySelector('span:first-child');

      toggleBtn.addEventListener('click', function(e) {
        e.preventDefault();
        const isHidden = inclusionsContent.style.display === 'none';
        inclusionsContent.style.display = isHidden ? 'block' : 'none';
        arrow.style.transform = isHidden ? 'rotate(90deg)' : 'rotate(0deg)';
      });
    }
  });
}

function populateSummaryFromMultiAmenity(multiAmenityReservation) {
  const amenities = multiAmenityReservation?.amenities || [];
  const originalTotal = multiAmenityReservation?.originalTotal || 0;
  const discountAmount = multiAmenityReservation?.appliedPromo?.discountAmount || 0;
  const finalTotal = multiAmenityReservation?.finalTotal || (originalTotal - discountAmount);

  const reservationTypeEl = document.getElementById("reservationTypeDisplay");
  const amenitiesListEl = document.getElementById("amenitiesListDisplay");
  const amenitiesListRow = document.getElementById("amenitiesListRow");
  const nameEl = document.getElementById("summaryCustomerName");
  const totalEl = document.getElementById("totalReservationCost");
  const payEl = document.getElementById("paymentAmount");
  const paySmallEl = document.getElementById("paymentAmountSmall");
  const remainingEl = document.getElementById("remainingBalance");

  // Set reservation type
  if (reservationTypeEl) {
    reservationTypeEl.textContent = amenities.length > 1 ? "Multi-Amenity" : "Single Amenity";
  }

  // Set amenities list (only for multi-amenity)
  if (amenities.length > 1 && amenitiesListEl && amenitiesListRow) {
    const amenityNames = amenities.map(item => item.serviceName || "Service").join(", ");
    amenitiesListEl.textContent = amenityNames;
    amenitiesListRow.style.display = "flex";
  }

  if (nameEl) {
    const user = (typeof getLoggedInUser === "function") ? getLoggedInUser() : null;
    nameEl.textContent = user?.full_name || user?.email || nameEl.textContent || "";
  }

  const totalValue = parseFloat(finalTotal || 0);
  const downPayment = totalValue * 0.5;

  if (totalEl) totalEl.textContent = totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (payEl) payEl.textContent = downPayment.toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (paySmallEl) paySmallEl.textContent = downPayment.toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (remainingEl) remainingEl.textContent = (totalValue - downPayment).toLocaleString(undefined, { minimumFractionDigits: 2 });

  renderMultiAmenityItems(amenities);
}

function populateSummaryFromSingleAmenity() {
  // Get single-amenity data from sessionStorage
  const serviceName = sessionStorage.getItem('selectedServiceName') || 'Service';
  const servicePrice = parseFloat(sessionStorage.getItem('selectedServicePrice')) || 0;
  const durationLabel = sessionStorage.getItem('selectedDurationLabel') || sessionStorage.getItem('selectedDuration') || 'N/A';
  const guests = parseInt(sessionStorage.getItem('guests')) || 1;
  const checkIn = sessionStorage.getItem('selectedCheckIn');
  const checkInTime = sessionStorage.getItem('selectedCheckInTime');
  const checkOut = sessionStorage.getItem('selectedCheckOut');
  const checkOutTime = sessionStorage.getItem('selectedCheckOutTime');
  
  const reservationTypeEl = document.getElementById("reservationTypeDisplay");
  const nameEl = document.getElementById("summaryCustomerName");
  const totalEl = document.getElementById("totalReservationCost");
  const payEl = document.getElementById("paymentAmount");
  const paySmallEl = document.getElementById("paymentAmountSmall");
  const remainingEl = document.getElementById("remainingBalance");
  const amenitiesListRow = document.getElementById("amenitiesListRow");

  // Set reservation type
  if (reservationTypeEl) {
    reservationTypeEl.textContent = "Single Amenity";
  }

  // Hide multi-amenity list row
  if (amenitiesListRow) {
    amenitiesListRow.style.display = "none";
  }

  // Set customer name
  if (nameEl) {
    const user = (typeof getLoggedInUser === "function") ? getLoggedInUser() : null;
    nameEl.textContent = user?.full_name || user?.email || "";
  }

  // Calculate pricing
  const totalValue = servicePrice;
  const downPayment = totalValue * 0.5;

  if (totalEl) totalEl.textContent = totalValue.toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (payEl) payEl.textContent = downPayment.toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (paySmallEl) paySmallEl.textContent = downPayment.toLocaleString(undefined, { minimumFractionDigits: 2 });
  if (remainingEl) remainingEl.textContent = (totalValue - downPayment).toLocaleString(undefined, { minimumFractionDigits: 2 });

  // Create single amenity item display (similar to multi-amenity)
  const singleAmenityItem = {
    serviceName: serviceName,
    durationLabel: durationLabel,
    guests: guests,
    checkIn: checkIn,
    checkInTime: checkInTime,
    checkOut: checkOut,
    checkOutTime: checkOutTime,
    price: servicePrice,
    inclusions: [] // Could retrieve from sessionStorage if stored
  };

  renderMultiAmenityItems([singleAmenityItem]);
}

async function fetchAndDisplaySummary(reservationId, reservationHash) {
  const url = `http://localhost:3000/api/reservations/details/${reservationId}/${reservationHash}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.success) {
      const res = data.reservation;
      const reservationTypeEl = document.getElementById("reservationTypeDisplay");
      const nameEl = document.getElementById("summary-customer-name") || document.getElementById("summaryCustomerName");
      const totalEl = document.getElementById("summary-total-cost") || document.getElementById("totalReservationCost");
      const payEl = document.getElementById("summary-downpayment") || document.getElementById("paymentAmount");
      const paySmallEl = document.getElementById("paymentAmountSmall");
      const remainingEl = document.getElementById("remainingBalance");
      const amenitiesListRow = document.getElementById("amenitiesListRow");
      
      // For single reservations, show "Single Amenity"
      if (reservationTypeEl) reservationTypeEl.textContent = "Single Amenity";
      
      // Hide multi-amenity list row
      if (amenitiesListRow) amenitiesListRow.style.display = "none";
      
      // Use correct field name from backend (full_name)
      if (nameEl) nameEl.textContent = res.full_name || res.customer_name || '';
      const finalTotal = parseFloat(res.finalTotal || 0);
      if (totalEl) totalEl.textContent = finalTotal.toLocaleString(undefined, {minimumFractionDigits:2});
      const downPayment = finalTotal * 0.5;
      if (payEl) payEl.textContent = downPayment.toLocaleString(undefined, {minimumFractionDigits:2});
      if (paySmallEl) paySmallEl.textContent = downPayment.toLocaleString(undefined, {minimumFractionDigits:2});
      if (remainingEl) remainingEl.textContent = (finalTotal - downPayment).toLocaleString(undefined, {minimumFractionDigits:2});
      
      // Render single amenity item card
      const singleAmenityItem = {
        serviceName: res.serviceName || 'Service',
        durationLabel: res.durationLabel || res.selectedDuration || 'N/A',
        guests: res.guests || 1,
        checkIn: res.check_in ? new Date(res.check_in).toISOString().split('T')[0] : null,
        checkInTime: res.checkInTimeSlot || null,
        checkOut: res.check_out ? new Date(res.check_out).toISOString().split('T')[0] : null,
        checkOutTime: res.checkOutTimeSlot || null,
        price: finalTotal,
        inclusions: res.inclusions || []
      };
      
      renderMultiAmenityItems([singleAmenityItem]);
    }
  } catch (error) {
    console.error("Summary fetch error:", error);
  }
}

// Initialization for payment.html
document.addEventListener("DOMContentLoaded", () => {
    if (window.location.pathname.includes("payment.html")) {
        let resId = getUrlParameter("reservationId") || sessionStorage.getItem("payment_reservation_id");
        let resHash = getUrlParameter("hash") || sessionStorage.getItem("payment_reservation_hash");

        const multiAmenityReservation = JSON.parse(
          sessionStorage.getItem("multiAmenityReservation") || "null"
        );

        // Multi-amenity reservation
        if (multiAmenityReservation && multiAmenityReservation.amenities) {
          populateSummaryFromMultiAmenity(multiAmenityReservation);
        } 
        // Single-amenity reservation from sessionStorage
        else if (sessionStorage.getItem('selectedServiceName') && sessionStorage.getItem('selectedServicePrice')) {
          populateSummaryFromSingleAmenity();
        }
        // Fallback: fetch from backend if we have ID and hash but no sessionStorage
        else if (resId && resHash) {
          fetchAndDisplaySummary(resId, resHash);
        }
        // No data available
        else {
          console.warn('⚠️ No reservation data found in sessionStorage or URL parameters');
        }

        const gcashForm = document.getElementById("gcashPaymentForm");
        if (gcashForm) {
            gcashForm.addEventListener("submit", (e) => processGCashPayment(e, resId, resHash));
        }
    }
});

// Expose globals
window.processGCashPayment = processGCashPayment;
window.fetchAndDisplaySummary = fetchAndDisplaySummary;
