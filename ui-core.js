// --- Unified Alert Modal System ---
function showUnifiedAlert(message, title = 'Alert', type = 'info') {
  const modal = document.getElementById('unifiedAlertModal');
  const header = document.getElementById('alertModalHeader');
  const body = document.getElementById('alertModalBody');
  const label = document.getElementById('unifiedAlertLabel');
  
  // Set title
  label.textContent = title;
  
  // Set message
  body.textContent = message;
  
  // Set header color based on type
  let headerClass = 'bg-info text-white';
  switch(type) {
    case 'success':
      headerClass = 'bg-success text-white';
      break;
    case 'error':
    case 'danger':
      headerClass = 'bg-danger text-white';
      break;
    case 'warning':
      headerClass = 'bg-warning text-dark';
      break;
    case 'info':
    default:
      headerClass = 'bg-info text-white';
  }
  
  // Clear previous classes and add new one
  header.className = 'modal-header ' + headerClass;
  
  // Show modal using Bootstrap
  if (modal && window.bootstrap && window.bootstrap.Modal) {
    const bsModal = new window.bootstrap.Modal(modal);
    bsModal.show();
  }
}
window.showUnifiedAlert = showUnifiedAlert;

// Override alert() with unified modal
window.alert = function(message) {
  showUnifiedAlert(message, 'Message', 'info');
};

// --- Account Edit Modal Logic ---
// --- Account Create Modal Logic ---
// --- Modal Close Logic ---
function closeAccountModal() {
  const modal = document.getElementById('accountModal');
  if (window.bootstrap && window.bootstrap.Modal) {
    window.bootstrap.Modal.getOrCreateInstance(modal).hide();
  } else {
    modal.style.display = 'none';
    modal.classList.remove('show');
    modal.setAttribute('aria-hidden', 'true');
  }
}
window.closeAccountModal = closeAccountModal;
function openCreateAccountModal() {
  // Clear all fields
  document.getElementById('accountModalTitle').textContent = 'Add New Account (Not Supported)';
  document.getElementById('accountFirstName').value = '';
  document.getElementById('accountFirstName').readOnly = true;
  document.getElementById('accountMiddleName').value = '';
  document.getElementById('accountMiddleName').readOnly = true;
  document.getElementById('accountLastName').value = '';
  document.getElementById('accountLastName').readOnly = true;
  document.getElementById('accountEmail').value = '';
  document.getElementById('accountEmail').readOnly = true;
  document.getElementById('accountPhone').value = '';
  document.getElementById('accountPhone').readOnly = true;
  document.getElementById('accountPassword').value = '';
  document.getElementById('accountPassword').style.display = 'none';
  document.getElementById('accountRole').value = '';
  delete document.getElementById('accountForm').dataset.editingId;

  // Show modal
  const modal = document.getElementById('accountModal');
  if (window.bootstrap && window.bootstrap.Modal) {
    const bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
    bsModal.show();
  } else {
    modal.style.display = 'block';
    modal.classList.add('show');
    modal.setAttribute('aria-hidden', 'false');
  }
}
window.openCreateAccountModal = openCreateAccountModal;
async function openEditAccountModal(userId) {
  try {
    // Find user in memory (from window._adminUsersById)
    const user = window._adminUsersById && window._adminUsersById[userId];
    if (!user) throw new Error('User not found in memory');

    // Populate modal fields (read-only except role)
    document.getElementById('accountModalTitle').textContent = 'Edit Account Role';
    document.getElementById('accountFirstName').value = user.first_name || '';
    document.getElementById('accountFirstName').readOnly = true;
    document.getElementById('accountMiddleName').value = user.middle_name || '';
    document.getElementById('accountMiddleName').readOnly = true;
    document.getElementById('accountLastName').value = user.last_name || '';
    document.getElementById('accountLastName').readOnly = true;
    document.getElementById('accountEmail').value = user.email || '';
    document.getElementById('accountEmail').readOnly = true;
    document.getElementById('accountPhone').value = user.phone || '';
    document.getElementById('accountPhone').readOnly = true;
    document.getElementById('accountPassword').value = '';
    document.getElementById('accountPassword').style.display = 'none';
    document.getElementById('accountRole').value = user.role_id || '';

    // Store userId for update
    document.getElementById('accountForm').dataset.editingId = userId;

    // Hide error message
    const msg = document.getElementById('accountFormMessage');
    if (msg) { msg.classList.add('d-none'); msg.textContent = ''; }

    // Show modal (Bootstrap 5)
    const modal = document.getElementById('accountModal');
    if (window.bootstrap && window.bootstrap.Modal) {
      const bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
      bsModal.show();
    } else {
      modal.style.display = 'block';
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
  } catch (e) {
    showAlert('Failed to load user for editing.', 'danger');
  }
}
// --- Account Edit Modal Logic ---
function openEditAccountModal(userId) {
  try {
    const user = window._adminUsersById && window._adminUsersById[userId];
    if (!user) throw new Error('User not found in memory');

    // Populate modal fields
    document.getElementById('accountModalTitle').textContent = 'Edit Account';
    document.getElementById('accountFirstName').value = user.first_name || '';
    document.getElementById('accountMiddleName').value = user.middle_name || '';
    document.getElementById('accountLastName').value = user.last_name || '';
    document.getElementById('accountEmail').value = user.email || '';
    document.getElementById('accountPhone').value = user.phone || '';
    document.getElementById('accountPassword').value = '';
    document.getElementById('accountRole').value = user.role_id || '';

    // Store userId for update
    document.getElementById('accountForm').dataset.editingId = userId;

    // Hide error message
    const msg = document.getElementById('accountFormMessage');
    if (msg) { msg.classList.add('d-none'); msg.textContent = ''; }

    // Show modal (Bootstrap 5)
    const modal = document.getElementById('accountModal');
    if (window.bootstrap && window.bootstrap.Modal) {
      const bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
      bsModal.show();
    } else {
      modal.style.display = 'block';
      modal.classList.add('show');
      modal.setAttribute('aria-hidden', 'false');
    }
  } catch (e) {
    showAlert('Failed to load user for editing.', 'danger');
  }
}

// Patch form submit to handle edit mode
const accountForm = document.getElementById('accountForm');
if (accountForm) {
  accountForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    const editingId = accountForm.dataset.editingId;
    // Only allow role update if editing
    if (editingId) {
      const newRoleName = accountForm.accountRole.options[accountForm.accountRole.selectedIndex].text;
      try {
        const response = await fetch(`http://localhost:3000/api/users/${editingId}/role`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
          body: JSON.stringify({ newRoleName })
        });
        if (response.ok) {
          showAlert('Account role updated.', 'success');
          if (typeof renderUsersList === 'function') renderUsersList();
          if (window.bootstrap && window.bootstrap.Modal) {
            window.bootstrap.Modal.getOrCreateInstance(document.getElementById('accountModal')).hide();
          } else {
            document.getElementById('accountModal').style.display = 'none';
          }
          accountForm.reset();
          delete accountForm.dataset.editingId;
        } else {
          const msg = document.getElementById('accountFormMessage');
          if (msg) {
            msg.classList.remove('d-none');
            msg.textContent = 'Failed to update account role.';
          }
        }
      } catch (err) {
        const msg = document.getElementById('accountFormMessage');
        if (msg) {
          msg.classList.remove('d-none');
          msg.textContent = 'Error updating account role.';
        }
      }
    }
  });
}

