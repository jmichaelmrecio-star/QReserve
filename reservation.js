/**
 * reservation.js
 * Handles service display, selection, and the reservation form logic.
 */

// --- Service Data Helper ---
function getActiveServices() {
  // If ui-core.js is loaded, use resortServices global if not empty
  if (typeof resortServices !== "undefined" && resortServices.length > 0) {
    return resortServices;
  }
  return []; // Fallback
}

// --- Pricing Utilities ---

function calculatePriceByDuration(serviceId, durationId, guestCount = 1) {
  const services = getActiveServices();
  const service = services.find((s) => (s._id || s.id) === serviceId);
  if (!service) return null;

  if (service.timeSlots && service.timeSlots.length > 0) {
    const slot = service.timeSlots.find((ts) => ts.id === durationId);
    if (!slot) return null;
    return slot.price;
  }

  if (service.durations && service.durations.length > 0) {
    const duration = service.durations.find((d) => d.id === durationId);
    if (!duration) return null;
    return duration.price;
  }
  return service.price || 0;
}

function getStartingPrice(service) {
  if (!service) return 0;
  if (service.timeSlots && service.timeSlots.length > 0) {
    return Math.min(...service.timeSlots.map(s => s.price));
  }
  if (service.durations && service.durations.length > 0) {
    return Math.min(...service.durations.map(d => d.price));
  }
  return service.price || 0;
}

function getDurationLabel(serviceId, durationId) {
  const services = getActiveServices();
  const service = services.find((s) => (s._id || s.id) === serviceId);
  if (!service) return "";
  const options = [...(service.timeSlots || []), ...(service.durations || [])];
  const found = options.find(o => o.id === durationId);
  return found ? found.label : "";
}

// --- Service Display ---

function renderServiceCards(servicesOverride = null) {
  const container = document.getElementById("services-grid") || 
                    document.getElementById("service-cards-container") ||
                    document.getElementById("amenities-grid");
  if (!container) return;

  const services = servicesOverride || getActiveServices();
  if (services.length === 0) {
    container.innerHTML = "<p style='color: white;'>Loading services or no services available...</p>";
    return;
  }

  container.innerHTML = services.map(service => `
    <div class="service-card" onclick="showServiceModal('${service._id || service.id}')">
      <img src="${service.image || 'images/placeholder.jpg'}" alt="${service.name}">
      <div class="card-content">
        <h3>${escapeHtml(service.name)}</h3>
        <p class="price">Starts at ₱${getStartingPrice(service).toLocaleString()}</p>
        <p>Max Guests: ${service.max_guests || 'N/A'}</p>
        <button class="button-primary" style="margin-top: 10px; width: 100%;">Details</button>
      </div>
    </div>
  `).join("");
}

function showServiceModal(serviceId) {
  const services = getActiveServices();
  const service = services.find(s => (s._id || s.id) === serviceId);
  if (!service) return;

  const modal = document.getElementById("serviceModal");
  if (!modal) return;

  // Set basic info
  document.getElementById("modal-name").textContent = service.name;
  document.getElementById("modal-max-guests").textContent = service.max_guests || "N/A";
  document.getElementById("modal-description").textContent = service.description || "No description available.";

  // Populate duration/time slot select
  const select = document.getElementById("modal-duration-select");
  if (select) {
    select.innerHTML = '<option value="">-- Select --</option>';
    const options = [...(service.timeSlots || []), ...(service.durations || [])];
    options.forEach(opt => {
      const option = document.createElement("option");
      option.value = opt.id;
      option.textContent = `${opt.label} - ₱${opt.price.toLocaleString()}`;
      select.appendChild(option);
    });

    select.onchange = () => {
      const priceEl = document.getElementById("modal-price");
      const proceedBtn = document.getElementById("modal-proceed-button");
      if (select.value) {
        const price = calculatePriceByDuration(serviceId, select.value);
        if (priceEl) priceEl.textContent = `₱${price.toLocaleString()}`;
        if (proceedBtn) {
          proceedBtn.style.opacity = "1";
          proceedBtn.style.pointerEvents = "auto";
          proceedBtn.onclick = (e) => {
            e.preventDefault();
            selectServiceAndRedirect(serviceId, select.value);
          };
        }
      } else {
        if (priceEl) priceEl.textContent = "Select duration";
        if (proceedBtn) {
          proceedBtn.style.opacity = "0.5";
          proceedBtn.style.pointerEvents = "none";
        }
      }
    };
  }

  // Populate Inclusions
  const inclusionsContainer = document.getElementById("modal-inclusions");
  const inclusionsList = document.getElementById("modal-inclusions-list");
  if (inclusionsContainer && inclusionsList) {
    if (service.inclusions && service.inclusions.length > 0) {
      inclusionsList.innerHTML = service.inclusions.map(inc => `<li>${escapeHtml(inc)}</li>`).join("");
      inclusionsContainer.style.display = "block";
    } else {
      inclusionsContainer.style.display = "none";
    }
  }

  modal.style.display = "block";
}

