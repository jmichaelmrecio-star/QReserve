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

window.customerCancelReservation = customerCancelReservation;
window.loadAndRenderReservations = loadAndRenderReservations;
