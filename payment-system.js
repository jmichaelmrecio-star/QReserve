/**
 * payment-system.js
 * Handles GCash payment processing and summary display.
 */

function getUrlParameter(name) {
  const params = new URLSearchParams(window.location.search);
  return params.get(name);
}

let paymentSubmissionInProgress = false;

async function processGCashPayment(event, reservationId, reservationHash) {
  event.preventDefault();
  if (paymentSubmissionInProgress) return;

  const gcashReferenceNumber = document.getElementById("gcashReferenceNumber").value.trim();
  
  // Handlers for cart or single
  let finalHash = reservationHash || sessionStorage.getItem("payment_reservation_hash");
  const checkoutCart = sessionStorage.getItem("checkoutCart");
  if (checkoutCart) {
      try {
          const cart = JSON.parse(checkoutCart);
          finalHash = cart.map(item => item.reservationHash).filter(h => h).join(',');
      } catch(e) {}
  }

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
      showAlert("Payment submitted successfully!", "success");
      setTimeout(() => {
        window.location.href = `confirmation.html?hash=${finalHash}`;
      }, 1500);
    } else {
      showAlert(result.message || "Payment submission failed.", "error");
      paymentSubmissionInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Submit Payment & Confirm Booking";
      }
    }
  } catch (error) {
    console.error("Payment error:", error);
    paymentSubmissionInProgress = false;
  }
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
      
      if (serviceNameEl) serviceNameEl.textContent = res.serviceType;
      if (nameEl) nameEl.textContent = res.customer_name;
      if (totalEl) totalEl.textContent = parseFloat(res.finalTotal).toLocaleString(undefined, {minimumFractionDigits:2});
      if (payEl) payEl.textContent = (parseFloat(res.finalTotal) * 0.5).toLocaleString(undefined, {minimumFractionDigits:2});
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

        const checkoutCart = sessionStorage.getItem("checkoutCart");
        if (checkoutCart && typeof handleCartCheckout === "function") {
            handleCartCheckout();
        } else if (resId && resHash) {
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