// Patch: Remove sessionStorage redirect, use GET params for reservation
function selectServiceAndRedirect(serviceId, durationId) {
  const services = getActiveServices();
  const service = services.find(s => (s._id || s.id) === serviceId);
  if (!service) return;

  // Instead of sessionStorage, pass via GET params
  let price = calculatePriceByDuration(serviceId, durationId);
  const params = new URLSearchParams({
    serviceId: serviceId,
    serviceName: service.name,
    duration: durationId,
    price: price
  });
  window.location.href = "reserve.html?" + params.toString();
}

// --- Reservation Form Logic ---

let reservationSubmissionInProgress = false;

async function reserveNow(event) {
  event.preventDefault();
  if (reservationSubmissionInProgress) return;

  const user = getLoggedInUser();
  if (!user) {
    showAlert("Please log in to make a reservation.", "warning");
    return;
  }

  const formData = new FormData(event.target);
  const data = Object.fromEntries(formData.entries());
  
  // Attach selections from session
  data.serviceId = sessionStorage.getItem("selectedServiceId");
  data.serviceName = sessionStorage.getItem("selectedServiceName");
  data.serviceType = sessionStorage.getItem("selectedServiceType") || document.getElementById("serviceTypeInput")?.value || "";
  data.selectedDuration = sessionStorage.getItem("selectedDuration");
  data.basePrice = sessionStorage.getItem("selectedServicePrice");

  reservationSubmissionInProgress = true;
  const btn = event.target.querySelector('button[type="submit"]');
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  try {
    const response = await fetch("http://localhost:3000/api/reservations/create-reservation", {
      method: "POST",
      headers: { 
        "Content-Type": "application/json",
        "Authorization": `Bearer ${getAuthToken()}`
      },
      body: JSON.stringify(data)
    });

    const result = await response.json();
    if (response.ok) {
      sessionStorage.setItem("payment_reservation_id", result.reservationId);
      sessionStorage.setItem("payment_reservation_hash", result.reservationHash);
      window.location.href = "payment.html";
    } else {
      showAlert(result.message || "Reservation failed.", "error");
      reservationSubmissionInProgress = false;
      if (btn) {
        btn.disabled = false;
        btn.textContent = "Confirm Reservation";
      }
    }
  } catch (error) {
    console.error("Reservation error:", error);
    reservationSubmissionInProgress = false;
  }
}

// --- Filters ---

function filterServices() {
    const typeFilter = (document.getElementById('services-type-filter') || document.getElementById('amenity-type-filter'))?.value || 'all';
    const capacityFilter = parseInt((document.getElementById('services-capacity-filter') || document.getElementById('amenity-capacity-filter'))?.value || '0');
    
    let filtered = getActiveServices();
    
    if (typeFilter !== 'all') {
        filtered = filtered.filter(s => s.type?.toLowerCase() === typeFilter);
    }
    
    if (capacityFilter > 0) {
        if (capacityFilter === 20) {
            // "20 and above" - filter for services with max_guests >= 20
            filtered = filtered.filter(s => s.max_guests >= 20);
        } else {
            // "Up to X" - filter for services with max_guests <= capacity
            filtered = filtered.filter(s => s.max_guests <= capacityFilter);
        }
    }
    
    renderServiceCards(filtered);
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    // If on services-list or amenities page
    const gridContainer = document.getElementById("services-grid") || 
                          document.getElementById("service-cards-container") ||
                          document.getElementById("amenities-grid");
                          
    if (gridContainer) {
        renderServiceCards();
        // If services haven't loaded yet, try again in a bit
        setTimeout(renderServiceCards, 1000);

        // Attach filter listeners
        const typeEl = document.getElementById('services-type-filter') || document.getElementById('amenity-type-filter');
        const capEl = document.getElementById('services-capacity-filter') || document.getElementById('amenity-capacity-filter');
        
        typeEl?.addEventListener('change', filterServices);
        capEl?.addEventListener('change', filterServices);
    }

    // Modal Close Logic
    const closeBtn = document.querySelector(".close-button");
    const modal = document.getElementById("serviceModal");
    if (closeBtn && modal) {
        closeBtn.onclick = () => modal.style.display = "none";
        window.onclick = (event) => {
            if (event.target == modal) modal.style.display = "none";
        };
    }

    // If on reservation page
    const reserveForm = document.getElementById("reservationForm");
    if (reserveForm) {
        reserveForm.addEventListener("submit", reserveNow);
        if (typeof checkLoginStatusForReservation === "function") {
            checkLoginStatusForReservation();
        }
    }
});

// Expose globals
window.renderServiceCards = renderServiceCards;
window.showServiceModal = showServiceModal;
window.selectServiceAndRedirect = selectServiceAndRedirect;
window.reserveNow = reserveNow;
window.getDurationLabel = getDurationLabel;