window.openEditAccountModal = openEditAccountModal;
// Show QR code modal for admin reservation
window.showReservationQRModal = function(reservationId) {
  // Show modal (Bootstrap 5)
  const modal = document.getElementById('qrCodeModal');
  if (!modal) return;
  // Set reservation ID in modal
  const idSpan = document.getElementById('qrCodeModalReservationId');
  if (idSpan) idSpan.textContent = `Reservation ID: ${reservationId}`;
  // Clear previous QR
  const qrContainer = document.getElementById('admin-qr-code-container');
  if (qrContainer) qrContainer.innerHTML = '';
  // Generate QR code
  if (qrContainer && window.QRCode) {
    new QRCode(qrContainer, {
      text: reservationId,
      width: 200,
      height: 200,
      colorDark: '#000000',
      colorLight: '#ffffff',
    });
  }
  // Show modal using Bootstrap
  if (window.bootstrap && window.bootstrap.Modal) {
    const bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
    bsModal.show();
  } else {
    // Fallback: show modal by setting display
    modal.style.display = 'block';
  }
};
// --- Universal Promo Code CRUD (Admin & Manager) ---
async function renderPromoCodeTable() {
  const tbody = document.getElementById('promoCodeTableBody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4">Loading promo codes...</td></tr>';
  try {
    const response = await fetch('http://localhost:3000/api/promocodes/all');
    const codes = await response.json();
    if (!Array.isArray(codes) || codes.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center p-4">No promo codes found.</td></tr>';
      return;
    }
    tbody.innerHTML = codes.map(code => {
      const isExpired = new Date(code.expirationDate) < new Date();
      const isUsedUp = code.timesUsed >= code.usageLimit;
      let statusBadge = '';
      if (isExpired) {
        statusBadge = '<span class="badge bg-danger">Expired</span>';
      } else if (isUsedUp) {
        statusBadge = '<span class="badge bg-warning">Used Up</span>';
      } else {
        statusBadge = '<span class="badge bg-success">Active</span>';
      }
      return `<tr>
        <td>${escapeHtml(code.code)}</td>
        <td>${Math.round((code.discountPercentage || 0) * 100)}%</td>
        <td>${formatDate(code.expirationDate)}</td>
        <td>₱${parseFloat(code.minPurchaseAmount || 0).toLocaleString()}</td>
        <td>${code.timesUsed || 0} / ${code.usageLimit || 0}</td>
        <td>${statusBadge}</td>
        <td><button class="btn btn-danger btn-sm" onclick="deletePromoCode('${code._id}')">Delete</button></td>
      </tr>`;
    }).join('');
    // DataTable
    if (window.$ && window.$.fn && window.$.fn.DataTable) {
      setTimeout(() => {
        const table = $(tbody).closest('table');
        if (table.length && !$.fn.dataTable.isDataTable(table[0])) {
          table.DataTable({ order: [], pageLength: 10, destroy: true });
        }
      }, 100);
    }
  } catch (e) {
    tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading promo codes.</td></tr>';
  }
}

async function createPromoCode(e) {
  e.preventDefault();
  const code = document.getElementById('newPromoCodeInput')?.value.trim();
  const discount = parseFloat(document.getElementById('discountPercentageInput')?.value);
  const expiration = document.getElementById('expirationDateInput')?.value;
  const minPurchase = parseFloat(document.getElementById('minPurchaseAmountInput')?.value) || 0;
  const usageLimit = parseInt(document.getElementById('usageLimitInput')?.value) || 50;
  const msgDiv = document.getElementById('createPromoCodeMessage');
  if (!code || !discount || !expiration) {
    msgDiv.textContent = 'Please fill in all required fields.';
    msgDiv.className = 'text-danger';
    return;
  }
  try {
    const response = await fetch('http://localhost:3000/api/promocodes/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code,
        discountPercentage: discount / 100,
        expirationDate: expiration,
        minPurchaseAmount: minPurchase,
        usageLimit
      })
    });
    const data = await response.json();
    if (response.ok && data.code) {
      msgDiv.textContent = 'Promo code created!';
      msgDiv.className = 'text-success';
      e.target.reset();
      renderPromoCodeTable();
    } else {
      msgDiv.textContent = data.message || 'Failed to create promo code.';
      msgDiv.className = 'text-danger';
    }
  } catch (err) {
    msgDiv.textContent = 'Error creating promo code.';
    msgDiv.className = 'text-danger';
  }
}

async function deletePromoCode(id) {
  if (!confirm('Delete this promo code?')) return;
  try {
    const response = await fetch(`http://localhost:3000/api/promocodes/${id}`, { method: 'DELETE' });
    const data = await response.json();
    if (response.ok) {
      showAlert('Promo code deleted.', 'success');
      renderPromoCodeTable();
    } else {
      showAlert(data.message || 'Failed to delete promo code.', 'error');
    }
  } catch (err) {
    showAlert('Error deleting promo code.', 'error');
  }
}

window.renderPromoCodeTable = renderPromoCodeTable;
window.createPromoCode = createPromoCode;
window.deletePromoCode = deletePromoCode;
// --- Blocked Dates Form Submission (Universal) ---
function setupBlockDateForm() {
  const form = document.getElementById('blockDateForm');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const startDate = document.getElementById('blockStartDate')?.value;
    const endDate = document.getElementById('blockEndDate')?.value;
    const reason = document.getElementById('blockReason')?.value;
    // Service checkboxes (optional)
    let serviceIds = [];
    const serviceCheckboxes = document.querySelectorAll('#serviceCheckboxes input[type="checkbox"]:checked');
    serviceCheckboxes.forEach(cb => serviceIds.push(cb.value));
    const appliesToAll = serviceIds.length === 0;
    if (!startDate || !endDate || !reason) {
      showAlert('Please fill in all required fields.', 'error');
      return;
    }
    try {
      const response = await fetch('http://localhost:3000/api/blocked-dates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : (window.getAuthToken && window.getAuthToken()) || ''}`
        },
        body: JSON.stringify({
          startDate,
          endDate,
          reason,
          serviceIds,
          appliesToAll
        })
      });
      const data = await response.json();
      if (data.success) {
        showAlert('Blocked date added.', 'success');
        form.reset();
        if (typeof loadBlockedDates === 'function') loadBlockedDates();
      } else {
        showAlert(data.message || 'Failed to block date.', 'error');
      }
    } catch (err) {
      showAlert('Error blocking date.', 'error');
    }
  });
}

// Expose for global use
window.setupBlockDateForm = setupBlockDateForm;
// --- Blocked Dates (Universal) ---
async function loadBlockedDates() {
  // Support both admin (blockedDatesList) and manager (blocked-dates-list) IDs
  const list = document.getElementById("blocked-dates-list") || document.getElementById("blockedDatesList");
  if (!list) return;
  try {
    const response = await fetch("http://localhost:3000/api/blocked-dates");
    const data = await response.json();
    
    if (data.success && data.blockedDates.length > 0) {
      // Fetch services to map IDs to names
      const servicesResponse = await fetch('/api/services/admin/all');
      const services = await servicesResponse.json();
      const serviceMap = {};
      if (Array.isArray(services)) {
        services.forEach(s => {
          serviceMap[s._id] = s.name;
        });
      }
      
      // Create table format
      let html = `
        <table class="table table-bordered table-hover" style="width: 100%; margin-top: 1rem;">
          <thead class="table-light">
            <tr>
              <th style="width: 25%;">Start Date</th>
              <th style="width: 25%;">End Date</th>
              <th style="width: 35%;">Services Blocked</th>
              <th style="width: 15%;">Action</th>
            </tr>
          </thead>
          <tbody>
      `;
      
      data.blockedDates.forEach(bd => {
        const servicesList = (bd.serviceIds && bd.serviceIds.length > 0 && !bd.appliesToAllServices) 
          ? bd.serviceIds.map(sid => serviceMap[sid] || 'Unknown').join(', ')
          : '<em>All Services</em>';
        
        html += `
          <tr>
            <td>${formatDate(bd.startDate)}</td>
            <td>${formatDate(bd.endDate)}</td>
            <td>${servicesList}</td>
            <td>
              <button class="btn btn-sm btn-danger" onclick="unblockDate('${bd._id}')">Remove</button>
            </td>
          </tr>
        `;
      });
      
      html += `
          </tbody>
        </table>
      `;
      
      list.innerHTML = html;
    } else {
      list.innerHTML = '<div class="alert alert-info">No blocked dates yet.</div>';
    }
  } catch(e) {
    list.innerHTML = '<div class="alert alert-danger">Error loading blocked dates.</div>';
  }
}

