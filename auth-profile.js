/**
 * auth-profile.js
 * Handles authentication (Login/Register) and User Profile management.
 */

// --- Password Validation ---

function validatePasswordStrength(password) {
  const requirements = {
    length: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[^A-Za-z0-9]/.test(password)
  };

  const metCount = Object.values(requirements).filter(Boolean).length;
  let strength = "Very Weak";
  if (metCount >= 5) strength = "Strong";
  else if (metCount >= 3) strength = "Medium";
  else if (metCount >= 2) strength = "Weak";

  return { requirements, strength, metCount };
}

function updatePasswordStrength() {
  const passwordInput = document.getElementById("password") || document.getElementById("registerPassword");
  const strengthMeter = document.getElementById("password-strength-meter") || document.getElementById("passwordStrengthContainer"); // Simplified
  const strengthText = document.getElementById("password-strength-text") || document.getElementById("passwordStrengthText");
  
  if (!passwordInput) return;

  const password = passwordInput.value;
  const { requirements, strength, metCount } = validatePasswordStrength(password);

  strengthMeter.value = metCount;
  strengthText.textContent = `Strength: ${strength}`;

  // Update requirement color indicators if they exist
  Object.keys(requirements).forEach(req => {
    const el = document.getElementById(`req-${req}`);
    if (el) {
      el.style.color = requirements[req] ? "var(--success-color)" : "var(--danger-color)";
    }
  });
}

function checkPasswordMatch() {
  const password = document.getElementById("password") || document.getElementById("registerPassword");
  const confirm = document.getElementById("confirm_password") || document.getElementById("registerConfirmPassword");
  const matchMsg = document.getElementById("password-match-msg") || document.getElementById("passwordMatchText");
  
  if (!password || !confirm || !matchMsg) return;

  if (confirm.value === "") {
    matchMsg.textContent = "";
  } else if (password.value === confirm.value) {
    matchMsg.textContent = "✓ Passwords match";
    matchMsg.style.color = "var(--success-color)";
  } else {
    matchMsg.textContent = "✗ Passwords do not match";
    matchMsg.style.color = "var(--danger-color)";
  }
}

function isPasswordValid(password) {
  const { metCount } = validatePasswordStrength(password);
  return metCount >= 4; // Require at least 4 criteria
}

// --- Auth Handlers ---

// Removed registerUser function to prevent double registration requests

