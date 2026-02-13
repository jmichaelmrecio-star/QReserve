// my-reservations.js
// This script will handle fetching and rendering the user's reservations in the my-reservations.html page.

let refreshIntervalId = null;
let activeStatusFilter = "ALL";

document.addEventListener("DOMContentLoaded", async function () {
  const statusFilter = document.getElementById("reservationStatusFilter");
  if (statusFilter) {
    activeStatusFilter = statusFilter.value || "ALL";
    statusFilter.addEventListener("change", function () {
      activeStatusFilter = this.value || "ALL";
      loadAndRenderReservations();
    });
  }
  const refreshBtn = document.getElementById("reservationsRefreshBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", function () {
      loadAndRenderReservations();
    });
  }
  loadAndRenderReservations();

  // Set up auto-refresh: reload data every 30 seconds
  refreshIntervalId = setInterval(loadAndRenderReservations, 30000);

  // Reload on window focus (if user switches tabs/windows and comes back)
  window.addEventListener("focus", loadAndRenderReservations);
});

async function loadAndRenderReservations() {
  const tbody = document.getElementById("user-reservations-list");

  // Show loading state
  tbody.innerHTML =
    '<tr><td colspan="10" style="text-align:center;padding:2rem;">Loading your reservations...</td></tr>';

  try {
    // Get logged-in user from session storage
    const loggedInUserStr = sessionStorage.getItem("loggedInUser");
    if (!loggedInUserStr) {
      tbody.innerHTML =
        '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#d97757;">Please log in to view your reservations.</td></tr>';
      return;
    }

    const loggedInUser = JSON.parse(loggedInUserStr);
    const userEmail = loggedInUser.email;

    if (!userEmail) {
      tbody.innerHTML =
        '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#d97757;">Error: User email not found.</td></tr>';
      return;
    }

    // Fetch reservations from API
    const response = await fetch(
      "http://localhost:3000/api/reservations/user/" +
        encodeURIComponent(userEmail),
    );

    if (!response.ok) {
      throw new Error("HTTP " + response.status + ": " + response.statusText);
    }

    const data = await response.json();

    if (!data.success || !Array.isArray(data.reservations)) {
      throw new Error("Invalid response format from server");
    }

    const reservations = data.reservations;

    // Filter out CART items and sort by date (most recent first)
    const activeReservations = reservations
      .filter((r) => r.status !== "CART")
      .sort((a, b) => new Date(b.dateCreated) - new Date(a.dateCreated));

    if (activeReservations.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10" style="text-align:center;padding:2rem;">No reservations found. <a href="services-list.html" style="color:var(--primary-color);text-decoration:underline;">Book your first stay!</a></td></tr>';
      return;
    }

    const filteredReservations =
      activeStatusFilter === "ALL"
        ? activeReservations
        : activeReservations.filter(
            (r) => String(r.status || "").toUpperCase() === activeStatusFilter,
          );

    if (filteredReservations.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="10" style="text-align:center;padding:2rem;">No reservations match this status.</td></tr>';
      return;
    }

    // Render reservations
    tbody.innerHTML = "";
    filteredReservations.forEach((res) => {
      const tr = document.createElement("tr");

      // Format dates
      const checkinDate = res.check_in
        ? new Date(res.check_in).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A";
      const checkoutDate = res.check_out
        ? new Date(res.check_out).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })
        : "N/A";

      // Status badge classes
      const statusClassMap = {
        PENDING: "status-pending",
        PAID: "status-paid",
        CONFIRMED: "status-confirmed",
        CHECKED_IN: "status-checked-in",
        COMPLETED: "status-completed",
        CANCELLED: "status-cancelled",
        REJECTED: "status-rejected",
      };
      const statusClass = statusClassMap[res.status] || "status-pending";

      // Calculate total paid based on payment type and payment status
      let totalPaidAmount = 0;
      let paymentTypeLabel = "N/A";
      let paymentTypeBadgeClass = "";
      let paymentStatusLabel = "Pending";
      let paymentStatusBadgeClass = "badge-warning";

      const finalTotal = parseFloat(res.finalTotal) || 0;
      const downPaymentAmount = finalTotal * 0.5;

      // Determine payment type
      if (
        res.paymentType === "downpayment" ||
        res.paymentType === "down-payment"
      ) {
        paymentTypeLabel = "Down Payment (50%)";
        paymentTypeBadgeClass = "badge-info";
        if (res.paymentStatus === "partial-payment") {
          paymentStatusLabel = "50% Submitted";
          paymentStatusBadgeClass = "badge-info";
          totalPaidAmount = downPaymentAmount;
        } else if (res.paymentStatus === "partially-paid") {
          paymentStatusLabel = "50% Approved";
          paymentStatusBadgeClass = "badge-primary";
          totalPaidAmount = downPaymentAmount;
        } else if (res.paymentStatus === "full-payment") {
          paymentStatusLabel = "Remaining Submitted";
          paymentStatusBadgeClass = "badge-info";
          totalPaidAmount = downPaymentAmount;
        } else if (
          res.paymentStatus === "fully-paid" ||
          ["PAID", "CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(res.status)
        ) {
          paymentStatusLabel = "Fully Paid";
          paymentStatusBadgeClass = "badge-success";
          totalPaidAmount = finalTotal;
        } else if (res.status === "CANCELLED" && res.receiptFileName) {
          // Preserve payment status for cancelled reservations that have payment receipts
          paymentStatusLabel = "50% Submitted";
          paymentStatusBadgeClass = "badge-info";
          totalPaidAmount = downPaymentAmount;
        } else {
          paymentStatusLabel = "Pending";
          paymentStatusBadgeClass = "badge-warning";
          totalPaidAmount = 0;
        }
      } else if (res.paymentType === "full") {
        paymentTypeLabel = "Full Payment (100%)";
        paymentTypeBadgeClass = "badge-success";
        if (res.paymentStatus === "full-payment") {
          paymentStatusLabel = "100% Submitted";
          paymentStatusBadgeClass = "badge-info";
          totalPaidAmount = finalTotal;
        } else if (
          res.paymentStatus === "fully-paid" ||
          ["PAID", "CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(res.status)
        ) {
          paymentStatusLabel = "Fully Paid";
          paymentStatusBadgeClass = "badge-success";
          totalPaidAmount = finalTotal;
        } else if (res.status === "CANCELLED" && res.receiptFileName) {
          // Preserve payment status for cancelled reservations that have payment receipts
          paymentStatusLabel = "100% Submitted";
          paymentStatusBadgeClass = "badge-info";
          totalPaidAmount = finalTotal;
        } else {
          paymentStatusLabel = "Pending";
          paymentStatusBadgeClass = "badge-warning";
          totalPaidAmount = 0;
        }
      } else {
        paymentTypeLabel = "Standard";
        paymentTypeBadgeClass = "badge-secondary";
        if (
          ["PAID", "CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(res.status)
        ) {
          paymentStatusLabel = "Paid";
          paymentStatusBadgeClass = "badge-success";
          totalPaidAmount = finalTotal;
        } else if (res.status === "CANCELLED" && res.receiptFileName) {
          // Preserve payment status for cancelled reservations that have payment receipts
          paymentStatusLabel = "100% Paid";
          paymentStatusBadgeClass = "badge-info";
          totalPaidAmount = finalTotal;
        } else {
          paymentStatusLabel = "Pending";
          paymentStatusBadgeClass = "badge-warning";
          totalPaidAmount = 0;
        }
      }

      const totalPaid =
        "₱" +
        totalPaidAmount.toLocaleString("en-PH", { minimumFractionDigits: 2 });

      // Payment type badge
      const paymentTypeBadge =
        '<span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: 600; ' +
        (paymentTypeBadgeClass === "badge-info"
          ? "background:#d4e5f7;color:#0066cc;"
          : "background:#d4edda;color:#155724;") +
        '">' +
        paymentTypeLabel +
        "</span>";

      const paymentStatusBadge =
        '<span style="display: inline-block; padding: 4px 10px; border-radius: 4px; font-size: 0.85rem; font-weight: 600; ' +
        (paymentStatusBadgeClass === "badge-success"
          ? "background:#d4edda;color:#155724;"
          : paymentStatusBadgeClass === "badge-primary"
            ? "background:#dbeafe;color:#1d4ed8;"
            : paymentStatusBadgeClass === "badge-info"
              ? "background:#d4e5f7;color:#0066cc;"
              : "background:#fff3cd;color:#856404;") +
        '">' +
        paymentStatusLabel +
        "</span>";

      // Receipt image
      const receiptImg = res.receiptFileName
        ? '<a href="http://localhost:3000/uploads/' +
          res.receiptFileName +
          '" target="_blank"><img src="http://localhost:3000/uploads/' +
          res.receiptFileName +
          '" alt="Receipt" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 2px 8px #ccc;"></a>'
        : '<span style="color:#999;">No receipt</span>';

      const hasSubmittedPayment =
        Boolean(res.receiptFileName) ||
        [
          "partial-payment",
          "partially-paid",
          "full-payment",
          "fully-paid",
          "PAID",
        ].includes(res.paymentStatus);
      const shouldShowPayNow = res.status === "PENDING" && !hasSubmittedPayment;
      const hasPaymentLink =
        (res._id || res.reservationId) && res.reservationHash;
      const paymentLink = hasPaymentLink
        ? "payment.html?reservationId=" +
          encodeURIComponent(res._id || res.reservationId) +
          "&hash=" +
          encodeURIComponent(res.reservationHash)
        : "";

      const qrEnabled =
        ["CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(res.status) &&
        res.reservationHash;
      const canCancel = !["COMPLETED", "CANCELLED", "REJECTED"].includes(
        res.status,
      );

      let actionButton = "";
      if (shouldShowPayNow) {
        actionButton = hasPaymentLink
          ? '<a href="' +
            paymentLink +
            "\" onclick=\"sessionStorage.setItem('payment_reservation_id','" +
            (res._id || res.reservationId) +
            "');sessionStorage.setItem('payment_reservation_hash','" +
            res.reservationHash +
            '\');" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: var(--primary-color); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; transition: background-color 0.3s; border: none; cursor: pointer; min-width: 90px;" onmouseover="this.style.backgroundColor=\'#1e7a34\'" onmouseout="this.style.backgroundColor=\'var(--primary-color)\'">Pay Now</a>'
          : '<button style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: #cccccc; color: #666666; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: not-allowed; min-width: 90px;" disabled>Pay Now</button>';
      } else if (qrEnabled) {
        actionButton =
          '<a href="confirmation.html?hash=' +
          res.reservationHash +
          '" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: var(--primary-color); color: white; text-decoration: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; transition: background-color 0.3s; border: none; cursor: pointer; min-width: 90px;" onmouseover="this.style.backgroundColor=\'#1e7a34\'" onmouseout="this.style.backgroundColor=\'var(--primary-color)\'">View QR</a>';
      } else {
        actionButton =
          '<button style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: #cccccc; color: #666666; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; cursor: not-allowed; min-width: 90px;" disabled>View QR</button>';
      }

      if (canCancel) {
        actionButton +=
          " <button onclick=\"customerCancelReservation('" +
          (res._id || res.reservationId) +
          "', '" +
          (res.serviceName || res.serviceType || "Reservation") +
          '\')" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: #d97757; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; transition: background-color 0.3s; cursor: pointer; min-width: 90px;" onmouseover="this.style.backgroundColor=\'#c8644a\'" onmouseout="this.style.backgroundColor=\'#d97757\'">Cancel</button>';
      }

      // Add View More button to show full reservation details
      actionButton +=
        " <button onclick=\"showViewMoreModal('" +
        encodeURIComponent(JSON.stringify(res)) +
        '\')\" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: #6c757d; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; transition: background-color 0.3s; cursor: pointer; min-width: 90px;" onmouseover="this.style.backgroundColor=\'#5a6268\'" onmouseout="this.style.backgroundColor=\'#6c757d\'">View More</button>';

      // Add reschedule button for CONFIRMED reservations only
      const canReschedule = res.status === "CONFIRMED" || (res.status === "PENDING" && ["partially-paid", "fully-paid"].includes(res.paymentStatus));
      if (canReschedule) {
        actionButton +=
          " <button onclick=\"customerRequestReschedule('" +
          (res._id || res.reservationId) +
          "', '" +
          (res.serviceName || res.serviceType || "Reservation") +
          '\')\" style="display: inline-flex; align-items: center; justify-content: center; padding: 6px 10px; background-color: #0066cc; color: white; border: none; border-radius: 6px; font-weight: 600; font-size: 0.85rem; transition: background-color 0.3s; cursor: pointer; min-width: 100px;" onmouseover="this.style.backgroundColor=\'#0052a3\'" onmouseout="this.style.backgroundColor=\'#0066cc\'">Reschedule</button>';
      }

      actionButton =
        '<div style="display: flex; justify-content: center; align-items: center; gap: 8px; flex-wrap: wrap;">' +
        actionButton +
        "</div>";

      const reservationId = res.isMultiAmenity
        ? res.reservationId +
          '<br><small style="color:#007bff;">Multi-Amenity ' +
          (res.multiAmenityIndex + 1) +
          "/" +
          res.multiAmenityTotal +
          "</small>"
        : res.reservationId || res._id;

      tr.innerHTML =
        "<td><strong>" +
        reservationId +
        "</strong></td><td>" +
        (res.serviceName || res.serviceType || "N/A") +
        "</td><td>" +
        checkinDate +
        "</td><td>" +
        checkoutDate +
        '</td><td><span class="' +
        statusClass +
        '">' +
        res.status +
        "</span></td><td>" +
        paymentTypeBadge +
        "</td><td>" +
        paymentStatusBadge +
        "</td><td>" +
        totalPaid +
        "</td><td>" +
        receiptImg +
        "</td><td>" +
        actionButton +
        "</td>";
      tbody.appendChild(tr);
    });
  } catch (error) {
    console.error("Error fetching reservations:", error);
    tbody.innerHTML =
      '<tr><td colspan="10" style="text-align:center;padding:2rem;color:#d97757;">Failed to load reservations. ' +
      error.message +
      '<br><button onclick="location.reload()" style="margin-top:1rem;padding:0.5rem 1rem;background:var(--primary-color);color:white;border:none;border-radius:4px;cursor:pointer;">Retry</button></td></tr>';
  }
}

function customerCancelReservation(reservationId, serviceName) {
  const modal = document.getElementById("cancelReservationModal");
  const serviceNameEl = document.getElementById("cancelServiceName");
  const confirmBtn = document.getElementById("confirmCancelBtn");
  const keepBtn = document.getElementById("keepReservationBtn");
  const reasonModal = document.getElementById("cancelReasonModal");
  const reasonServiceNameEl = document.getElementById(
    "cancelReasonServiceName",
  );
  const reasonSelect = document.getElementById("cancelReasonSelect");
  const reasonText = document.getElementById("cancelReasonText");
  const submitReasonBtn = document.getElementById("submitCancelReasonBtn");
  const backToCancelBtn = document.getElementById("backToCancelBtn");
  const resultModal = document.getElementById("cancelResultModal");
  const resultTitle = document.getElementById("cancelResultTitle");
  const resultMessage = document.getElementById("cancelResultMessage");
  const resultBtn = document.getElementById("cancelResultBtn");

  if (!modal) {
    console.error("Cancel reservation modal not found");
    return;
  }

  serviceNameEl.textContent = serviceName || "your";
  if (reasonServiceNameEl) {
    reasonServiceNameEl.textContent = serviceName || "your";
  }

  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  const showResultModal = (title, message, isSuccess) => {
    if (!resultModal || !resultTitle || !resultMessage || !resultBtn) return;
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    resultTitle.style.color = isSuccess ? "#1e7a34" : "#d97757";
    resultModal.style.display = "flex";
    document.body.style.overflow = "hidden";

    resultBtn.onclick = function () {
      resultModal.style.display = "none";
      document.body.style.overflow = "auto";
    };
  };

  confirmBtn.onclick = async function () {
    modal.style.display = "none";
    document.body.style.overflow = "auto";

    if (reasonModal) {
      if (reasonSelect) reasonSelect.value = "";
      if (reasonText) reasonText.value = "";
      reasonModal.style.display = "flex";
      document.body.style.overflow = "hidden";
    }
  };

  if (backToCancelBtn) {
    backToCancelBtn.onclick = function () {
      if (reasonModal) reasonModal.style.display = "none";
      modal.style.display = "flex";
      document.body.style.overflow = "hidden";
    };
  }

  if (!submitReasonBtn) {
    return;
  }

  submitReasonBtn.onclick = async function () {
    const selectedReason = reasonSelect ? reasonSelect.value.trim() : "";
    const additionalReason = reasonText ? reasonText.value.trim() : "";
    const composedReason = [selectedReason, additionalReason]
      .filter(Boolean)
      .join(" - ");

    if (!composedReason || composedReason.length < 10) {
      showResultModal(
        "Cancellation Reason Required",
        "Please provide a reason with at least 10 characters before submitting.",
        false,
      );
      return;
    }

    if (reasonModal) {
      reasonModal.style.display = "none";
      document.body.style.overflow = "auto";
    }

    confirmBtn.classList.add("is-processing");
    const originalText = confirmBtn.textContent;
    confirmBtn.textContent = "Cancelling...";

    try {
      const loggedInUserStr = sessionStorage.getItem("loggedInUser");
      let requestedBy = "";
      let requestedByEmail = "";

      if (loggedInUserStr) {
        try {
          const loggedInUser = JSON.parse(loggedInUserStr);
          const fullName = [
            loggedInUser.first_name,
            loggedInUser.middle_name,
            loggedInUser.last_name,
          ]
            .filter(Boolean)
            .join(" ")
            .trim();
          requestedBy = fullName || loggedInUser.full_name || "";
          requestedByEmail = loggedInUser.email || "";
        } catch (e) {
          console.error("Error parsing loggedInUser:", e);
        }
      }

      const response = await fetch(
        "http://localhost:3000/api/reservations/request-cancel/" +
          reservationId,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer " + (sessionStorage.getItem("authToken") || ""),
          },
          body: JSON.stringify({
            reason: composedReason,
            requestedBy: requestedBy,
            requestedByEmail: requestedByEmail,
          }),
        },
      );

      if (response.ok) {
        await loadAndRenderReservations();
        showResultModal(
          "Reservation Cancelled",
          "Your reservation has been cancelled successfully. The list has been updated.",
          true,
        );
      } else {
        const error = await response.json();
        showResultModal(
          "Cancellation Failed",
          error.message || "Failed to cancel reservation. Please try again.",
          false,
        );
      }
    } catch (error) {
      console.error("Error cancelling reservation:", error);
      showResultModal("Cancellation Failed", "Error: " + error.message, false);
    } finally {
      confirmBtn.classList.remove("is-processing");
      confirmBtn.textContent = originalText;
    }
  };

  keepBtn.onclick = function () {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  };
}