async function unblockDate(blockedDateId) {
  if (!confirm("Remove this blocked date?")) return;
  try {
    const response = await fetch(`http://localhost:3000/api/blocked-dates/${blockedDateId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${typeof getAuthToken === 'function' ? getAuthToken() : (window.getAuthToken && window.getAuthToken()) || ''}` }
    });
    if (response.ok) {
      showAlert("Blocked date removed.", "success");
      loadBlockedDates();
    } else {
      showAlert("Failed to remove blocked date.", "error");
    }
  } catch (e) {
    showAlert("Error removing blocked date.", "error");
  }
}

// Expose for global use
window.loadBlockedDates = loadBlockedDates;
window.unblockDate = unblockDate;
/**
 * ui-core.js
 * Core UI logic, shared utilities, and global state management.
 */

// --- Global Data Store ---
const resortServices = [];

// --- Configuration ---
const DOWNPAYMENT_PERCENTAGE = 0.5;
const DOWNPAYMENT_ENABLED = true;

// --- Navigation Config ---
const navLinks = {
  public: [
    { text: "Amenities", href: "services-list.html" },
    { text: "Reviews", href: "feedback.html" },
    { text: "Contact Us", href: "contact.html" },
    { text: "🛒 Cart", href: "cart.html", id: "cart-link" },
  ],
  customer: [
    { text: "Amenities", href: "services-list.html" },
    { text: "Reviews", href: "feedback.html" },
    { text: "Contact Us", href: "contact.html" },
    { text: "🛒 Cart", href: "cart.html", id: "cart-link" },
  ],
  admin: [
    { text: "Admin Dashboard", href: "/admin/admin-dashboard.html" },
  ],
  manager: [
    { text: "Manager Dashboard", href: "/manager/manager-dashboard.html" },
  ],
};

// --- Footer Config ---
const footerQuickLinks = {
  public: [
    { text: "Amenities", href: "services-list.html" },
    { text: "Reviews", href: "feedback.html" },
    { text: "Cart", href: "cart.html" },
  ],
  customer: [
    { text: "Amenities", href: "services-list.html" },
    { text: "Reviews", href: "feedback.html" },
    { text: "Cart", href: "cart.html" },
  ],
  admin: [
    { text: "Check-in Demo", href: "checkin-demo.html" },
    { text: "Admin Dashboard", href: "/admin/admin-dashboard.html" },
  ],
  manager: [
    { text: "Check-in Demo", href: "checkin-demo.html" },
    { text: "Manager Dashboard", href: "/manager/manager-dashboard.html" },
  ],
};

// --- Utilities ---

function debounce(func, delay) {
  let timeoutId;
  return function (...args) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      func.apply(this, args);
    }, delay);
  };
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const options = { year: "numeric", month: "short", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
}