async function loginUser(event) {
  event.preventDefault();
  const emailInput = document.getElementById("email") || document.getElementById("loginEmail");
  const passwordInput = document.getElementById("password") || document.getElementById("loginPassword");

  if (!emailInput || !passwordInput) {
    console.error("Login elements not found");
    return;
  }

  const email = emailInput.value;
  const password = passwordInput.value;

  try {
    const response = await fetch("http://localhost:3000/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });

    const result = await response.json();
    if (response.ok) {
      localStorage.setItem("token", result.token);
      localStorage.setItem("loggedInUser", JSON.stringify(result.user));
      localStorage.setItem("qreserve_logged_user_email", result.user.email);
      // Migrate any guest cart to user-specific cart
      if (typeof migrateCartToUser === 'function') {
        migrateCartToUser(result.user.email);
      }
      // Set role for dashboard UI
      if (result.user.role) {
        localStorage.setItem("qreserve_user_role", result.user.role.toLowerCase());
      }
      showAlert("Login successful!", "success");
      // Role-based redirect
      const role = result.user.role.toLowerCase();
      setTimeout(() => {
        if (role === "admin") window.location.href = "admin-dashboard.html";
        else if (role === "manager") window.location.href = "manager-dashboard.html";
        else window.location.href = "index.html";
      }, 1000);
    } else {
      showAlert(result.message || "Login failed.", "error");
    }
  } catch (error) {
    console.error("Login error:", error);
    showAlert("Network error during login.", "error");
  }
}

// --- Profile & Access Logic ---

function checkAuthAndRedirect(requireAdmin = false) {
  const user = getLoggedInUser();
  if (!user) {
    window.location.href = "login.html";
    return;
  }
  if (requireAdmin) {
    const role = user.role.toLowerCase();
    if (role !== "admin" && role !== "manager") {
      window.location.href = "index.html";
    }
  }
}

function checkLoginStatusForReservation() {
  const user = getLoggedInUser();
  const loginSection = document.getElementById("reservation-login-section");
  const detailsSection = document.getElementById("customer-details-section") || document.getElementById("guestDetailsForm");
  
  if (user) {
    if (loginSection) loginSection.style.display = "none";
    if (detailsSection) {
      // Prefill values
      const nameInput = document.getElementById("name") || document.getElementById("customer_name");
      const emailInput = document.getElementById("email") || document.getElementById("customer_email");
      const phoneInput = document.getElementById("contact") || document.getElementById("customer_contact");
      const addressInput = document.getElementById("address") || document.getElementById("customer_address");
      const birthdayInput = document.getElementById("birthday") || document.getElementById("customer_birthday");
      
      if (nameInput) nameInput.value = user.full_name || "";
      if (emailInput) emailInput.value = user.email || "";
      if (phoneInput) phoneInput.value = user.phone || "";
      if (addressInput) addressInput.value = user.address || "";
      if (birthdayInput && user.birthday) {
        // Format birthday from ISO to YYYY-MM-DD if needed
        const date = new Date(user.birthday);
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        birthdayInput.value = `${year}-${month}-${day}`;
      }
    }
  }
}

async function renderProfileDetails() {
  const user = getLoggedInUser();
  if (!user) return;

  const nameEl = document.getElementById("profile-name");
  const emailEl = document.getElementById("profile-email");
  const contactEl = document.getElementById("profile-contact");
  const roleEl = document.getElementById("profile-role");

  if (nameEl) nameEl.textContent = user.full_name || "N/A";
  if (emailEl) emailEl.textContent = user.email || "N/A";
  if (contactEl) contactEl.textContent = user.phone || "N/A";
  if (roleEl) roleEl.textContent = user.role || "N/A";

  const display = document.getElementById("user-info-display");
  if (display && !nameEl) {
    display.innerHTML = `
      <div class="profile-card">
        <h3>${escapeHtml(user.full_name)}</h3>
        <p><strong>Email:</strong> ${escapeHtml(user.email)}</p>
        <p><strong>Phone:</strong> ${escapeHtml(user.phone || "Not provided")}</p>
        <p><strong>Role:</strong> ${escapeHtml(user.role || "Customer")}</p>
        <button class="btn btn-secondary" onclick="openProfileEditModal()">Edit Profile</button>
      </div>`;
  }
}

async function renderUserReservations() {
  const user = getLoggedInUser();
  if (!user) return;

  const listElement = document.getElementById("user-reservations-list");
  if (!listElement) return;

  try {
    const response = await fetch(`http://localhost:3000/api/reservations/user/${user.email}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    const data = await response.json();

    if (data.success || Array.isArray(data)) {
      const allReservations = data.success ? data.reservations : data;
      // Filter out CART items - only show paid/confirmed reservations
      const reservations = allReservations.filter(res => 
        res.status && res.status.toUpperCase() !== 'CART'
      );
      
      if (!reservations || reservations.length === 0) {
        listElement.innerHTML = '<tr><td colspan="8" style="text-align: center;">No reservations found.</td></tr>';
      } else {
        let html = '';
        reservations.forEach(res => {
          const totalPaid = res.totalPaid || res.finalTotal || 0;
          const hash = res.qrCodeHash || res.reservationHash || "";
          const status = (res.status || "pending").toUpperCase();
          const canViewQR = status !== "PENDING" && status !== "CART" && status !== "CANCELLED";
          const qrLink = hash 
            ? canViewQR
              ? `<a href="confirmation.html?hash=${hash}" style="display: inline-block; padding: 6px 12px; background-color: var(--primary-color); color: white; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; transition: background-color 0.3s; border: none; cursor: pointer;" onmouseover="this.style.backgroundColor='#1e7a34'" onmouseout="this.style.backgroundColor='var(--primary-color)'">View QR</a>`
              : `<button style="display: inline-block; padding: 6px 12px; background-color: #cccccc; color: #666666; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; cursor: not-allowed;" disabled>View QR</button>`
            : "N/A";
          const statusClass = `status-${(res.status || "pending").toLowerCase().replace(/_/g, "-")}`;
          let receiptCell = "<span style='color:#999;'>Not uploaded</span>";
          if (res.receiptFileName) {
            // Assume backend serves /uploads/<filename>
            receiptCell = `<a href="/trr-backend/uploads/${res.receiptFileName}" target="_blank"><img src="/trr-backend/uploads/${res.receiptFileName}" alt="Receipt" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 2px 8px #ccc;"></a>`;
          }
          // Add Checkout button only if status is CHECKED_IN
          let checkoutBtn = '';
          if ((res.status || '').toUpperCase() === 'CHECKED_IN') {
            checkoutBtn = `<button class="button-primary checkout-btn" data-res-id="${res._id || res.reservationId}">Checkout</button>`;
          }
          html += `<tr>
            <td><strong>${res.reservationId || "N/A"}</strong></td>
            <td>${res.serviceType || "N/A"}</td>
            <td>${formatDate(res.check_in || res.checkin_date)}</td>
            <td>${formatDate(res.check_out || res.checkout_date)}</td>
            <td><span class="${statusClass}">${res.status || "Pending"}</span></td>
            <td>₱${parseFloat(totalPaid).toLocaleString(undefined, { minimumFractionDigits: 2 })}</td>
            <td>${receiptCell}</td>
            <td>${qrLink}</td>
          </tr>`;
        });
        listElement.innerHTML = html;
        // Attach event listeners for checkout buttons
        document.querySelectorAll('.checkout-btn').forEach(btn => {
          btn.addEventListener('click', async function() {
            const resId = this.getAttribute('data-res-id');
            if (!resId) return;
            if (!confirm('Are you sure you want to checkout this reservation?')) return;
            try {
              const response = await fetch(`http://localhost:3000/api/reservations/update-status/${resId}`, {
                method: 'PUT',
                headers: {
                  'Authorization': `Bearer ${getAuthToken()}`,
                  'Content-Type': 'application/json'
                },
                body: JSON.stringify({ status: 'COMPLETED' })
              });
              if (response.ok) {
                showAlert('Checkout successful!', 'success');
                renderUserReservations();
              } else {
                showAlert('Checkout failed.', 'error');
              }
            } catch (err) {
              showAlert('Network error during checkout.', 'error');
            }
          });
        });
      }
    } else {
      const errorMsg = data.message || "Unknown error";
      listElement.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--error-color);">Error: ${errorMsg}</td></tr>`;
    }
  } catch (error) {
    console.error("Error fetching user reservations:", error);
    listElement.innerHTML = '<tr><td colspan="6" style="text-align: center; color: var(--error-color);">Network error. Please check your connection.</td></tr>';
  }
}