// Store current reschedule reservation data globally
let rescheduleReservationData = null;

// Manual calculation function (triggered by button click)
function manualCalculateRescheduleCheckout() {
  const dateInput = document.getElementById("rescheduleCheckInDate");
  const timeInput = document.getElementById("rescheduleCheckInTime");
  const checkoutDisplay = document.getElementById("rescheduleCheckoutDisplay");
  const checkoutDateEl = document.getElementById("rescheduleCheckoutDate");
  const checkoutTimeEl = document.getElementById("rescheduleCheckoutTime");
  const formMessage = document.getElementById("rescheduleFormMessage");
  
  // Validate inputs exist
  if (!dateInput || !timeInput) {
    if (formMessage) {
      formMessage.textContent = "Date and time inputs not found";
      formMessage.classList.remove("d-none");
    }
    return;
  }
  
  const checkinDateStr = dateInput.value;
  const checkinTimeStr = timeInput.value;
  
  if (!checkinDateStr || !checkinTimeStr) {
    if (formMessage) {
      formMessage.textContent = "Please select both a check-in date and time";
      formMessage.classList.remove("d-none");
    }
    return;
  }
  
  if (!rescheduleReservationData) {
    if (formMessage) {
      formMessage.textContent = "Reservation data not loaded. Please try again.";
      formMessage.classList.remove("d-none");
    }
    return;
  }
  
  // Hide error message if calculation succeeds
  if (formMessage) {
    formMessage.classList.add("d-none");
  }
  
  // Parse check-in date and time
  const [year, month, day] = checkinDateStr.split("-");
  const checkinDate = new Date(year, month - 1, day);
  const checkinHour = parseInt(checkinTimeStr);
  checkinDate.setHours(checkinHour, 0, 0, 0);
  
  // Calculate duration from original reservation to determine if hour-based or night-based
  let durationHours = 0;
  let nights = 1;
  let isHourBased = false;
  
  if (rescheduleReservationData.check_in && rescheduleReservationData.check_out) {
    const origIn = new Date(rescheduleReservationData.check_in);
    const origOut = new Date(rescheduleReservationData.check_out);
    const totalHours = (origOut - origIn) / (1000 * 60 * 60);
    
    if (totalHours < 24) {
      // Hour-based duration (e.g., 22 hours)
      isHourBased = true;
      durationHours = Math.round(totalHours);
    } else {
      // Night-based duration (overnight stay)
      nights = Math.ceil(totalHours / 24);
    }
  }
  
  let checkoutDate = new Date(checkinDate);
  let checkoutHour = checkinHour;
  
  if (isHourBased) {
    // Add hours to check-in time
    checkoutDate.setHours(checkinDate.getHours() + durationHours);
    checkoutHour = checkoutDate.getHours();
  } else {
    // Add nights (keep same time)
    checkoutDate.setDate(checkinDate.getDate() + nights);
  }
  
  // Format display
  const dateFormatter = new Intl.DateTimeFormat("en-US", { 
    year: "numeric", 
    month: "long", 
    day: "numeric" 
  });
  
  const checkoutDateStr = dateFormatter.format(checkoutDate);
  const period = checkoutHour >= 12 ? "PM" : "AM";
  const displayHour = checkoutHour > 12 ? checkoutHour - 12 : checkoutHour === 0 ? 12 : checkoutHour;
  const checkoutTimeStr = `${displayHour}:00 ${period}`;
  
  // Update display
  checkoutDateEl.textContent = checkoutDateStr;
  checkoutTimeEl.textContent = checkoutTimeStr;
  checkoutDisplay.style.display = "block";
}

