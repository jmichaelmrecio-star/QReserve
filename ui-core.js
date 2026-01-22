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
      const status = (new Date(code.expirationDate) < new Date()) ? 'Expired' : (code.timesUsed >= code.usageLimit ? 'Used Up' : 'Active');
      return `<tr>
        <td>${escapeHtml(code.code)}</td>
        <td>${Math.round((code.discountPercentage || 0) * 100)}%</td>
        <td>${formatDate(code.expirationDate)}</td>
        <td>₱${parseFloat(code.minPurchaseAmount || 0).toLocaleString()}</td>
        <td>${code.timesUsed || 0} / ${code.usageLimit || 0}</td>
        <td>${status}</td>
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
    if (data.success) {
      list.innerHTML = data.blockedDates.map(bd => `
        <div class="blocked-date-item">
          <span>${formatDate(bd.startDate)} to ${formatDate(bd.endDate)}</span>
          <button onclick="unblockDate('${bd._id}')">Remove</button>
        </div>
      `).join("");
    }
  } catch(e) {
    list.innerHTML = '<div class="text-danger">Error loading blocked dates.</div>';
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
    { text: "🛒 Cart", href: "cart.html", id: "cart-link" },
  ],
  customer: [
    { text: "Amenities", href: "services-list.html" },
    { text: "Reviews", href: "feedback.html" },
    { text: "🛒 Cart", href: "cart.html", id: "cart-link" },
    { text: "My Dashboard", href: "customer-dashboard.html" },
  ],
  admin: [
    { text: "Admin Dashboard", href: "admin-dashboard.html" },
  ],
  manager: [
    { text: "Manager Dashboard", href: "manager-dashboard.html" },
  ],
};

// --- Footer Config ---
const footerQuickLinks = {
  public: [
    { text: "Amenities", href: "services-list.html" },
    { text: "Check-in Demo", href: "checkin-demo.html" },
  ],
  customer: [
    { text: "Amenities", href: "services-list.html" },
    { text: "My Dashboard", href: "customer-dashboard.html" },
    { text: "Check-in Demo", href: "checkin-demo.html" },
  ],
  admin: [
    { text: "Check-in Demo", href: "checkin-demo.html" },
    { text: "Admin Dashboard", href: "admin-dashboard.html" },
  ],
  manager: [
    { text: "Check-in Demo", href: "checkin-demo.html" },
    { text: "Manager Dashboard", href: "manager-dashboard.html" },
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
  } else {
    alert(message);
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
  return localStorage.getItem("token") || localStorage.getItem("authToken");
}

function getLoggedInUser() {
  const userString = localStorage.getItem("loggedInUser");
  const token = localStorage.getItem("token");
  if (!token || !userString) return null;
  try {
    return JSON.parse(userString);
  } catch (e) {
    console.error("Error parsing loggedInUser from localStorage:", e);
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
  localStorage.setItem("qreserve_user_role", role);
}

function logout() {
  localStorage.clear();
  sessionStorage.clear();
  if (typeof showToast === "function") {
    showToast("Logged out successfully!", "success");
  }
  setTimeout(() => {
    window.location.href = "index.html";
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
    profileLi.innerHTML = `
      <button id="profile-icon" class="icon-button" aria-expanded="false" aria-controls="profile-menu">
        <span style="font-size: 1.5rem;">👤</span>
      </button>
      <div class="dropdown-content" id="profile-menu">
        <a href="profile.html">My Profile</a>
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
  renderFooterQuickLinks();

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

