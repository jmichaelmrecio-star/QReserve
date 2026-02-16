// admin-reschedule.js
// Render reschedule requests for admin approval/rejection with modal-based UI

// Store global state for modals
let currentRescheduleAction = {
  reservationId: null,
  reservationIdForDisplay: null,
};

function getAuthToken() {
  try {
    const token =
      sessionStorage.getItem("token") ||
      localStorage.getItem("token") ||
      sessionStorage.getItem("authToken") ||
      localStorage.getItem("authToken");
    console.log(
      "🔑 Auth Token Retrieved:",
      token ? "✓ Token found" : "✗ Token NOT found",
    );
    return token || "";
  } catch (err) {
    console.log("❌ Storage access blocked:", err.message);
    return "";
  }
}

function showResultModal(title, message, type = "info") {
  const resultHeader = document.getElementById("resultHeader");
  const resultLabel = document.getElementById("resultLabel");
  const resultMessage = document.getElementById("resultMessage");
  const resultModal = new bootstrap.Modal(
    document.getElementById("resultModal"),
  );

  resultLabel.textContent = title;
  resultMessage.textContent = message;

  // Set header color based on type
  resultHeader.className = "modal-header";
  if (type === "success") {
    resultHeader.classList.add("bg-success", "text-white");
  } else if (type === "error") {
    resultHeader.classList.add("bg-danger", "text-white");
  } else if (type === "warning") {
    resultHeader.classList.add("bg-warning", "text-dark");
  } else {
    resultHeader.classList.add("bg-info", "text-white");
  }

  resultModal.show();
}

async function renderRescheduleRequests() {
  const tbody = document.getElementById("reschedule-requests-list");
  if (!tbody) return;

  tbody.innerHTML =
    '<tr><td colspan="8" class="text-center p-4">Loading reschedule requests...</td></tr>';

  try {
    const response = await fetch(
      "http://localhost:3000/api/reservations/allreservation",
    );
    const data = await response.json();

    // Handle both response formats
    const reservations = Array.isArray(data) ? data : data.reservations || [];

    if (!Array.isArray(reservations)) {
      throw new Error("Invalid response format");
    }

    // Filter for reservations with pending reschedule requests
    const rescheduleRequests = reservations.filter(
      (r) =>
        r.rescheduleStatus === "PENDING" ||
        (r.rescheduleProposedCheckIn &&
          r.rescheduleStatus !== "REJECTED" &&
          r.rescheduleStatus !== "APPROVED"),
    );

    if (rescheduleRequests.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="8" class="text-center p-4">No pending reschedule requests.</td></tr>';
      return;
    }

    tbody.innerHTML = rescheduleRequests
      .map((res) => {
        const currentCheckIn = res.check_in
          ? new Date(res.check_in).toLocaleDateString()
          : "N/A";
        const currentCheckOut = res.check_out
          ? new Date(res.check_out).toLocaleDateString()
          : "N/A";
        const proposedCheckIn = res.rescheduleProposedCheckIn
          ? new Date(res.rescheduleProposedCheckIn).toLocaleDateString()
          : "N/A";
        const proposedCheckOut = res.rescheduleProposedCheckOut
          ? new Date(res.rescheduleProposedCheckOut).toLocaleDateString()
          : "N/A";
        const requestedAt = res.rescheduleRequestedAt
          ? new Date(res.rescheduleRequestedAt).toLocaleString()
          : "N/A";

        let statusBadge = "";
        if (res.rescheduleStatus === "PENDING") {
          statusBadge =
            '<span class="badge bg-warning text-dark">Pending</span>';
        } else if (res.rescheduleStatus === "APPROVED") {
          statusBadge = '<span class="badge bg-success">Approved</span>';
        } else if (res.rescheduleStatus === "REJECTED") {
          statusBadge = '<span class="badge bg-danger">Rejected</span>';
        }

        let actions = "";
        if (res.rescheduleStatus === "PENDING") {
          actions = `
                    <button class="btn btn-success btn-sm me-1" onclick="showApproveModal('${res._id}', '${res.reservationId}')">Approve</button>
                    <button class="btn btn-danger btn-sm" onclick="showRejectModal('${res._id}', '${res.reservationId}')">Reject</button>
                `;
        } else {
          actions = '<span class="text-muted">No action</span>';
        }

        return `
                <tr>
                    <td><strong>${res.reservationId || res._id}</strong></td>
                    <td>${res.full_name || "N/A"}</td>
                    <td>${currentCheckIn} to ${currentCheckOut}</td>
                    <td>${proposedCheckIn} to ${proposedCheckOut}</td>
                    <td><span title="${res.rescheduleReason || ""}">${(res.rescheduleReason || "").substring(0, 30)}${(res.rescheduleReason || "").length > 30 ? "..." : ""}</span></td>
                    <td>${statusBadge}</td>
                    <td>${requestedAt}</td>
                    <td>${actions}</td>
                </tr>
            `;
      })
      .join("");

    // DataTable initialization if jQuery is available
    if (window.$ && window.$.fn && window.$.fn.DataTable) {
      setTimeout(() => {
        const table = $("#reschedule-requests-table");
        if (table.length && !$.fn.dataTable.isDataTable(table[0])) {
          table.DataTable({ order: [], pageLength: 10, destroy: true });
        }
      }, 100);
    }
  } catch (e) {
    tbody.innerHTML =
      '<tr><td colspan="8" class="text-center text-danger">Error loading reschedule requests.</td></tr>';
    console.error("❌ Error loading reschedule requests:", e);
  }
}