function customerRequestReschedule(reservationId, serviceName) {
  const modal = document.getElementById("rescheduleReservationModal");
  const reasonInput = document.getElementById("rescheduleReason");
  const submitBtn = document.getElementById("submitRescheduleBtn");
  const cancelBtn = document.getElementById("cancelRescheduleBtn");
  const formMessage = document.getElementById("rescheduleFormMessage");
  const resultModal = document.getElementById("rescheduleResultModal");
  const resultTitle = document.getElementById("rescheduleResultTitle");
  const resultMessage = document.getElementById("rescheduleResultMessage");
  const resultBtn = document.getElementById("rescheduleResultBtn");

  if (!modal) {
    console.error("Reschedule modal not found");
    return;
  }

  // Show modal first
  modal.style.display = "flex";
  document.body.style.overflow = "hidden";

  // After modal is visible, get fresh references to form elements
  setTimeout(() => {
    const dateInput = document.getElementById("rescheduleCheckInDate");
    const timeInput = document.getElementById("rescheduleCheckInTime");
    const checkoutDisplay = document.getElementById("rescheduleCheckoutDisplay");
    const calculateBtn = document.getElementById("calculateCheckoutBtn");

    // Reset
    dateInput.value = "";
    timeInput.value = "";
    reasonInput.value = "";
    if (checkoutDisplay) checkoutDisplay.style.display = "none";
    if (formMessage) formMessage.classList.add("d-none");
    rescheduleReservationData = null;

    // Set min date to 14 days from today
    const today = new Date();
    const minDate = new Date();
    minDate.setDate(minDate.getDate() + 14);
    const minDateStr = minDate.toISOString().split("T")[0];
    dateInput.setAttribute("min", minDateStr);

    // Bind calculate button click
    if (calculateBtn) {
      calculateBtn.onclick = manualCalculateRescheduleCheckout;
    }

    console.log("🔍 Fetching reservation data for ID:", reservationId);

    // Fetch reservation
    fetch(`http://localhost:3000/api/reservations/${reservationId}`, {
      headers: {
        Authorization: "Bearer " + (sessionStorage.getItem("authToken") || ""),
      },
    })
      .then(res => {
        console.log("📡 Fetch response status:", res.status);
        return res.json();
      })
      .then(data => {
        console.log("✅ Received data:", data);
        
        // Handle both formats: data.reservation OR data is the reservation directly
        const reservation = data.reservation || data;
        
        if (reservation && reservation.serviceName) {
          rescheduleReservationData = reservation;
          console.log("✓ Reservation data loaded:", rescheduleReservationData.serviceName);
          
          // Set time options based on amenity
          const isPrivatePool = reservation.serviceName && 
                                 reservation.serviceName.toLowerCase().includes("private pool");
          
          if (isPrivatePool) {
            timeInput.innerHTML = `
              <option value="">-- Select Time --</option>
              <option value="8">8:00 AM</option>
              <option value="20">8:00 PM</option>
            `;
          } else {
            timeInput.innerHTML = `
              <option value="">-- Select Time --</option>
              <option value="8">8:00 AM</option>
              <option value="9">9:00 AM</option>
              <option value="10">10:00 AM</option>
              <option value="11">11:00 AM</option>
              <option value="12">12:00 PM</option>
              <option value="13">1:00 PM</option>
              <option value="14">2:00 PM</option>
              <option value="15">3:00 PM</option>
              <option value="16">4:00 PM</option>
              <option value="17">5:00 PM</option>
              <option value="18">6:00 PM</option>
              <option value="19">7:00 PM</option>
              <option value="20">8:00 PM</option>
            `;
          }
        } else {
          console.error("⚠️ No reservation data found:", data);
          if (formMessage) {
            formMessage.textContent = "Failed to load reservation data. Please try refreshing the page.";
            formMessage.classList.remove("d-none");
          }
        }
      })
      .catch(error => {
        console.error("❌ Error fetching reservation:", error);
        if (formMessage) {
          formMessage.textContent = "Error loading reservation: " + error.message;
          formMessage.classList.remove("d-none");
        }
      });
  }, 200); // Increased delay to ensure fetch completes

  const showResultModal = (title, message, isSuccess) => {
    if (!resultModal || !resultTitle || !resultMessage || !resultBtn) return;
    resultTitle.textContent = title;
    resultMessage.textContent = message;
    resultTitle.style.color = isSuccess ? "#1e7a34" : "#d97757";
    resultModal.style.display = "flex";
    document.body.style.overflow = "hidden";

    resultBtn.onclick = function () {
      resultModal.style.display = "none";
      document.body.style.overflow = "auto";
      if (isSuccess) {
        loadAndRenderReservations();
      }
    };
  };

  submitBtn.onclick = async function () {
    // Get current values from the DOM elements
    const currentCheckInInput = document.getElementById("rescheduleCheckInDate");
    const currentCheckInTimeInput = document.getElementById("rescheduleCheckInTime");
    const checkoutDisplay = document.getElementById("rescheduleCheckoutDisplay");
    
    // Validate inputs
    if (!currentCheckInInput.value || !currentCheckInTimeInput.value || !checkoutDisplay || checkoutDisplay.style.display === "none") {
      if (formMessage) {
        formMessage.textContent = "Please select check-in date and time, then click 'Calculate Checkout Date & Time' to proceed.";
        formMessage.classList.remove("d-none");
      }
      return;
    }

    const checkInDate = new Date(currentCheckInInput.value);
    const now = new Date();

    // Check 14-day lead time
    const daysUntilCheckIn = Math.ceil((checkInDate - now) / (1000 * 60 * 60 * 24));
    if (daysUntilCheckIn < 14) {
      if (formMessage) {
        formMessage.textContent = `Rescheduling requires a minimum 14-day lead time. You have ${daysUntilCheckIn} days.`;
        formMessage.classList.remove("d-none");
      }
      return;
    }

    // Validate reservation data exists
    if (!rescheduleReservationData) {
      if (formMessage) {
        formMessage.textContent = "Unable to load reservation data. Please try again.";
        formMessage.classList.remove("d-none");
      }
      return;
    }

    modal.style.display = "none";
    document.body.style.overflow = "auto";

    const originalText = submitBtn.textContent;
    submitBtn.classList.add("is-processing");
    submitBtn.textContent = "Submitting...";

    try {
      // Calculate check-in datetime
      const checkInDateTime = new Date(currentCheckInInput.value);
      checkInDateTime.setHours(parseInt(currentCheckInTimeInput.value), 0, 0, 0);
      
      // Calculate check-out datetime based on duration
      let checkOutDateTime = new Date(checkInDateTime);
      
      // Determine if hour-based or night-based from original reservation duration
      let durationHours = 0;
      let nights = 1;
      let isHourBased = false;
      
      if (rescheduleReservationData.check_in && rescheduleReservationData.check_out) {
        const origCheckIn = new Date(rescheduleReservationData.check_in);
        const origCheckOut = new Date(rescheduleReservationData.check_out);
        const totalHours = (origCheckOut - origCheckIn) / (1000 * 60 * 60);
        
        if (totalHours < 24) {
          // Hour-based duration (e.g., 22 hours)
          isHourBased = true;
          durationHours = Math.round(totalHours);
        } else {
          // Night-based duration (overnight stay)
          nights = Math.ceil(totalHours / 24);
        }
      }
      
      if (isHourBased) {
        // Add hours to check-in time
        checkOutDateTime.setHours(checkOutDateTime.getHours() + durationHours);
      } else {
        // Add nights (keep same time)
        checkOutDateTime.setDate(checkOutDateTime.getDate() + nights);
      }
      
      const response = await fetch(
        `http://localhost:3000/api/reservations/request-reschedule/${reservationId}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization:
              "Bearer " + (sessionStorage.getItem("authToken") || ""),
          },
          body: JSON.stringify({
            proposedCheckIn: checkInDateTime.toISOString(),
            proposedCheckOut: checkOutDateTime.toISOString(),
            reason: reasonInput.value || "Requested reschedule",
            requestedByEmail: JSON.parse(sessionStorage.getItem("loggedInUser") || "{}").email,
          }),
        },
      );

      if (response.ok) {
        await loadAndRenderReservations();
        showResultModal(
          "Reschedule Request Submitted",
          "Your reschedule request has been submitted for admin approval. You will receive an email once the admin has reviewed your request.",
          true,
        );
      } else {
        const error = await response.json();
        showResultModal(
          "Reschedule Request Failed",
          error.message || "Failed to submit reschedule request. Please try again.",
          false,
        );
      }
    } catch (error) {
      console.error("Error submitting reschedule request:", error);
      showResultModal("Reschedule Request Failed", "Error: " + error.message, false);
    } finally {
      submitBtn.classList.remove("is-processing");
      submitBtn.textContent = originalText;
    }
  };

  cancelBtn.onclick = function () {
    modal.style.display = "none";
    document.body.style.overflow = "auto";
  };
}

// Helper function to populate check-in time options based on amenity type
function populateCheckInTimeOptions(timeInput, amenityName) {
  if (!timeInput) return;

  const isPrivatePool = amenityName && amenityName.includes("Private Pool");

  if (isPrivatePool) {
    // Private Pool: only 8am or 8pm
    timeInput.innerHTML = `
      <option value="">-- Select Time --</option>
      <option value="8">8:00 AM</option>
      <option value="20">8:00 PM</option>
    `;
  } else {
    // Other amenities: 8am to 8pm hourly
    timeInput.innerHTML = `
      <option value="">-- Select Time --</option>
      <option value="8">8:00 AM</option>
      <option value="9">9:00 AM</option>
      <option value="10">10:00 AM</option>
      <option value="11">11:00 AM</option>
      <option value="12">12:00 PM</option>
      <option value="13">1:00 PM</option>
      <option value="14">2:00 PM</option>
      <option value="15">3:00 PM</option>
      <option value="16">4:00 PM</option>
      <option value="17">5:00 PM</option>
      <option value="18">6:00 PM</option>
      <option value="19">7:00 PM</option>
      <option value="20">8:00 PM</option>
    `;
  }
}

// Show View More modal with full reservation details
function showViewMoreModal(reservationJson) {
  const modal = document.getElementById("viewMoreModal");
  const content = document.getElementById("viewMoreContent");
  const closeBtn = document.getElementById("viewMoreCloseBtn");
  const okBtn = document.getElementById("viewMoreOkBtn");

  if (!modal || !content) {
    console.error("View More modal not found");
    return;
  }

  try {
    const res = JSON.parse(decodeURIComponent(reservationJson));
    
    // Format dates
    const checkinDate = res.check_in
      ? new Date(res.check_in).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";
    const checkoutDate = res.check_out
      ? new Date(res.check_out).toLocaleDateString("en-US", {
          weekday: "long",
          month: "short",
          day: "numeric",
          year: "numeric",
        })
      : "N/A";

    const checkinTime = res.check_in
      ? new Date(res.check_in).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

    const checkoutTime = res.check_out
      ? new Date(res.check_out).toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        })
      : "N/A";

    // Calculate nights
    let nights = 0;
    let durationDisplay = "N/A";
    
    if (res.check_in && res.check_out) {
      const checkInDateTime = new Date(res.check_in);
      const checkOutDateTime = new Date(res.check_out);
      const totalHours = Math.abs(checkOutDateTime - checkInDateTime) / (1000 * 60 * 60);
      nights = Math.ceil((checkOutDateTime - checkInDateTime) / (1000 * 60 * 60 * 24));
      
      // For day-use amenities (less than 24 hours), show hours instead of nights
      if (totalHours < 24) {
        const hours = Math.round(totalHours);
        durationDisplay = `${hours} hour${hours !== 1 ? "s" : ""}`;
      } else {
        durationDisplay = `${nights} night${nights !== 1 ? "s" : ""}`;
      }
    }

    // Format currency
    const formatter = new Intl.NumberFormat("en-PH", {
      style: "currency",
      currency: "PHP",
    });

    // Calculate financial breakdown
    const totalAmount = parseFloat(res.finalTotal) || 0;
    let downPaymentAmount = 0;
    let amountPaid = 0;
    let remainingBalance = totalAmount;

    // Determine payment type and calculate amounts
    if (res.paymentType === "downpayment" || res.paymentType === "down-payment") {
      downPaymentAmount = totalAmount * 0.5;
      
      // For down payment, use paymentStatus as the source of truth (don't use reservation status)
      if (res.paymentStatus === "fully-paid") {
        amountPaid = totalAmount;
        remainingBalance = 0;
      } else if (res.paymentStatus === "partially-paid") {
        amountPaid = downPaymentAmount;
        remainingBalance = totalAmount - downPaymentAmount;
      } else if (res.paymentStatus === "partial-payment" || res.paymentStatus === "full-payment") {
        amountPaid = downPaymentAmount;
        remainingBalance = totalAmount - downPaymentAmount;
      } else if (["PAID", "CHECKED_IN", "COMPLETED"].includes(res.status)) {
        // Only fully paid if reservation is checked in or completed (not just confirmed)
        amountPaid = totalAmount;
        remainingBalance = 0;
      } else {
        amountPaid = 0;
        remainingBalance = totalAmount;
      }
    } else if (res.paymentType === "full") {
      downPaymentAmount = 0;
      
      if (res.paymentStatus === "fully-paid") {
        amountPaid = totalAmount;
        remainingBalance = 0;
      } else if (res.paymentStatus === "full-payment" || ["PAID", "CHECKED_IN", "COMPLETED"].includes(res.status)) {
        amountPaid = totalAmount;
        remainingBalance = 0;
      } else {
        amountPaid = 0;
        remainingBalance = totalAmount;
      }
    } else {
      // Standard payment
      if (["PAID", "CONFIRMED", "CHECKED_IN", "COMPLETED"].includes(res.status)) {
        amountPaid = totalAmount;
        remainingBalance = 0;
      } else {
        amountPaid = 0;
        remainingBalance = totalAmount;
      }
    }

    const formattedDownPayment = formatter.format(downPaymentAmount);
    const formattedAmountPaid = formatter.format(amountPaid);
    const formattedRemainingBalance = formatter.format(remainingBalance);

    // Determine status color for remaining balance
    const balanceColor = remainingBalance === 0 ? "#1e7a34" : remainingBalance > 0 && remainingBalance < downPaymentAmount ? "#ff6b6b" : "#d97757";
    const balanceLabel = remainingBalance === 0 ? "Fully Paid" : "Pending";

    const totalPrice = formatter.format(totalAmount);
    const totalPaid = formatter.format(amountPaid);

    // Build details HTML
    const detailsHTML = `
      <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <h4 style="margin: 0 0 1rem 0; color: #0066cc;">Booking Information</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Reservation ID</div>
            <div style="font-size: 1rem; color: #333;">${res.reservationId || res._id || "N/A"}</div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Amenity</div>
            <div style="font-size: 1rem; color: #333;">${res.serviceName || res.serviceType || "N/A"}</div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Status</div>
            <div style="font-size: 1rem; color: #333;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #d4edda; color: #155724; font-weight: 600;">
                ${res.status || "N/A"}
              </span>
            </div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Booked On</div>
            <div style="font-size: 1rem; color: #333;">
              ${res.dateCreated ? new Date(res.dateCreated).toLocaleDateString("en-US") : "N/A"}
            </div>
          </div>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <h4 style="margin: 0 0 1rem 0; color: #0066cc;">Stay Details</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem;">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Check-in</div>
            <div style="font-size: 1rem; color: #333;">${checkinDate}</div>
            <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">Time: ${checkinTime}</div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Check-out</div>
            <div style="font-size: 1rem; color: #333;">${checkoutDate}</div>
            <div style="font-size: 0.9rem; color: #666; margin-top: 4px;">Time: ${checkoutTime}</div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Duration</div>
            <div style="font-size: 1rem; color: #333;">${durationDisplay}</div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Guests</div>
            <div style="font-size: 1rem; color: #333;">${res.guests || "N/A"}</div>
          </div>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px; margin-bottom: 1rem;">
        <h4 style="margin: 0 0 1rem 0; color: #0066cc;">💰 Payment Information</h4>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1rem;">
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Payment Type</div>
            <div style="font-size: 1rem; color: #333;">${res.paymentType === "downpayment" || res.paymentType === "down-payment" ? "Down Payment (50%)" : res.paymentType === "full" ? "Full Payment (100%)" : "Standard"}</div>
          </div>
          <div>
            <div style="font-weight: 600; font-size: 0.9rem; color: #666;">Payment Status</div>
            <div style="font-size: 1rem; color: #333;">
              <span style="display: inline-block; padding: 4px 8px; border-radius: 4px; background: #fff3cd; color: #856404; font-weight: 600;">
                ${res.paymentStatus || "Pending"}
              </span>
            </div>
          </div>
        </div>

        <!-- Financial Breakdown -->
        <div style="background: white; padding: 1rem; border-radius: 6px; border-left: 4px solid #0066cc;">
          <h5 style="margin: 0 0 0.75rem 0; color: #333; font-size: 1rem;">Financial Breakdown</h5>
          <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #666; font-weight: 600;">Total Amount:</span>
            <span style="color: #333; font-weight: 600; font-size: 1.05rem;">${totalPrice}</span>
          </div>
          ${downPaymentAmount > 0 ? `
          <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #666;">Down Payment (50%):</span>
            <span style="color: #0066cc; font-weight: 600;">${formattedDownPayment}</span>
          </div>` : ""}
          <div style="display: flex; justify-content: space-between; padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
            <span style="color: #666;">Amount Paid:</span>
            <span style="color: #1e7a34; font-weight: 600;">${formattedAmountPaid}</span>
          </div>
          <div style="display: flex; justify-content: space-between; padding: 0.75rem 0; background: ${remainingBalance === 0 ? '#d4edda' : '#fff3cd'}; padding: 0.75rem; border-radius: 4px;">
            <span style="color: #333; font-weight: 700;">Remaining Balance:</span>
            <span style="color: ${balanceColor}; font-weight: 700; font-size: 1.1rem;">${formattedRemainingBalance}</span>
          </div>
          ${remainingBalance > 0 ? `
          <div style="margin-top: 0.75rem; padding: 0.5rem; background: #fff3cd; border-radius: 4px; font-size: 0.85rem; color: #856404;">
            ⚠️ Please complete payment of ${formattedRemainingBalance} to finalize your reservation.
          </div>` : `
          <div style="margin-top: 0.75rem; padding: 0.5rem; background: #d4edda; border-radius: 4px; font-size: 0.85rem; color: #155724;">
            ✓ This reservation is fully paid and confirmed.
          </div>`}
        </div>

        ${res.discountCode ? `
          <div style="margin-top: 1rem; padding: 0.75rem; background: #e7f3ff; border-radius: 4px; border-left: 4px solid #0066cc;">
            <div style="font-weight: 600; font-size: 0.9rem; color: #0066cc;">Promo Code Applied</div>
            <div style="font-size: 1rem; color: #333; margin-top: 0.25rem; font-weight: 600;">${res.discountCode}</div>
          </div>
        ` : ""}
      </div>

      ${res.specialRequests ? `
      <div style="background: #f8f9fa; padding: 1rem; border-radius: 8px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #0066cc;">Special Requests</h4>
        <div style="font-size: 0.95rem; color: #333; line-height: 1.6;">${res.specialRequests}</div>
      </div>
      ` : ""}
    `;

    content.innerHTML = detailsHTML;
    modal.style.display = "flex";
    document.body.style.overflow = "hidden";

    closeBtn.onclick = function () {
      modal.style.display = "none";
      document.body.style.overflow = "auto";
    };

    okBtn.onclick = function () {
      modal.style.display = "none";
      document.body.style.overflow = "auto";
    };
  } catch (error) {
    console.error("Error parsing reservation data:", error);
    content.innerHTML = '<div style="color: #d97757;">Error loading reservation details.</div>';
  }
}

window.customerCancelReservation = customerCancelReservation;
window.customerRequestReschedule = customerRequestReschedule;
window.showViewMoreModal = showViewMoreModal;
window.populateCheckInTimeOptions = populateCheckInTimeOptions;