function escapeHtml(unsafe) {
  if (!unsafe) return "";
  return unsafe
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function showAlert(message, type = "info") {
  const typeMap = {
    error: "error",
    success: "success",
    info: "info",
    warning: "warning",
  };
  if (typeof showToast === "function") {
    showToast(message, typeMap[type] || "info");
  } else if (typeof showModal === "function") {
    showModal(type.charAt(0).toUpperCase() + type.slice(1), `<p>${message}</p>`, typeMap[type] || "info");
  }
}

async function fetchServices() {
  try {
    const response = await fetch("http://localhost:3000/api/services");
    const data = await response.json();
    console.log('Fetched data from /api/services:', data);
    let services = [];
    if (data.success && Array.isArray(data.services)) {
      services = data.services;
    } else if (Array.isArray(data)) {
      services = data;
    }
    resortServices.length = 0;
    resortServices.push(...services);
    window.resortServices = resortServices;
    console.log('resortServices after fetch:', resortServices);
    if (typeof renderServiceCards === "function") {
      renderServiceCards();
    }
  } catch (error) {
    console.error("Error fetching services:", error);
  }
}

function getAuthToken() {
  return sessionStorage.getItem("token") || sessionStorage.getItem("authToken") || "";
}

function getLoggedInUser() {
  const userString = sessionStorage.getItem("loggedInUser");
  const token = getAuthToken();
  if (!token || !userString) return null;
  try {
    return JSON.parse(userString);
  } catch (e) {
    console.error("Error parsing loggedInUser from sessionStorage:", e);
    return null;
  }
}

function getCurrentRole() {
  const user = getLoggedInUser();
  if (user && user.role && typeof user.role === "string") {
    return user.role.toLowerCase().trim();
  }
  return "public";
}

function setRole(role) {
  sessionStorage.setItem("qreserve_user_role", role);
}

function logout() {
  sessionStorage.removeItem("token");
  sessionStorage.removeItem("authToken");
  sessionStorage.removeItem("loggedInUser");
  sessionStorage.removeItem("qreserve_user_role");
  sessionStorage.removeItem("qreserve_logged_user_email");
  sessionStorage.removeItem("qreserve_token");

  if (typeof showToast === "function") {
    showToast("Logged out successfully!", "success");
  }
  setTimeout(() => {
    window.location.href = "/index.html";
  }, 1000);
}

// --- UI Rendering ---

function renderNavigation() {
  const navUl = document.querySelector("nav ul");
  if (!navUl) return;

  const roleFromStorage = getCurrentRole();
  let currentRoleToUse = roleFromStorage;
  const currentPath = window.location.pathname;

  // Role enforcement for admin pages
  if (currentPath.includes("admin-dashboard.html") || currentPath.includes("user-management.html")) {
    if (roleFromStorage !== "public") currentRoleToUse = "admin";
  } else if ((currentPath.includes("login.html") || currentPath.includes("register.html")) && roleFromStorage !== "public") {
    window.location.href = "index.html";
    return;
  }

  const links = navLinks[currentRoleToUse] || navLinks.public;
  navUl.innerHTML = "";

  // Home link
  const homeLi = document.createElement("li");
  homeLi.innerHTML = `<a href="index.html">Home</a>`;
  navUl.appendChild(homeLi);

  // Dynamic links
  links.forEach((link) => {
    const li = document.createElement("li");
    if (link.id === 'cart-link') {
      li.innerHTML = `
        <a href="${link.href}" class="cart-icon-wrapper">
          ${link.text}
          <span id="cart-badge" style="display: none;">0</span>
        </a>`;
    } else {
      li.innerHTML = `<a href="${link.href}">${link.text}</a>`;
    }
    navUl.appendChild(li);
  });

  // Update cart badge if function exists
  if (typeof updateCartBadge === "function") {
    setTimeout(() => updateCartBadge(), 100);
  }

  // Help link
  const helpLi = document.createElement("li");
  helpLi.innerHTML = `<a href="help.html">Help</a>`;
  navUl.appendChild(helpLi);

  // Auth section
  if (roleFromStorage !== "public") {
    const profileLi = document.createElement("li");
    profileLi.classList.add("profile-dropdown");
    
    // Get logged-in user's full name
    const loggedInUserStr = sessionStorage.getItem('loggedInUser');
    const userName = loggedInUserStr ? JSON.parse(loggedInUserStr).full_name || 'User' : 'User';
    
    profileLi.innerHTML = `
      <button id="profile-icon" class="icon-button" aria-expanded="false" aria-controls="profile-menu">
        <span style="font-size: 1.5rem;">👤</span>
      </button>
      <div class="dropdown-content" id="profile-menu">
        <div style="padding: 0.75rem 1rem; border-bottom: 1px solid #ddd; font-weight: 600; color: white; text-align: center;">${userName}</div>
        <a href="customer-dashboard.html">My Profile</a>
        <a href="#" onclick="logout(); return false;">Logout</a>
      </div>`;
    navUl.appendChild(profileLi);
    attachDropdownToggle();

    if (typeof addResumeReservationNav === "function") {
      addResumeReservationNav();
    }
  } else {
    const loginLi = document.createElement("li");
    const registerLi = document.createElement("li");
    loginLi.innerHTML = `<a href="login.html">Login</a>`;
    registerLi.innerHTML = `<a href="register.html">Register</a>`;
    navUl.appendChild(loginLi);
    navUl.appendChild(registerLi);
  }
}

function renderFooterQuickLinks() {
  const footerUl = document.querySelector(".footer-section.quick-links ul");
  if (!footerUl) return;
  const role = getCurrentRole();
  const links = footerQuickLinks[role] || footerQuickLinks.public;
  footerUl.innerHTML = "";
  links.forEach((link) => {
    const li = document.createElement("li");
    li.innerHTML = `<a href="${link.href}">${link.text}</a>`;
    footerUl.appendChild(li);
  });
}

// Render complete footer for all pages
function renderCompleteFooter() {
  const footer = document.querySelector('footer');
  if (!footer) return;
  
  const role = getCurrentRole();
  const quickLinks = footerQuickLinks[role] || footerQuickLinks.public;
  
  footer.innerHTML = `
    <div class="footer-content">
      <div class="footer-section contact-info">
        <h3>Tito Renz Resort</h3>
        <p>Your seamless booking experience starts here.</p>
        <p>📍 Sitio Bulalo, Norzagaray, Philippines</p>
        <p>📞 0977 246 8920 or 0916 640 3411</p>
        <p>📧 titorenznorzagaray@gmail.com</p>
      </div>

      <div class="footer-section quick-links">
        <h3>Quick Links</h3>
        <ul>
          ${quickLinks.map(link => `<li><a href="${link.href}">${link.text}</a></li>`).join('')}
        </ul>
      </div>

      <div class="footer-section about-contact">
        <h3>About & Contact</h3>
        <ul>
          <li><a href="contact.html">Send Us a Message</a></li>
          <li><a href="help.html">Help / Guides</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <p>&copy; 2025 QReserve Project - All Rights Reserved.</p>
      <p style="margin-top:8px;">
        <a href="#" id="termsLinkFooter" style="color:#d4a574;text-decoration:underline;font-weight:600;">View Terms and Conditions</a>
      </p>
    </div>
  `;
  
  // Attach terms link handler
  setTimeout(() => {
    const termsLink = document.getElementById('termsLinkFooter');
    if (termsLink && typeof showModal === 'function') {
      termsLink.addEventListener('click', function(e) {
        e.preventDefault();
        showModal('Terms and Conditions', '<img src="images/terms.png" alt="Terms and Conditions" style="max-width:100%;height:auto;display:block;margin:0 auto;">', 'info');
      });
    }
  }, 0);
}

function attachDropdownToggle() {
  const profileButton = document.getElementById("profile-icon");
  const profileMenu = document.getElementById("profile-menu");
  if (profileButton && profileMenu) {
    profileButton.addEventListener("click", () => {
      profileMenu.classList.toggle("show-dropdown");
      const isExpanded = profileButton.getAttribute("aria-expanded") === "true";
      profileButton.setAttribute("aria-expanded", !isExpanded);
    });
    window.addEventListener("click", (event) => {
      if (!event.target.matches("#profile-icon") && !event.target.closest(".profile-dropdown")) {
        if (profileMenu.classList.contains("show-dropdown")) {
          profileMenu.classList.remove("show-dropdown");
          profileButton.setAttribute("aria-expanded", "false");
        }
      }
    });
  }
}

// Global initialization
document.addEventListener("DOMContentLoaded", async () => {
  await fetchServices();
  
  // Password toggle
  const passwordToggles = document.querySelectorAll(".password-toggle");
  passwordToggles.forEach((button) => {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      const targetId = button.getAttribute("data-target");
      const input = document.getElementById(targetId);
      if (input) {
        if (input.type === "password") {
          input.type = "text";
          button.textContent = "👁️‍🗨️";
        } else {
          input.type = "password";
          button.textContent = "👁️";
        }
      }
    });
  });

  renderNavigation();
  renderCompleteFooter();

  // Featured Amenities Carousel System
  const sectionButtons = document.querySelectorAll(".amenities-section-btn");
  const carousels = document.querySelectorAll(".amenities-carousel");

  sectionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const sectionName = button.getAttribute("data-section");
      sectionButtons.forEach((btn) => btn.classList.remove("active"));
      carousels.forEach((carousel) => carousel.classList.remove("active"));
      button.classList.add("active");
      const activeCarousel = document.querySelector(`.amenities-carousel[data-section="${sectionName}"]`);
      if (activeCarousel) {
        activeCarousel.classList.add("active");
        const slides = activeCarousel.querySelectorAll(".carousel-slide");
        slides.forEach((slide) => slide.classList.remove("active"));
        if (slides.length > 0) slides[0].classList.add("active");
      }
    });
  });

  const prevButtons = document.querySelectorAll(".carousel-nav-btn.prev");
  const nextButtons = document.querySelectorAll(".carousel-nav-btn.next");

  prevButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const carousel = button.closest(".amenities-carousel");
      if (carousel) navigateCarousel(carousel, -1);
    });
  });

  nextButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const carousel = button.closest(".amenities-carousel");
      if (carousel) navigateCarousel(carousel, 1);
    });
  });

  document.addEventListener("keydown", (e) => {
    const activeCarousel = document.querySelector(".amenities-carousel.active");
    if (!activeCarousel) return;
    if (e.key === "ArrowLeft") navigateCarousel(activeCarousel, -1);
    else if (e.key === "ArrowRight") navigateCarousel(activeCarousel, 1);
  });
});

function navigateCarousel(carousel, direction) {
  const slides = carousel.querySelectorAll(".carousel-slide");
  if (slides.length === 0) return;
  let currentIndex = Array.from(slides).findIndex((slide) => slide.classList.contains("active"));
  currentIndex = (currentIndex + direction + slides.length) % slides.length;
  slides.forEach((slide) => slide.classList.remove("active"));
  slides[currentIndex].classList.add("active");
}

