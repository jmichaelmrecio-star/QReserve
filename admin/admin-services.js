// ===== DEBUG LOGGING (FOR TROUBLESHOOTING) =====
function logServiceDebug(message, data = null) {
    console.log(`🔧 [ADMIN-SERVICES] ${message}`, data || '');
}

// ===== GET AUTH TOKEN (SYNCED WITH PAYMENT VERIFICATIONS) =====
function getAuthToken() {
    const token = sessionStorage.getItem('authToken') || localStorage.getItem('authToken');
    if (!token) {
        logServiceDebug('⚠️ No auth token found in storage');
    }
    return token;
}

// ===== SHOW NOTIFICATION (REUSABLE) =====
function showNotification(message, type = 'info') {
    console.log(`📢 [${type.toUpperCase()}] ${message}`);
    // If you have a toast/notification system, integrate it here
    if (typeof showToast === 'function') {
        showToast(message, type);
    }
}

// ===== DURATION MANAGEMENT (SYNCED WITH RESERVATION FLOW) =====
function addDurationRow() {
    const container = document.getElementById('durationsContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'input-group mb-2 duration-row';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.innerHTML = `
        <input type="text" class="form-control duration-id" placeholder="ID (e.g., daytour)" required>
        <input type="text" class="form-control duration-label" placeholder="Label (e.g., Day Tour)" required>
        <input type="number" class="form-control duration-hours" placeholder="Hours" min="1" required>
        <input type="number" class="form-control duration-price" placeholder="Price" min="0" step="0.01" required>
        <button type="button" class="btn btn-danger remove-duration-btn">Remove</button>
    `;
    row.querySelector('.remove-duration-btn').onclick = function() {
        row.remove();
    };
    container.appendChild(row);
    logServiceDebug('Duration row added to create form');
}

function addEditDurationRow(id = '', label = '', hours = '', price = '') {
    const container = document.getElementById('editDurationsContainer');
    if (!container) {
        logServiceDebug('❌ Edit durations container not found');
        return;
    }
    const row = document.createElement('div');
    row.className = 'edit-duration-row mb-2';
    row.style.display = 'flex';
    row.style.gap = '8px';
    row.style.alignItems = 'center';
    row.innerHTML = `
        <input type="text" class="form-control form-control-sm duration-id" placeholder="ID" value="${id}" style="flex:1;" required>
        <input type="text" class="form-control form-control-sm duration-label" placeholder="Label" value="${label}" style="flex:2;" required>
        <input type="number" class="form-control form-control-sm duration-hours" placeholder="Hours" value="${hours}" style="flex:1;" min="1" required>
        <input type="number" class="form-control form-control-sm duration-price" placeholder="Price" value="${price}" style="flex:1;" min="0" step="0.01" required>
        <button type="button" class="btn btn-sm btn-outline-danger remove-duration-btn">Remove</button>
    `;
    row.querySelector('.remove-duration-btn').onclick = function() {
        row.remove();
    };
    container.appendChild(row);
    logServiceDebug('Duration row added to edit form', { id, label, hours, price });
}

// ===== VALIDATION HELPERS =====
function validateDurations(durations) {
    if (!Array.isArray(durations) || durations.length === 0) {
        return { valid: false, message: 'At least one duration is required' };
    }
    
    for (let duration of durations) {
        if (!duration.id || !duration.label || !duration.hours || duration.price === undefined) {
            return { valid: false, message: 'All duration fields (ID, Label, Hours, Price) are required' };
        }
        if (duration.hours < 1) {
            return { valid: false, message: 'Duration hours must be at least 1' };
        }
        if (duration.price < 0) {
            return { valid: false, message: 'Price cannot be negative' };
        }
    }
    
    return { valid: true };
}

function validateServiceForm(name, maxGuests, description) {
    if (!name || !name.trim()) {
        return { valid: false, message: 'Service name is required' };
    }
    if (!maxGuests || maxGuests < 1) {
        return { valid: false, message: 'Max guests must be at least 1' };
    }
    if (!description || !description.trim()) {
        return { valid: false, message: 'Description is required' };
    }
    return { valid: true };
}

// ===== SERVICE ACTIVATION/DEACTIVATION (HIGH PRIORITY) =====
async function toggleServiceStatus(serviceId, currentStatus) {
    const newStatus = !currentStatus;
    logServiceDebug(`Toggling service ${serviceId} from ${currentStatus} to ${newStatus}`);
    
    try {
        const response = await fetch(`http://localhost:3000/api/services/${serviceId}/toggle-status`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ isActive: newStatus })
        });
        
        if (!response.ok) {
            throw new Error(`Failed to toggle service status: ${response.statusText}`);
        }
        
        const result = await response.json();
        logServiceDebug(`Service ${serviceId} status updated to ${newStatus}`, result);
        
        // Refresh table
        if (typeof fetchAllServicesAdmin === 'function') {
            await fetchAllServicesAdmin();
            if (typeof renderServiceTable === 'function') {
                renderServiceTable();
            }
        }
        
        showNotification(`Service ${newStatus ? 'activated' : 'deactivated'} successfully!`, 'success');
    } catch (err) {
        logServiceDebug(`Error toggling service status: ${err.message}`, err);
        showNotification(`Error: ${err.message}`, 'error');
    }
}

// ===== INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    logServiceDebug('Admin Services Management initialized');
    
    const addDurationBtn = document.getElementById('addDurationBtn');
    if (addDurationBtn) {
        addDurationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            addDurationRow();
        });
        logServiceDebug('Add Duration button listener attached');
    }
    
    // File input listeners for UX
    const serviceImageInput = document.getElementById('serviceImageInput');
    if (serviceImageInput) {
        serviceImageInput.addEventListener('change', function(e) {
            const fileName = e.target.files[0]?.name || 'None';
            const nameDisplay = document.getElementById('serviceImageName');
            if (nameDisplay) nameDisplay.textContent = fileName;
            logServiceDebug(`Service image selected: ${fileName}`);
        });
    }
    
    const serviceGalleryInput = document.getElementById('serviceGalleryInput');
    if (serviceGalleryInput) {
        serviceGalleryInput.addEventListener('change', function(e) {
            const count = e.target.files.length;
            const countDisplay = document.getElementById('serviceGalleryCount');
            if (countDisplay) countDisplay.textContent = count;
            logServiceDebug(`${count} gallery image(s) selected`);
        });
    }
});

// ===== EXPOSE FUNCTIONS GLOBALLY =====
window.toggleServiceStatus = toggleServiceStatus;
window.addDurationRow = addDurationRow;
window.addEditDurationRow = addEditDurationRow;
window.validateDurations = validateDurations;
window.validateServiceForm = validateServiceForm;
window.logServiceDebug = logServiceDebug;
