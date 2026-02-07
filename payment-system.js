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

  amenities.forEach(item => {
    const card = document.createElement("div");
    card.style.border = "1px solid #e0e0e0";
    card.style.borderRadius = "8px";
    card.style.padding = "0.75rem";
    card.style.background = "#fff";

    const checkInText = formatAmenityDateTime(item.checkIn, item.checkInTime);
    const checkOutText = formatAmenityDateTime(item.checkOut, item.checkOutTime);

    card.innerHTML = `
      <div style="font-weight: 600;">${item.serviceName || "Service"}</div>
      <div style="color: #666; font-size: 0.9rem;">${item.durationLabel || "N/A"}</div>
      <div style="color: #666; font-size: 0.9rem;">${checkInText} → ${checkOutText}</div>
      <div style="margin-top: 6px; font-weight: 600;">₱${Number(item.price || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}</div>
    `;

    container.appendChild(card);
  });
}

function populateSummaryFromMultiAmenity(multiAmenityReservation) {
  const amenities = multiAmenityReservation?.amenities || [];
  const originalTotal = multiAmenityReservation?.originalTotal || 0;
  const discountAmount = multiAmenityReservation?.appliedPromo?.discountAmount || 0;
  const finalTotal = multiAmenityReservation?.finalTotal || (originalTotal - discountAmount);

  const serviceNameEl = document.getElementById("serviceNameDisplay");
  const nameEl = document.getElementById("summaryCustomerName");
  const totalEl = document.getElementById("totalReservationCost");
  const payEl = document.getElementById("paymentAmount");
  const paySmallEl = document.getElementById("paymentAmountSmall");
  const remainingEl = document.getElementById("remainingBalance");

  if (serviceNameEl) {
    serviceNameEl.textContent = amenities.length > 1 ? `Multiple Amenities (${amenities.length})` : (amenities[0]?.serviceName || "Multiple Amenities");
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

async function fetchAndDisplaySummary(reservationId, reservationHash) {
  const url = `http://localhost:3000/api/reservations/details/${reservationId}/${reservationHash}`;
  try {
    const response = await fetch(url);
    const data = await response.json();
    if (data.success) {
      const res = data.reservation;
      const serviceNameEl = document.getElementById("summary-service-type") || document.getElementById("serviceNameDisplay");
      const nameEl = document.getElementById("summary-customer-name") || document.getElementById("summaryCustomerName");
      const totalEl = document.getElementById("summary-total-cost") || document.getElementById("totalReservationCost");
      const payEl = document.getElementById("summary-downpayment") || document.getElementById("paymentAmount");
      const paySmallEl = document.getElementById("paymentAmountSmall");
      const remainingEl = document.getElementById("remainingBalance");
      
      if (serviceNameEl) serviceNameEl.textContent = res.serviceType;
      // Use correct field name from backend (full_name)
      if (nameEl) nameEl.textContent = res.full_name || res.customer_name || '';
      const finalTotal = parseFloat(res.finalTotal || 0);
      if (totalEl) totalEl.textContent = finalTotal.toLocaleString(undefined, {minimumFractionDigits:2});
      const downPayment = finalTotal * 0.5;
      if (payEl) payEl.textContent = downPayment.toLocaleString(undefined, {minimumFractionDigits:2});
      if (paySmallEl) paySmallEl.textContent = downPayment.toLocaleString(undefined, {minimumFractionDigits:2});
      if (remainingEl) remainingEl.textContent = (finalTotal - downPayment).toLocaleString(undefined, {minimumFractionDigits:2});
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

        if (multiAmenityReservation && multiAmenityReservation.amenities) {
          populateSummaryFromMultiAmenity(multiAmenityReservation);
        }

        if (resId && resHash && !(multiAmenityReservation && multiAmenityReservation.amenities)) {
            fetchAndDisplaySummary(resId, resHash);
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