// Expose globals
// Open Send Email Modal
window.openSendEmailModal = function(reservationId, email) {
  const modal = document.getElementById('sendEmailModal');
  if (!modal) return;
  document.getElementById('emailReservationId').value = reservationId;
  document.getElementById('emailSubject').value = '';
  document.getElementById('emailBody').value = '';
  document.getElementById('sendEmailStatus').textContent = '';
  if (window.bootstrap && window.bootstrap.Modal) {
    const bsModal = window.bootstrap.Modal.getOrCreateInstance(modal);
    bsModal.show();
  } else {
    modal.style.display = 'block';
  }
};

// Send Email Handler
document.addEventListener('DOMContentLoaded', function() {
  const sendEmailForm = document.getElementById('sendEmailForm');
  if (sendEmailForm) {
    sendEmailForm.addEventListener('submit', async function(e) {
      e.preventDefault();
      const reservationId = document.getElementById('emailReservationId').value;
      const subject = document.getElementById('emailSubject').value;
      const body = document.getElementById('emailBody').value;
      const statusDiv = document.getElementById('sendEmailStatus');
      statusDiv.textContent = 'Sending...';
      try {
        const res = await fetch('http://localhost:3000/api/reservations/send-email', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${getAuthToken()}`
          },
          body: JSON.stringify({ reservationId, subject, body })
        });
        if (res.ok) {
          statusDiv.textContent = 'Email sent successfully!';
        } else {
          statusDiv.textContent = 'Failed to send email.';
        }
      } catch (err) {
        statusDiv.textContent = 'Error sending email.';
      }
    });
  }
});
window.logout = logout;
window.setRole = setRole;
window.getCurrentRole = getCurrentRole;
window.getLoggedInUser = getLoggedInUser;
window.formatDate = formatDate;
window.escapeHtml = escapeHtml;
window.showAlert = showAlert;
window.getAuthToken = getAuthToken;
window.resortServices = resortServices;

// admin-reservations.js
// Handles rendering of admin reservation table with receipt and actions

// Store reservations data globally for expand functionality
let reservationsData = [];

function formatReservationDetails(r) {
  // Fix receipt URL
  const receiptCell = r.receiptFileName
    ? `<a href="trr-backend/uploads/${r.receiptFileName}" target="_blank"><img src="trr-backend/uploads/${r.receiptFileName}" alt="Receipt" style="max-width:200px;max-height:200px;border-radius:4px;"></a>`
    : '<span class="text-muted">No receipt uploaded</span>';
  
  // QR Code
  const qrCodeHTML = `
    <div style="text-align:center;">
      <button class="btn btn-outline-primary btn-sm" onclick="showReservationQRModal('${r.reservationId || r._id}')">View QR Code</button>
    </div>
  `;
  
  // Financial breakdown
  const basePrice = r.basePrice || r.finalTotal || 0;
  const discount = r.discountValue || 0;
  const downpayment = r.downpaymentAmount || 0;
  const remainingBalance = r.remainingBalance || 0;
  
  return `
    <div class="details-container">
      <div class="detail-section">
        <h6>👤 Guest Details</h6>
        <p><strong>Name:</strong> ${escapeHtml(r.full_name || r.customer_name || 'N/A')}</p>
        <p><strong>Email:</strong> ${escapeHtml(r.email || 'N/A')}</p>
        <p><strong>Phone:</strong> ${escapeHtml(r.phone || r.phoneNumber || 'N/A')}</p>
        <p><strong>Address:</strong> ${escapeHtml(r.address || 'N/A')}</p>
      </div>
      <div class="detail-section">
        <h6>🏨 Service Details</h6>
        <p><strong>Service Type:</strong> ${escapeHtml(r.serviceType || 'N/A')}</p>
        <p><strong>Service Name:</strong> ${escapeHtml(r.serviceName || r.serviceId || 'N/A')}</p>
        <p><strong>Duration:</strong> ${escapeHtml(r.durationLabel || r.timeSlotLabel || 'N/A')}</p>
        <p><strong>Number of Guests:</strong> ${r.guests || r.numberOfGuests || 'N/A'}</p>
      </div>
      <div class="detail-section">
        <h6>💰 Financial Breakdown</h6>
        <p><strong>Base Price:</strong> ₱${parseFloat(basePrice).toLocaleString()}</p>
        <p><strong>Discount Code:</strong> ${escapeHtml(r.discountCode || 'None')}</p>
        <p><strong>Discount Value:</strong> -₱${parseFloat(discount).toLocaleString()}</p>
        <p><strong>Final Total:</strong> <span style="font-size:1.2em;color:#28a745;">₱${parseFloat(r.finalTotal || 0).toLocaleString()}</span></p>
        ${downpayment > 0 ? `<p><strong>Downpayment:</strong> ₱${parseFloat(downpayment).toLocaleString()}</p>` : ''}
        ${remainingBalance > 0 ? `<p><strong>Remaining Balance:</strong> ₱${parseFloat(remainingBalance).toLocaleString()}</p>` : ''}
        <p><strong>Payment Type:</strong> ${escapeHtml(r.paymentType || 'N/A')}</p>
      </div>
      <div class="detail-section">
        <h6>💳 Payment Details</h6>
        <p><strong>GCash Ref #:</strong> ${escapeHtml(r.gcashReferenceNumber || 'N/A')}</p>
        <p><strong>Payment Status:</strong> ${escapeHtml(r.paymentStatus || r.status || 'N/A')}</p>
        <div><strong>Receipt:</strong><br>${receiptCell}</div>
      </div>
      <div class="detail-section">
        <h6>⏱️ Timeline</h6>
        <p><strong>Date Booked:</strong> ${r.createdAt ? new Date(r.createdAt).toLocaleString() : 'N/A'}</p>
        <p><strong>Check-in:</strong> ${r.check_in ? new Date(r.check_in).toLocaleString() : 'N/A'}</p>
        <p><strong>Check-out:</strong> ${r.check_out ? new Date(r.check_out).toLocaleString() : 'N/A'}</p>
        ${r.checkoutPerformedBy ? `<p><strong>Checked out by:</strong> ${escapeHtml(r.checkoutPerformedBy)}</p>` : ''}
      </div>
      <div class="detail-section">
        <h6>🎁 Inclusions</h6>
        ${Array.isArray(r.inclusions) && r.inclusions.length > 0 
          ? '<ul class="mb-0">' + r.inclusions.map(inc => `<li>${escapeHtml(inc)}</li>`).join('') + '</ul>'
          : '<p class="text-muted">No inclusions listed</p>'}
      </div>
      <div class="detail-section">
        <h6>🔖 QR Code</h6>
        ${qrCodeHTML}
      </div>
    </div>
  `;
}

function toggleReservationDetails(btn, reservationId) {
  const row = btn.closest('tr');
  const nextRow = row.nextElementSibling;
  
  // If already expanded, collapse it
  if (nextRow && nextRow.classList.contains('reservation-details-row')) {
    nextRow.remove();
    btn.textContent = '+';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-outline-primary');
  } else {
    // Expand: find reservation data and insert detail row
    const reservation = reservationsData.find(res => (res._id || res.reservationId) === reservationId);
    if (reservation) {
      const detailHTML = formatReservationDetails(reservation);
      const detailRow = document.createElement('tr');
      detailRow.className = 'reservation-details-row';
      detailRow.innerHTML = `<td colspan="7">${detailHTML}</td>`;
      row.after(detailRow);
      btn.textContent = '−';
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-danger');
    }
  }
}

async function renderAdminReservations() {
    const tbody = document.getElementById("admin-reservation-list");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="7" class="text-center">Loading reservations...</td></tr>';
       try {
         // Fetch all reservations for admin
         const response = await fetch("http://localhost:3000/api/reservations/allreservation");
         const data = await response.json();
         const allReservations = Array.isArray(data.reservations) ? data.reservations : [];
         // Filter out CART items - only show paid/confirmed reservations
         const reservations = allReservations.filter(res => 
             res.status && res.status.toUpperCase() !== 'CART'
         );
         
         // Store globally for expand functionality
         reservationsData = reservations;
         
         // Sort by check_in date - most recent first
         reservations.sort((a, b) => {
           const dateA = a.check_in ? new Date(a.check_in).getTime() : 0;
           const dateB = b.check_in ? new Date(b.check_in).getTime() : 0;
           return dateB - dateA; // Descending order (most recent first)
         });
         
         if (reservations.length === 0) {
           tbody.innerHTML = '<tr><td colspan="7" class="text-center">No reservations found.</td></tr>';
           return;
         }
         tbody.innerHTML = reservations.map(r => {
           // Status badge styling
           let statusBadge = '';
           switch(r.status) {
             case 'PAID':
               statusBadge = '<span class="badge bg-warning">PAID</span>';
               break;
             case 'CONFIRMED':
               statusBadge = '<span class="badge bg-info">CONFIRMED</span>';
               break;
             case 'CHECKED_IN':
               statusBadge = '<span class="badge bg-primary">CHECKED IN</span>';
               break;
             case 'COMPLETED':
               statusBadge = '<span class="badge bg-success">COMPLETED</span>';
               break;
             case 'CANCELLED':
               statusBadge = '<span class="badge bg-danger">CANCELLED</span>';
               break;
             default:
               statusBadge = `<span class="badge bg-secondary">${r.status}</span>`;
           }
           
           let actions = '';
           // Only show Accept if status is PAID and not already confirmed/completed/cancelled
           if (r.status === 'PAID') {
             actions += `<button class="btn btn-success btn-sm me-1" onclick="confirmReservation('${r._id}', '${escapeHtml(r.email || '')}', '${escapeHtml(r.full_name || r.customer_name || '')}')">Accept</button>`;
           }
           if (r.status === 'CONFIRMED') {
             actions += `<button class="btn btn-warning btn-sm me-1" onclick="checkInReservation('${r._id}', '${escapeHtml(r.email || '')}', '${escapeHtml(r.full_name || r.customer_name || '')}')">Check-in</button>`;
           }
           if (r.status === 'CHECKED_IN') {
             actions += `<button class="btn btn-secondary btn-sm me-1" onclick="checkoutReservation('${r._id}', '${escapeHtml(r.email || '')}', '${escapeHtml(r.full_name || r.customer_name || '')}')">Checkout</button>`;
           }
           if (r.status !== 'CANCELLED' && r.status !== 'COMPLETED') {
             actions += `<button class="btn btn-danger btn-sm me-1" onclick="cancelReservation('${r._id}')">Cancel</button>`;
           }
          // Send Email button
          actions += `<button class="btn btn-info btn-sm me-1" onclick="openSendEmailModal('${r._id}', '${escapeHtml(r.email || '')}')">Send Email</button>`;
          
          return `<tr>
            <td><button class="btn btn-sm btn-outline-primary expand-reservation-btn" onclick="toggleReservationDetails(this, '${r._id}')">+</button></td>
            <td>${r.reservationId || r._id}</td>
            <td>${escapeHtml(r.full_name || r.customer_name || '')}</td>
            <td>${r.check_in ? new Date(r.check_in).toLocaleString() : ''}</td>
            <td>₱${parseFloat(r.finalTotal || 0).toLocaleString()}</td>
            <td>${statusBadge}</td>
            <td>${actions}</td>
          </tr>`;
        }).join("");
      // Initialize DataTable after rendering
      if (window.$ && window.$.fn && window.$.fn.DataTable) {
        setTimeout(() => {
          const table = $(tbody).closest('table');
          if (table.length && !$.fn.dataTable.isDataTable(table[0])) {
            table.DataTable({
              order: [],
              pageLength: 10,
              destroy: true
            });
          }
        }, 100);
      }
    } catch (e) {
      tbody.innerHTML = '<tr><td colspan="7" class="text-center text-danger">Error loading reservations.</td></tr>';
    }
// DataTable for users table
function renderUsersListDataTable() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  if (window.$ && window.$.fn && window.$.fn.DataTable) {
    setTimeout(() => {
      const table = $(tbody).closest('table');
      if (table.length && !$.fn.dataTable.isDataTable(table[0])) {
        table.DataTable({
          order: [],
          pageLength: 10,
          destroy: true
        });
      }
    }, 100);
  }
}

// DataTable for services table
function renderServicesListDataTable() {
  const tbody = document.getElementById("serviceTableBody");
  if (!tbody) return;
  if (window.$ && window.$.fn && window.$.fn.DataTable) {
    setTimeout(() => {
      const table = $(tbody).closest('table');
      if (table.length) {
        if ($.fn.dataTable.isDataTable(table[0])) {
          table.DataTable().clear().destroy();
        }
        table.DataTable({
          order: [],
          pageLength: 10,
          destroy: true,
          scrollX: true,
          scrollY: '500px',
          scrollCollapse: true
        });
      }
    }, 100);
  }
}

// Expose for global use
window.renderUsersListDataTable = renderUsersListDataTable;
window.renderServicesListDataTable = renderServicesListDataTable;
}

// Expose globally
window.renderAdminReservations = renderAdminReservations;
window.toggleReservationDetails = toggleReservationDetails;

/**
 * admin-system.js
 * Handles Admin and Manager Dashboard functionality.
 */

// --- User Management ---

// Store current view mode for users list
let usersListViewMode = 'active'; // 'active' or 'archived'

async function renderUsersList(viewMode = 'active') {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  // Update view mode
  usersListViewMode = viewMode;
  
  try {
    // Static role ID to name mapping
    const roleMap = {
      '6911d923e3fb923eed25f44d': 'admin',
      '6911d910e3fb923eed25f44c': 'manager',
      '6911d7b841d151b05bf687c7': 'customer'
    };

    // Build query parameters based on view mode
    const queryParam = viewMode === 'archived' ? '?archived=true' : '?archived=false';
    
    const response = await fetch(`http://localhost:3000/api/users${queryParam}`, {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    const users = await response.json();
    if (Array.isArray(users)) {
      // Build a map for quick lookup by ID for editing
      window._adminUsersById = {};
      
      if (users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="7" class="text-center text-muted">${viewMode === 'archived' ? 'No archived users.' : 'No active users.'}</td></tr>`;
        return;
      }
      
      tbody.innerHTML = users.map(user => {
        window._adminUsersById[user._id] = user;
        // Compose full name
        const name = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');
        // Status
        const status = user.isActive ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>';
        // Role name
        const roleName = roleMap[user.role_id] || user.role_id || '';
        
        // Different buttons based on view mode
        let actionButtons = '';
        if (viewMode === 'archived') {
          actionButtons = `<button class="btn btn-sm btn-primary" onclick="restoreUser('${user._id}', '${escapeHtml(name)}')">Restore</button>`;
        } else {
          actionButtons = `
            ${user.isActive 
              ? `<button class="btn btn-sm btn-warning" onclick="deactivateUser('${user._id}', '${escapeHtml(name)}')">Deactivate</button>`
              : `<button class="btn btn-sm btn-success" onclick="reactivateUser('${user._id}', '${escapeHtml(name)}')">Reactivate</button>`
            }
            <button class="btn btn-sm btn-danger" onclick="archiveUser('${user._id}', '${escapeHtml(name)}')">Archive</button>
          `;
        }
        
        return `
          <tr>
            <td>${escapeHtml(user._id)}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.phone || '')}</td>
            <td>${escapeHtml(roleName)}</td>
            <td>${status}</td>
            <td>${actionButtons}</td>
          </tr>
        `;
      }).join("");
      if (typeof renderUsersListDataTable === 'function') {
        setTimeout(() => renderUsersListDataTable(), 100);
      }
    } else {
      tbody.innerHTML = '<tr><td colspan="7" class="text-danger">Failed to load users.</td></tr>';
    }
  } catch (error) {
    console.error("Error fetching users:", error);
    tbody.innerHTML = '<tr><td colspan="7" class="text-danger">Error loading users.</td></tr>';
  }
}

async function deleteUser(userId) {
  if (!confirm("Are you sure you want to delete this user?")) return;
  try {
    const response = await fetch(`http://localhost:3000/api/users/${userId}`, {
      method: "DELETE",
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    if (response.ok) {
      showAlert("User deleted.", "success");
      renderUsersList();
    }
  } catch (error) {
    showAlert("Error deleting user.", "error");
  }
}

async function deactivateUser(userId, userName) {
  if (!confirm(`Are you sure you want to deactivate ${userName}? They will no longer be able to log in.`)) return;
  try {
    const response = await fetch(`http://localhost:3000/api/auth/admin/accounts/${userId}/deactivate`, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${getAuthToken()}`,
        "Content-Type": "application/json"
      }
    });
    if (response.ok) {
      showAlert(`${userName} has been deactivated.`, "success");
      renderUsersList(usersListViewMode);
    } else {
      showAlert("Failed to deactivate user.", "error");
    }
  } catch (error) {
    showAlert("Error deactivating user.", "error");
  }
}

async function reactivateUser(userId, userName) {
  if (!confirm(`Are you sure you want to reactivate ${userName}?`)) return;
  try {
    const response = await fetch(`http://localhost:3000/api/auth/admin/accounts/${userId}/activate`, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${getAuthToken()}`,
        "Content-Type": "application/json"
      }
    });
    if (response.ok) {
      showAlert(`${userName} has been reactivated.`, "success");
      renderUsersList(usersListViewMode);
    } else {
      showAlert("Failed to reactivate user.", "error");
    }
  } catch (error) {
    showAlert("Error reactivating user.", "error");
  }
}

async function archiveUser(userId, userName) {
  if (!confirm(`Are you sure you want to archive ${userName}? Their data will be retained for historic records and can be restored later. They will be automatically deactivated and unable to login.`)) return;
  try {
    const response = await fetch(`http://localhost:3000/api/auth/admin/accounts/${userId}`, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${getAuthToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ isArchived: true, isActive: false })
    });
    if (response.ok) {
      showAlert(`${userName} has been archived and moved to storage. They have been automatically deactivated and cannot login.`, "success");
      renderUsersList(usersListViewMode);
    } else {
      const errorData = await response.json();
      showAlert(errorData.message || "Failed to archive user.", "error");
    }
  } catch (error) {
    showAlert("Error archiving user.", "error");
  }
}

async function restoreUser(userId, userName) {
  if (!confirm(`Are you sure you want to restore ${userName} from the archive?`)) return;
  try {
    const response = await fetch(`http://localhost:3000/api/auth/admin/accounts/${userId}`, {
      method: "PUT",
      headers: { 
        "Authorization": `Bearer ${getAuthToken()}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ isArchived: false, isActive: true })
    });
    if (response.ok) {
      showAlert(`${userName} has been restored from the archive and reactivated.`, "success");
      renderUsersList(usersListViewMode);
    } else {
      const errorData = await response.json();
      showAlert(errorData.message || "Failed to restore user.", "error");
    }
  } catch (error) {
    showAlert("Error restoring user.", "error");
  }
}

// --- Service Management ---
// --- Service Edit/Deactivate Logic ---
async function editService(serviceId) {
  if (typeof openEditServiceModal === 'function') {
    openEditServiceModal(serviceId);
  } else {
    if (typeof showModal === 'function') {
      showModal('Not Ready', '<p>Edit modal is not yet loaded. Please refresh the page.</p>', 'warning');
    }
  }
}
async function deactivateServiceAndRefresh(serviceId) {
  if (!confirm('Are you sure you want to deactivate this service?')) return;
  try {
    const response = await fetch(`http://localhost:3000/api/services/${serviceId}/deactivate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (response.ok) {
      showAlert('Service deactivated.', 'success');
      if (typeof renderServiceTable === 'function') renderServiceTable();
    } else {
      showAlert('Failed to deactivate service.', 'danger');
    }
  } catch (e) {
    showAlert('Error deactivating service.', 'danger');
  }
}
async function activateServiceAndRefresh(serviceId) {
  try {
    const response = await fetch(`http://localhost:3000/api/services/${serviceId}/activate`, {
      method: 'PUT',
      headers: { 'Authorization': `Bearer ${getAuthToken()}` }
    });
    if (response.ok) {
      showAlert('Service activated.', 'success');
      if (typeof renderServiceTable === 'function') renderServiceTable();
    } else {
      showAlert('Failed to activate service.', 'danger');
    }
  } catch (e) {
    showAlert('Error activating service.', 'danger');
  }
}
window.editService = editService;
window.deactivateServiceAndRefresh = deactivateServiceAndRefresh;
window.activateServiceAndRefresh = activateServiceAndRefresh;

async function fetchAllServicesAdmin() {
  try {
    const response = await fetch("http://localhost:3000/api/services/admin/all", {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    return await response.json();
  } catch (error) {
    console.error("Admin service fetch error:", error);
    return { success: false, services: [] };
  }
}

// Store services data globally for expand functionality
let servicesData = [];

function formatServiceDetails(service) {
  // Fix image URLs
  let mainImgUrl = service.image;
  if (mainImgUrl && mainImgUrl.startsWith('/uploads/')) {
    mainImgUrl = mainImgUrl.replace(/^\//, '');
  }
  
  // Gallery images
  let galleryHTML = '';
  if (Array.isArray(service.gallery) && service.gallery.length > 0) {
    galleryHTML = '<div class="gallery-grid">' + service.gallery.map(img => {
      let imgUrl = img;
      if (imgUrl && imgUrl.startsWith('/uploads/')) {
        imgUrl = imgUrl.replace(/^\//, '');
      }
      return `<a href="${imgUrl}" target="_blank"><img src="${imgUrl}" alt="Gallery Image" /></a>`;
    }).join('') + '</div>';
  } else {
    galleryHTML = '<p class="text-muted">No gallery images</p>';
  }
  
  // Inclusions
  let inclusionsHTML = '';
  if (Array.isArray(service.inclusions) && service.inclusions.length > 0) {
    inclusionsHTML = '<ul class="mb-0">' + service.inclusions.map(inc => `<li>${escapeHtml(inc)}</li>`).join('') + '</ul>';
  } else {
    inclusionsHTML = '<p class="text-muted">No inclusions listed</p>';
  }
  
  // Durations table
  let durationsHTML = '';
  if (Array.isArray(service.durations) && service.durations.length > 0) {
    durationsHTML = '<table class="table table-sm table-bordered"><thead><tr><th>Duration</th><th>Hours</th><th>Price</th></tr></thead><tbody>';
    durationsHTML += service.durations.map(d => 
      `<tr><td>${escapeHtml(d.label)}</td><td>${d.hours || ''}</td><td>₱${d.price ? parseFloat(d.price).toLocaleString() : ''}</td></tr>`
    ).join('');
    durationsHTML += '</tbody></table>';
  } else if (Array.isArray(service.timeSlots) && service.timeSlots.length > 0) {
    durationsHTML = '<table class="table table-sm table-bordered"><thead><tr><th>Time Slot</th><th>Price</th></tr></thead><tbody>';
    durationsHTML += service.timeSlots.map(ts => 
      `<tr><td>${escapeHtml(ts.label)}</td><td>₱${ts.price ? parseFloat(ts.price).toLocaleString() : ''}</td></tr>`
    ).join('');
    durationsHTML += '</tbody></table>';
  } else {
    durationsHTML = '<p class="text-muted">No durations/time slots defined</p>';
  }
  
  return `
    <div class="details-container">
      <div class="detail-section">
        <h6>📋 Description</h6>
        <p>${escapeHtml(service.description || 'No description available')}</p>
      </div>
      <div class="detail-section">
        <h6>🖼️ Main Image</h6>
        ${service.image ? `<a href="${mainImgUrl}" target="_blank"><img src="${mainImgUrl}" style="max-width:100%;height:auto;border-radius:8px;" /></a>` : '<p class="text-muted">No main image</p>'}
      </div>
      <div class="detail-section">
        <h6>🎨 Gallery Images</h6>
        ${galleryHTML}
      </div>
      <div class="detail-section">
        <h6>🎁 Inclusions</h6>
        ${inclusionsHTML}
      </div>
      <div class="detail-section">
        <h6>⏰ Durations & Pricing</h6>
        ${durationsHTML}
      </div>
      <div class="detail-section">
        <h6>📝 Notes</h6>
        <p>${escapeHtml(service.notes || 'No additional notes')}</p>
      </div>
    </div>
  `;
}

function toggleServiceDetails(btn, serviceId) {
  const row = btn.closest('tr');
  const nextRow = row.nextElementSibling;
  
  // If already expanded, collapse it
  if (nextRow && nextRow.classList.contains('service-details-row')) {
    nextRow.remove();
    btn.textContent = '+';
    btn.classList.remove('btn-danger');
    btn.classList.add('btn-outline-primary');
  } else {
    // Expand: find service data and insert detail row
    const service = servicesData.find(s => (s._id || s.id) === serviceId);
    if (service) {
      const detailHTML = formatServiceDetails(service);
      const detailRow = document.createElement('tr');
      detailRow.className = 'service-details-row';
      detailRow.innerHTML = `<td colspan="8">${detailHTML}</td>`;
      row.after(detailRow);
      btn.textContent = '−';
      btn.classList.remove('btn-outline-primary');
      btn.classList.add('btn-danger');
    }
  }
}

async function renderServiceTable() {
  const tbody = document.getElementById("serviceTableBody");
  if (!tbody) return;

  const data = await fetchAllServicesAdmin();
  // Handle both array response and {success: true, services: []} response
  const services = Array.isArray(data) ? data : (data.success && Array.isArray(data.services) ? data.services : []);
  
  // Store globally for expand functionality
  servicesData = services;
  
  if (services.length > 0) {
    tbody.innerHTML = services.map(service => {
        return `
          <tr>
            <td><button class="btn btn-sm btn-outline-primary expand-service-btn" onclick="toggleServiceDetails(this, '${service._id || service.id}')">+</button></td>
            <td>${escapeHtml(service.id || service._id)}</td>
            <td>${escapeHtml(service.name)}</td>
            <td>${escapeHtml(service.type)}</td>
            <td>${escapeHtml(service.category)}</td>
            <td>${service.max_guests || ''}</td>
            <td>${service.isActive ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>'}</td>
            <td>
              <button class="btn btn-sm btn-primary" onclick="editService('${service._id}')">Edit</button>
              <button class="btn btn-sm ${service.isActive ? 'btn-danger' : 'btn-success'}" 
                      onclick="${service.isActive ? 'deactivate' : 'activate'}ServiceAndRefresh('${service._id}')">
                ${service.isActive ? 'Deactivate' : 'Reactivate'}
              </button>
            </td>
          </tr>
        `;
      }).join("");
    } else {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center">No services found.</td></tr>';
    }
}

// Expose functions globally
window.toggleServiceDetails = toggleServiceDetails;


// --- Reservation Actions ---
// --- Check-in and Checkout Actions ---
async function checkInReservation(reservationId, email, name) {
  if (!confirm(`Check in reservation for ${name || 'this guest'}?`)) return;
  try {
    // The backend expects a PUT to /api/reservations/update-status/:id with status: 'CHECKED_IN'
    const response = await fetch(`http://localhost:3000/api/reservations/update-status/${reservationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status: 'CHECKED_IN' })
    });
    if (response.ok) {
      showAlert('Guest checked in.', 'success');
      if (typeof renderAdminReservations === 'function') renderAdminReservations();
    } else {
      showAlert('Failed to check in guest.', 'danger');
    }
  } catch (e) {
    showAlert('Error during check-in.', 'danger');
  }
}

async function checkoutReservation(reservationId, email, name) {
  if (!confirm(`Checkout reservation for ${name || 'this guest'}?`)) return;
  try {
    // Use the public update-status route to set status to COMPLETED
    const response = await fetch(`http://localhost:3000/api/reservations/update-status/${reservationId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status: 'COMPLETED' })
    });
    if (response.ok) {
      showAlert('Guest checked out.', 'success');
      if (typeof renderAdminReservations === 'function') renderAdminReservations();
    } else {
      showAlert('Failed to checkout guest.', 'danger');
    }
  } catch (e) {
    showAlert('Error during checkout.', 'danger');
  }
}

window.checkInReservation = checkInReservation;
window.checkoutReservation = checkoutReservation;

async function confirmReservation(id) {
  try {
    const response = await fetch(`http://localhost:3000/api/reservations/update-status/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status: "CONFIRMED" })
    });
    if (response.ok) {
      showAlert("Reservation confirmed.", "success");
      if (typeof renderAdminReservations === "function") renderAdminReservations();
    }
  } catch(e) {}
}

async function cancelReservation(id) {
  if (!confirm("Cancel this reservation?")) return;
  try {
    const response = await fetch(`http://localhost:3000/api/reservations/update-status/${id}`, {
      method: "PUT",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify({ status: "CANCELLED" })
    });
    if (response.ok) {
      showAlert("Reservation cancelled.", "success");
      if (typeof renderAdminReservations === "function") renderAdminReservations();
    }
  } catch(e) {}
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    if (document.getElementById("users-table-body")) {
        renderUsersList();
    }
    if (document.getElementById("admin-services-table-body")) {
        renderServiceTable();
    }
    if (document.getElementById("blocked-dates-list")) {
        loadBlockedDates();
    }
});

// Expose globals

// Utility: escapeHtml
function escapeHtml(text) {
  if (!text) return '';
  return text.replace(/[&<>"']/g, function (c) {
    return {'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;','\'':'&#39;'}[c]||c;
  });
}

// Utility: getAuthToken
function getAuthToken() {
  return sessionStorage.getItem('token') || sessionStorage.getItem('authToken') || sessionStorage.getItem('qreserve_token') || '';
}

window.deleteUser = deleteUser;
window.deactivateUser = deactivateUser;
window.reactivateUser = reactivateUser;
window.archiveUser = archiveUser;
window.restoreUser = restoreUser;
window.confirmReservation = confirmReservation;
window.cancelReservation = cancelReservation;
window.renderServiceTable = renderServiceTable;
window.renderUsersList = renderUsersList;
window.escapeHtml = escapeHtml;
window.getAuthToken = getAuthToken;