// --- Profile Edit Modal ---

function openProfileEditModal() {
  const user = getLoggedInUser();
  const modal = document.getElementById("profileEditModal") || document.getElementById("profile-edit-modal");
  if (!modal || !user) return;

  if (document.getElementById("edit-first-name")) {
    const names = (user.full_name || "").split(" ");
    document.getElementById("edit-first-name").value = names[0] || "";
    document.getElementById("edit-last-name").value = names.slice(1).join(" ") || "";
  }
  if (document.getElementById("edit-email")) document.getElementById("edit-email").value = user.email || "";
  if (document.getElementById("edit-phone")) document.getElementById("edit-phone").value = user.phone || "";
  modal.style.display = "block";
}

function closeProfileEditModal() {
  const modal = document.getElementById("profileEditModal") || document.getElementById("profile-edit-modal");
  if (modal) {
    modal.style.display = "none";
    if (modal.classList.contains("show")) modal.classList.remove("show");
  }
}

async function handleProfileEditSubmit(event) {
  event.preventDefault();
  const user = getLoggedInUser();
  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());

  try {
    const response = await fetch(`http://localhost:3000/api/auth/profile/${user._id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    if (response.ok) {
      const result = await response.json();
      localStorage.setItem("loggedInUser", JSON.stringify(result.user));
      showAlert("Profile updated successfully!", "success");
      closeProfileEditModal();
      renderProfileDetails();
    } else {
      showAlert("Failed to update profile.", "error");
    }
  } catch (error) {
    showAlert("Network error during profile update.", "error");
  }
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // Removed duplicate registration handler for registerForm

    const loginForm = document.getElementById("loginForm");
    if (loginForm) loginForm.addEventListener("submit", loginUser);

    const profileForm = document.getElementById("profileEditForm");
    if (profileForm) profileForm.addEventListener("submit", handleProfileEditSubmit);

    const passInput = document.getElementById("password");
    if (passInput) passInput.addEventListener("input", updatePasswordStrength);

    const confirmPass = document.getElementById("confirm_password") || document.getElementById("registerConfirmPassword");
    if (confirmPass) confirmPass.addEventListener("input", checkPasswordMatch);

    if (document.getElementById("profile-name") || document.getElementById("user-info-display")) {
        renderProfileDetails();
    }
    if (document.getElementById("user-reservations-list")) {
        renderUserReservations();
    }
});

// Expose globals
window.openProfileEditModal = openProfileEditModal;
window.closeProfileEditModal = closeProfileEditModal;
window.loginUser = loginUser;
// Removed window.registerUser assignment