async function renderAdminReservations() {
    const tbody = document.getElementById("admin-reservation-list");
    if (!tbody) return;
    tbody.innerHTML = '<tr><td colspan="10" class="text-center">Loading reservations...</td></tr>';
    try {
        // Fetch all reservations for admin
        const response = await fetch("http://localhost:3000/api/reservations/allreservation");
        const data = await response.json();
        const reservations = Array.isArray(data.reservations) ? data.reservations : [];
        if (reservations.length === 0) {
            tbody.innerHTML = '<tr><td colspan="10" class="text-center">No reservations found.</td></tr>';
            return;
        }
        tbody.innerHTML = reservations.map(r => {
            // Map backend fields to table columns
            const receiptCell = r.receiptFileName
                ? `<a href="trr-backend/uploads/${r.receiptFileName}" target="_blank"><img src="trr-backend/uploads/${r.receiptFileName}" alt="Receipt" style="max-width:60px;max-height:60px;border-radius:4px;"></a>`
                : '<span class="text-muted">No receipt</span>';
            let actions = '';
            // Only show Accept if status is PAID and not already confirmed/completed/cancelled
            if (r.status === 'PAID') {
                actions += `<button class="btn btn-success btn-sm me-1" onclick="confirmReservation('${r._id}')">Accept</button>`;
            }
            if (r.status !== 'CANCELLED' && r.status !== 'COMPLETED') {
                actions += `<button class="btn btn-danger btn-sm" onclick="cancelReservation('${r._id}')">Cancel</button>`;
            }
            return `<tr>
                <td>${r.reservationId || r._id}</td>
                <td>${escapeHtml(r.full_name || r.customer_name || '')}</td>
                <td>${escapeHtml(r.email || '')}</td>
                <td>${escapeHtml(r.serviceType || '')}</td>
                <td>${r.check_in ? new Date(r.check_in).toLocaleString() : ''}</td>
                <td>${r.check_out ? new Date(r.check_out).toLocaleString() : ''}</td>
                <td>₱${parseFloat(r.finalTotal || 0).toLocaleString()}</td>
                <td>${r.status}</td>
                <td>${r.gcashReferenceNumber || ''}<br>${receiptCell}</td>
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
      tbody.innerHTML = '<tr><td colspan="10" class="text-center text-danger">Error loading reservations.</td></tr>';
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

// Expose for global use
window.renderUsersListDataTable = renderUsersListDataTable;
window.renderServicesListDataTable = renderServicesListDataTable;
}

// Expose globally
window.renderAdminReservations = renderAdminReservations;

/**
 * admin-system.js
 * Handles Admin and Manager Dashboard functionality.
 */

// --- User Management ---

async function renderUsersList() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;

  try {
    // Static role ID to name mapping
    const roleMap = {
      '6911d923e3fb923eed25f44d': 'admin',
      '6911d910e3fb923eed25f44c': 'manager',
      '6911d7b841d151b05bf687c7': 'customer'
    };

    const response = await fetch("http://localhost:3000/api/users", {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    const users = await response.json();
    if (Array.isArray(users)) {
      tbody.innerHTML = users.map(user => {
        // Compose full name
        const name = [user.first_name, user.middle_name, user.last_name].filter(Boolean).join(' ');
        // Status
        const status = user.isActive ? '<span class="badge bg-success">Active</span>' : '<span class="badge bg-secondary">Inactive</span>';
        // Role name
        const roleName = roleMap[user.role_id] || user.role_id || '';
        return `
          <tr>
            <td>${escapeHtml(user._id)}</td>
            <td>${escapeHtml(name)}</td>
            <td>${escapeHtml(user.email)}</td>
            <td>${escapeHtml(user.phone || '')}</td>
            <td>${escapeHtml(roleName)}</td>
            <td>${status}</td>
            <td>
              <button class="btn btn-sm btn-info" onclick="openEditAccountModal('${user._id}')">Edit</button>
              <button class="btn btn-sm btn-danger" onclick="deleteUser('${user._id}')">Delete</button>
            </td>
          </tr>
        `;
      }).join("");
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

// --- Service Management ---

async function fetchAllServicesAdmin() {
  try {
    const response = await fetch("http://localhost:3000/api/services", {
      headers: { "Authorization": `Bearer ${getAuthToken()}` }
    });
    return await response.json();
  } catch (error) {
    console.error("Admin service fetch error:", error);
    return { success: false, services: [] };
  }
}

async function renderServiceTable() {
  const tbody = document.getElementById("serviceTableBody");
  if (!tbody) return;

  const data = await fetchAllServicesAdmin();
  if (data.success) {
    tbody.innerHTML = data.services.map(service => {
      // Main image thumbnail
      const mainImg = service.image ? `<a href="${service.image}" target="_blank"><img src="${service.image}" style="max-width:60px;max-height:60px;object-fit:cover;" /></a>` : '';
      // Gallery thumbnails
      const gallery = Array.isArray(service.gallery) && service.gallery.length > 0
        ? service.gallery.map(img => `<a href="${img}" target="_blank"><img src="${img}" style="max-width:40px;max-height:40px;margin:2px;object-fit:cover;" /></a>`).join('')
        : '';
      // Inclusions
      const inclusions = Array.isArray(service.inclusions) ? service.inclusions.filter(Boolean).join(', ') : '';
      // Durations/Time slots
      let durations = '';
      if (Array.isArray(service.durations) && service.durations.length > 0) {
        durations = service.durations.map(d => `${escapeHtml(d.label)} (${d.hours || ''}h) ₱${d.price ? parseFloat(d.price).toLocaleString() : ''}`).join('<br>');
      } else if (Array.isArray(service.timeSlots) && service.timeSlots.length > 0) {
        durations = service.timeSlots.map(ts => `${escapeHtml(ts.label)} ₱${ts.price ? parseFloat(ts.price).toLocaleString() : ''}`).join('<br>');
      }
      return `
        <tr>
          <td>${escapeHtml(service.id || service._id)}</td>
          <td>${escapeHtml(service.name)}</td>
          <td>${escapeHtml(service.type)}</td>
          <td>${escapeHtml(service.category)}</td>
          <td>${service.max_guests || ''}</td>
          <td>${escapeHtml(service.description || '')}</td>
          <td>${mainImg}</td>
          <td>${gallery}</td>
          <td>${inclusions}</td>
          <td>${escapeHtml(service.notes || '')}</td>
          <td>${durations}</td>
          <td>${service.isActive ? 'Active' : 'Inactive'}</td>
          <td>
            <button class="btn btn-sm" onclick="editService('${service._id}')">Edit</button>
            <button class="btn btn-sm ${service.isActive ? 'btn-danger' : 'btn-success'}" 
                    onclick="${service.isActive ? 'deactivate' : 'activate'}ServiceAndRefresh('${service._id}')">
              ${service.isActive ? 'Deactivate' : 'Activate'}
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }
}


// --- Reservation Actions ---

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
  return localStorage.getItem('qreserve_token') || '';
}

window.deleteUser = deleteUser;
window.confirmReservation = confirmReservation;
window.cancelReservation = cancelReservation;
window.renderServiceTable = renderServiceTable;
window.escapeHtml = escapeHtml;
window.getAuthToken = getAuthToken;