function showApproveModal(reservationId, reservationIdForDisplay) {
  currentRescheduleAction.reservationId = reservationId;
  currentRescheduleAction.reservationIdForDisplay = reservationIdForDisplay;

  const confirmApproveMessage = document.getElementById(
    "confirmApproveMessage",
  );
  confirmApproveMessage.textContent = `Are you sure you want to approve the reschedule request for ${reservationIdForDisplay}? The customer will receive an email notification about this approval.`;

  const confirmApproveModal = new bootstrap.Modal(
    document.getElementById("confirmApproveModal"),
  );
  confirmApproveModal.show();
}

function showRejectModal(reservationId, reservationIdForDisplay) {
  currentRescheduleAction.reservationId = reservationId;
  currentRescheduleAction.reservationIdForDisplay = reservationIdForDisplay;

  const rejectReasonMessage = document.getElementById("rejectReasonMessage");
  rejectReasonMessage.textContent = `Please provide a reason for rejecting the reschedule request for ${reservationIdForDisplay}:`;

  const rejectionReason = document.getElementById("rejectionReason");
  rejectionReason.value = ""; // Clear previous reason

  const rejectReasonModal = new bootstrap.Modal(
    document.getElementById("rejectReasonModal"),
  );
  rejectReasonModal.show();
}

async function approveRescheduleRequest() {
  const { reservationId, reservationIdForDisplay } = currentRescheduleAction;

  if (!reservationId) {
    showResultModal("Error", "Reservation ID not found", "error");
    return;
  }

  try {
    const token = getAuthToken();
    console.log(
      "📤 Sending approve request with token:",
      token ? `✓ (${token.substring(0, 20)}...)` : "✗ EMPTY",
    );

    const response = await fetch(
      `http://localhost:3000/api/reservations/${reservationId}/approve-reschedule`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          approvedBy: JSON.parse(sessionStorage.getItem("loggedInUser") || "{}")
            .email,
        }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Reschedule approved:", result);

      // Close the confirmation modal
      const confirmApproveModal = bootstrap.Modal.getInstance(
        document.getElementById("confirmApproveModal"),
      );
      if (confirmApproveModal) confirmApproveModal.hide();

      showResultModal(
        "✅ Reschedule Approved",
        `The reschedule request for ${reservationIdForDisplay} has been successfully approved. The customer has been notified via email.`,
        "success",
      );

      // Refresh the list after result modal closes
      setTimeout(() => renderRescheduleRequests(), 1500);
    } else {
      const error = await response.json();
      showResultModal("Failed to Approve", `Error: ${error.message}`, "error");
    }
  } catch (error) {
    console.error("❌ Error approving reschedule request:", error);
    showResultModal(
      "Error",
      `Failed to approve reschedule: ${error.message}`,
      "error",
    );
  }
}

async function rejectRescheduleRequest() {
  const { reservationId, reservationIdForDisplay } = currentRescheduleAction;
  const rejectionReason = document
    .getElementById("rejectionReason")
    .value.trim();

  if (!reservationId) {
    showResultModal("Error", "Reservation ID not found", "error");
    return;
  }

  if (!rejectionReason) {
    showResultModal(
      "Input Required",
      "Please provide a reason for rejecting this reschedule request.",
      "warning",
    );
    return;
  }

  try {
    const token = getAuthToken();

    const response = await fetch(
      `http://localhost:3000/api/reservations/${reservationId}/reject-reschedule`,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          rejectedBy: JSON.parse(sessionStorage.getItem("loggedInUser") || "{}")
            .email,
          rejectionReason: rejectionReason,
        }),
      },
    );

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Reschedule rejected:", result);

      // Close the rejection modal
      const rejectReasonModal = bootstrap.Modal.getInstance(
        document.getElementById("rejectReasonModal"),
      );
      if (rejectReasonModal) rejectReasonModal.hide();

      showResultModal(
        "❌ Reschedule Rejected",
        `The reschedule request for ${reservationIdForDisplay} has been rejected. The customer has been notified via email with your rejection reason.`,
        "success",
      );

      // Refresh the list after result modal closes
      setTimeout(() => renderRescheduleRequests(), 1500);
    } else {
      const error = await response.json();
      showResultModal("Failed to Reject", `Error: ${error.message}`, "error");
    }
  } catch (error) {
    console.error("❌ Error rejecting reschedule request:", error);
    showResultModal(
      "Error",
      `Failed to reject reschedule: ${error.message}`,
      "error",
    );
  }
}

// Make functions globally available
window.renderRescheduleRequests = renderRescheduleRequests;
window.showApproveModal = showApproveModal;
window.showRejectModal = showRejectModal;
window.approveRescheduleRequest = approveRescheduleRequest;
window.rejectRescheduleRequest = rejectRescheduleRequest;
