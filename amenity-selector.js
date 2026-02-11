/**
 * amenity-selector.js
 * Manages multiple amenity selection for multi-item bookings.
 * Stores selected amenities in sessionStorage as 'multipleAmenities' array.
 */

// Initialize selected amenities from sessionStorage or empty array
let multipleAmenities = JSON.parse(sessionStorage.getItem('multipleAmenities')) || [];

/**
 * Add an amenity to the selection
 * @param {Object} amenity - Amenity data { serviceId, assetNumber, serviceName, price, duration, durationId, inclusions, etc. }
 * @returns {boolean} - true if added, false if duplicate or error
 */
function addAmenity(amenity) {
    // Validate amenity object
    if (!amenity || !amenity.serviceId) {
        console.error('Invalid amenity:', amenity);
        return false;
    }

    // Check for duplicates (same serviceId + assetNumber)
    const isDuplicate = multipleAmenities.some(item =>
        item.serviceId === amenity.serviceId &&
        item.assetNumber === amenity.assetNumber
    );

    if (isDuplicate) {
        console.warn(`Amenity ${amenity.serviceName} (#${amenity.assetNumber}) is already selected`);
        return false;
    }

    // Add to array
    multipleAmenities.push(amenity);

    // Persist to sessionStorage
    sessionStorage.setItem('multipleAmenities', JSON.stringify(multipleAmenities));

    console.log('✅ Amenity added:', amenity.serviceName, '| Total selected:', multipleAmenities.length);
    return true;
}

/**
 * Remove an amenity from the selection by index
 * @param {number} index - Index in multipleAmenities array
 */
function removeAmenity(index) {
    if (index < 0 || index >= multipleAmenities.length) {
        console.error('Invalid index:', index);
        return;
    }

    const removed = multipleAmenities.splice(index, 1);
    console.log('🗑️  Amenity removed:', removed[0].serviceName);

    // Persist to sessionStorage
    sessionStorage.setItem('multipleAmenities', JSON.stringify(multipleAmenities));
    
    // Recalculate promo discount if applied
    const appliedPromo = JSON.parse(sessionStorage.getItem('appliedPromo') || 'null');
    if (appliedPromo && multipleAmenities.length > 0) {
        // Recalculate discount based on new total
        const newTotal = calculateTotalPrice();
        if (appliedPromo.discountType === 'percentage') {
            appliedPromo.discountAmount = (newTotal * appliedPromo.discountValue) / 100;
        } else if (appliedPromo.discountType === 'fixed') {
            appliedPromo.discountAmount = Math.min(appliedPromo.discountValue, newTotal);
        }
        sessionStorage.setItem('appliedPromo', JSON.stringify(appliedPromo));
    } else if (multipleAmenities.length === 0) {
        // Clear promo if no items left
        sessionStorage.removeItem('appliedPromo');
    }
}

/**
 * Clear all selected amenities
 */
function clearAllAmenities() {
    multipleAmenities = [];
    sessionStorage.setItem('multipleAmenities', JSON.stringify(multipleAmenities));
    
    // Clear applied promo since no items remain
    sessionStorage.removeItem('appliedPromo');
    const promoInput = document.getElementById('promo-code-input');
    const promoMessage = document.getElementById('promo-message');
    if (promoInput) promoInput.value = '';
    if (promoMessage) promoMessage.innerHTML = '';
    
    console.log('🧹 All amenities cleared');
}

/**
 * Get all selected amenities
 * @returns {Array} - Array of selected amenity objects
 */
function getSelectedAmenities() {
    return JSON.parse(JSON.stringify(multipleAmenities)); // Return deep copy
}

/**
 * Get count of selected amenities
 * @returns {number}
 */
function getAmenityCount() {
    return multipleAmenities.length;
}

/**
 * Calculate total price of all amenities
 * @returns {number} - Total price in pesos
 */
function calculateTotalPrice() {
    return multipleAmenities.reduce((sum, item) => sum + (parseFloat(item.price) || 0), 0);
}

/**
 * Check if a specific amenity is already selected
 * @param {string} serviceId
 * @param {number} assetNumber
 * @returns {boolean}
 */
function isAmenitySelected(serviceId, assetNumber) {
    return multipleAmenities.some(item =>
        item.serviceId === serviceId &&
        item.assetNumber === assetNumber
    );
}

/**
 * Update amenity with additional data (e.g., dates, guests - for future use)
 * @param {number} index
 * @param {Object} updates
 */
function updateAmenity(index, updates) {
    if (index < 0 || index >= multipleAmenities.length) {
        console.error('Invalid index:', index);
        return;
    }

    multipleAmenities[index] = { ...multipleAmenities[index], ...updates };
    sessionStorage.setItem('multipleAmenities', JSON.stringify(multipleAmenities));
    console.log('✏️  Amenity updated:', multipleAmenities[index].serviceName);
}

/**
 * Render selected items in the sidebar
 * @param {string} containerId - ID of container element to render into
 */
function renderSelectedItems(containerId = 'selected-items-list') {
    const container = document.getElementById(containerId);
    if (!container) {
        console.warn('Container not found:', containerId);
        return;
    }

    if (multipleAmenities.length === 0) {
        container.innerHTML = '<p style="color: #999; font-size: 0.9rem;">No items selected yet</p>';
        updateSidebarTotal();
        return;
    }

    let html = '';
    multipleAmenities.forEach((amenity, index) => {
        const itemName = `${amenity.serviceName}${amenity.assetNumber ? ' #' + amenity.assetNumber : ''}`;
        const durationLabel = amenity.durationLabel || amenity.selectedDuration || 'N/A';
        const price = parseFloat(amenity.price) || 0;
        
        // Format dates and time for display
        let datesDisplay = '';
        let timeDisplay = '';
        
        if (amenity.checkIn) {
            // Parse date correctly to avoid UTC timezone issues
            const checkInParts = amenity.checkIn.split('-');
            const checkInDate = new Date(parseInt(checkInParts[0]), parseInt(checkInParts[1]) - 1, parseInt(checkInParts[2]));
            const checkInFormatted = checkInDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            
            let checkoutInfo = '';
            if (amenity.checkOut) {
                const checkOutParts = amenity.checkOut.split('-');
                const checkOutDate = new Date(parseInt(checkOutParts[0]), parseInt(checkOutParts[1]) - 1, parseInt(checkOutParts[2]));
                const checkOutFormatted = checkOutDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                
                if (checkOutDate > checkInDate) {
                    // Different days
                    checkoutInfo = `${checkInFormatted} - ${checkOutFormatted}`;
                } else {
                    // Same day
                    checkoutInfo = checkInFormatted;
                }
                
                datesDisplay = `📅 ${checkoutInfo}`;
            } else {
                datesDisplay = `📅 ${checkInFormatted}`;
            }
            
            // Format check-in and check-out times
            let timeStr = '';
            if (amenity.checkInTime) {
                const checkinHour = parseInt(amenity.checkInTime);
                const ampm = checkinHour >= 12 ? 'PM' : 'AM';
                const displayHours = checkinHour % 12 || 12;
                timeStr = `${displayHours}:00 ${ampm}`;
            }
            
            if (amenity.checkOutTime && amenity.checkOutTime !== '--') {
                timeDisplay = ` • ${timeStr} → ${amenity.checkOutTime}`;
            } else if (timeStr) {
                timeDisplay = ` • ${timeStr}`;
            }
        }

        html += `
            <div style="
                background: white;
                border: 1px solid #e0e0e0;
                border-radius: 6px;
                padding: 12px;
                margin-bottom: 10px;
                display: flex;
                justify-content: space-between;
                align-items: start;
                gap: 10px;
            ">
                <div style="flex: 1;">
                    <p style="margin: 0 0 4px 0; font-weight: 600; color: #333;">${escapeHtml(itemName)}</p>
                    <p style="margin: 0 0 4px 0; font-size: 0.85rem; color: #666;">${escapeHtml(durationLabel)}</p>
                    ${amenity.guests ? `<p style="margin: 0 0 4px 0; font-size: 0.8rem; color: #555;">👥 ${amenity.guests} guest${amenity.guests > 1 ? 's' : ''}</p>` : ''}
                    ${datesDisplay ? `<p style="margin: 0 0 4px 0; font-size: 0.8rem; color: #0066cc;">${datesDisplay}${timeDisplay}</p>` : ''}
                    <p style="margin: 0; font-weight: 600; color: var(--primary-color);">₱${price.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2})}</p>
                </div>
                <button
                    type="button"
                    onclick="removeAmenityFromUI(${index})"
                    style="
                        background: #dc3545;
                        color: white;
                        border: none;
                        border-radius: 4px;
                        padding: 6px 12px;
                        cursor: pointer;
                        font-size: 0.85rem;
                        font-weight: 600;
                        white-space: nowrap;
                    "
                >
                    Remove
                </button>
            </div>
        `;
    });

    container.innerHTML = html;
    updateSidebarTotal();
}

/**
 * Update the total price display in sidebar
 */
function updateSidebarTotal() {
    const totalElement = document.getElementById('summary-subtotal');
    const originalPriceDisplay = document.getElementById('original-price-display');
    const originalPriceElement = document.getElementById('summary-original');
    const discountDisplay = document.getElementById('discount-display');
    const discountAmountElement = document.getElementById('discount-amount');
    
    const originalTotal = calculateTotalPrice();
    
    // Get applied promo (if any)
    const appliedPromo = JSON.parse(sessionStorage.getItem('appliedPromo') || 'null');
    
    if (appliedPromo && appliedPromo.discountAmount > 0) {
        // Show discounted price
        const discountedTotal = Math.max(0, originalTotal - appliedPromo.discountAmount);
        
        if (totalElement) {
            totalElement.textContent = '₱' + discountedTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        
        // Show original price (crossed out)
        if (originalPriceDisplay && originalPriceElement) {
            originalPriceElement.textContent = '₱' + originalTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            originalPriceDisplay.style.display = 'block';
        }
        
        // Show discount amount
        if (discountDisplay && discountAmountElement) {
            discountAmountElement.textContent = '₱' + appliedPromo.discountAmount.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
            discountDisplay.style.display = 'block';
        }
    } else {
        // No discount, show normal total
        if (totalElement) {
            totalElement.textContent = '₱' + originalTotal.toLocaleString('en-PH', {minimumFractionDigits: 2, maximumFractionDigits: 2});
        }
        
        // Hide discount displays
        if (originalPriceDisplay) originalPriceDisplay.style.display = 'none';
        if (discountDisplay) discountDisplay.style.display = 'none';
    }

    // Update proceed button state
    const proceedBtn = document.getElementById('sidebar-proceed-button');
    if (proceedBtn) {
        if (multipleAmenities.length > 0) {
            proceedBtn.classList.remove('disabled');
            proceedBtn.style.pointerEvents = 'auto';
            proceedBtn.style.opacity = '1';
        } else {
            proceedBtn.classList.add('disabled');
            proceedBtn.style.pointerEvents = 'none';
            proceedBtn.style.opacity = '0.5';
        }
    }
}

/**
 * Apply promo code
 */
async function applyPromoCode() {
    const promoInput = document.getElementById('promo-code-input');
    const promoMessage = document.getElementById('promo-message');
    const applyBtn = document.getElementById('apply-promo-btn');
    
    if (!promoInput || !promoMessage) return;
    
    const promoCode = promoInput.value.trim().toUpperCase();
    
    if (!promoCode) {
        promoMessage.innerHTML = '<span style="color: #dc3545;">Please enter a promo code</span>';
        return;
    }
    
    if (multipleAmenities.length === 0) {
        promoMessage.innerHTML = '<span style="color: #dc3545;">Add items before applying promo code</span>';
        return;
    }
    
    // Disable button while validating
    if (applyBtn) {
        applyBtn.disabled = true;
        applyBtn.textContent = 'Checking...';
    }
    
    promoMessage.innerHTML = '<span style="color: #666;">Validating...</span>';
    
    try {
        // Call backend API to validate promo code
        const response = await fetch(`/api/promocodes/validate/${promoCode}`);
        const data = await response.json();
        
        if (response.ok && data.valid) {
            // Calculate discount
            const originalTotal = calculateTotalPrice();
            let discountAmount = 0;
            
            if (data.promoCode.discountType === 'percentage') {
                discountAmount = (originalTotal * data.promoCode.discountValue) / 100;
            } else if (data.promoCode.discountType === 'fixed') {
                discountAmount = data.promoCode.discountValue;
            }
            
            // Cap discount at total (can't go negative)
            discountAmount = Math.min(discountAmount, originalTotal);
            
            // Store applied promo in sessionStorage
            const appliedPromo = {
                code: promoCode,
                discountType: data.promoCode.discountType,
                discountValue: data.promoCode.discountValue,
                discountAmount: discountAmount,
                description: data.promoCode.description || ''
            };
            sessionStorage.setItem('appliedPromo', JSON.stringify(appliedPromo));
            
            // Update UI
            promoMessage.innerHTML = `<span style="color: #28a745;">✓ ${data.promoCode.description || 'Promo applied!'}</span>`;
            updateSidebarTotal();
            
            // Show success toast
            if (typeof showToast === 'function') {
                showToast(`Promo code "${promoCode}" applied!`, 'success');
            }
            
        } else {
            // Invalid promo code
            const errorMsg = data.message || 'Invalid or expired promo code';
            promoMessage.innerHTML = `<span style="color: #dc3545;">✗ ${errorMsg}</span>`;
            
            // Clear any previously applied promo
            sessionStorage.removeItem('appliedPromo');
            updateSidebarTotal();
        }
    } catch (error) {
        console.error('Error validating promo code:', error);
        promoMessage.innerHTML = '<span style="color: #dc3545;">Error validating promo code</span>';
        
        // Clear any previously applied promo
        sessionStorage.removeItem('appliedPromo');
        updateSidebarTotal();
    } finally {
        // Re-enable button
        if (applyBtn) {
            applyBtn.disabled = false;
            applyBtn.textContent = 'Apply';
        }
    }
}

/**
 * Remove amenity and re-render (UI helper)
 */
function removeAmenityFromUI(index) {
    removeAmenity(index);
    renderSelectedItems();
}

/**
 * Clear all amenities and update UI
 */
function clearSelectedItems() {
    if (multipleAmenities.length === 0) {
        showToast('No items to clear', 'info');
        return;
    }

    showConfirm(
        'Clear All Items?',
        '<p>Are you sure you want to remove all selected items?</p>',
        () => {
            clearAllAmenities();
            renderSelectedItems();
            showToast('All items cleared', 'info');
        },
        () => { /* Cancel */ },
        {
            confirmText: 'Yes, Clear',
            cancelText: 'Cancel',
            type: 'warning'
        }
    );
}

/**
 * Proceed to reservation form with selected amenities
 */
function proceedToReservation() {
    if (multipleAmenities.length === 0) {
        showToast('Please select at least one amenity before proceeding', 'warning');
        return;
    }

    // Get applied promo (if any)
    const appliedPromo = JSON.parse(sessionStorage.getItem('appliedPromo') || 'null');
    
    // ✅ FIX: If only 1 amenity, redirect to single-amenity mode
    console.log('🔍 DEBUG proceedToReservation(): multipleAmenities.length =', multipleAmenities.length);
    if (multipleAmenities.length === 1) {
        const singleItem = multipleAmenities[0];
        
        // DEBUG: Log the entire single item to see what properties exist
        console.log('🔍 DEBUG: singleItem properties:', {
            serviceName: singleItem.serviceName,
            checkIn: singleItem.checkIn,
            checkInTime: singleItem.checkInTime,
            checkOut: singleItem.checkOut,
            checkOutTime: singleItem.checkOutTime,
            allKeys: Object.keys(singleItem)
        });
        
        // Store as single amenity reservation data
        sessionStorage.setItem('selectedServiceId', singleItem.serviceId);
        sessionStorage.setItem('selectedServiceName', singleItem.serviceName);
        sessionStorage.setItem('selectedServicePrice', singleItem.price);
        sessionStorage.setItem('selectedDuration', singleItem.selectedDuration || singleItem.durationLabel || '');
        sessionStorage.setItem('selectedDurationLabel', singleItem.durationLabel || singleItem.selectedDuration || '');
        sessionStorage.setItem('selectedAssetNumber', singleItem.assetNumber || '');
        
        // Store dates and times if provided
        if (singleItem.checkIn) sessionStorage.setItem('selectedCheckIn', singleItem.checkIn);
        if (singleItem.checkOut) sessionStorage.setItem('selectedCheckOut', singleItem.checkOut);
        if (singleItem.checkInTime) sessionStorage.setItem('selectedCheckInTime', String(singleItem.checkInTime));
        if (singleItem.checkOutTime) sessionStorage.setItem('selectedCheckOutTime', singleItem.checkOutTime);
        
        // DEBUG: Log what was stored in sessionStorage
        console.log('🔍 DEBUG: Stored in sessionStorage for single-amenity mode:', {
            selectedCheckIn: sessionStorage.getItem('selectedCheckIn'),
            selectedCheckInTime: sessionStorage.getItem('selectedCheckInTime'),
            selectedCheckOut: sessionStorage.getItem('selectedCheckOut'),
            selectedCheckOutTime: sessionStorage.getItem('selectedCheckOutTime')
        });
        
        // Store guests if provided
        if (singleItem.guests) sessionStorage.setItem('guests', singleItem.guests);
        
        // Store promo if applied
        if (appliedPromo) {
            sessionStorage.setItem('appliedPromoCode', appliedPromo.code);
            sessionStorage.setItem('appliedPromoDiscount', appliedPromo.discountAmount);
        }
        
        // Clear multi-amenity data
        sessionStorage.removeItem('multiAmenityReservation');
        sessionStorage.removeItem('multipleAmenities');
        
        console.log('✅ Redirecting to single-amenity mode:', singleItem.serviceName);
        window.location.href = 'reserve.html';
        return;
    }
    
    // Store promo data along with amenities for reserve.html
    const reservationData = {
        amenities: multipleAmenities,
        appliedPromo: appliedPromo,
        originalTotal: calculateTotalPrice(),
        finalTotal: appliedPromo ? Math.max(0, calculateTotalPrice() - appliedPromo.discountAmount) : calculateTotalPrice(),
        timestamp: new Date().toISOString()
    };
    
    // Store complete reservation data
    sessionStorage.setItem('multiAmenityReservation', JSON.stringify(reservationData));

    // Clear any old form data from previous sessions
    sessionStorage.removeItem('selectedServiceId');
    sessionStorage.removeItem('selectedServiceName');
    sessionStorage.removeItem('selectedServicePrice');
    sessionStorage.removeItem('selectedDuration');
    sessionStorage.removeItem('selectedDurationLabel');

    // Redirect to reserve.html with multipleAmenities in sessionStorage
    console.log('Proceeding to reservation with', multipleAmenities.length, 'amenities');
    if (appliedPromo) {
        console.log('Applied promo:', appliedPromo.code, '| Discount:', appliedPromo.discountAmount);
    }
    window.location.href = 'reserve.html?mode=multi-amenity';
}

/**
 * Initialize amenity selector on page load
 */
function initializeAmenitySelector() {
    // Reload multipleAmenities in case sessionStorage was updated elsewhere
    multipleAmenities = JSON.parse(sessionStorage.getItem('multipleAmenities')) || [];
    renderSelectedItems();
    
    // Restore promo code if applied
    const appliedPromo = JSON.parse(sessionStorage.getItem('appliedPromo') || 'null');
    if (appliedPromo) {
        const promoInput = document.getElementById('promo-code-input');
        const promoMessage = document.getElementById('promo-message');
        if (promoInput) promoInput.value = appliedPromo.code;
        if (promoMessage) {
            promoMessage.innerHTML = `<span style="color: #28a745;">✓ ${appliedPromo.description || 'Promo applied'}</span>`;
        }
    }
    
    console.log('Amenity selector initialized with', multipleAmenities.length, 'items');
}

// Escape HTML to prevent XSS
function escapeHtml(text) {
    if (!text) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
}

// Sync multipleAmenities with sessionStorage on page unload
window.addEventListener('beforeunload', () => {
    sessionStorage.setItem('multipleAmenities', JSON.stringify(multipleAmenities));
});

// Make functions globally available
window.addAmenity = addAmenity;
window.removeAmenity = removeAmenity;
window.clearAllAmenities = clearAllAmenities;
window.getSelectedAmenities = getSelectedAmenities;
window.getAmenityCount = getAmenityCount;
window.calculateTotalPrice = calculateTotalPrice;
window.isAmenitySelected = isAmenitySelected;
window.updateAmenity = updateAmenity;
window.renderSelectedItems = renderSelectedItems;
window.updateSidebarTotal = updateSidebarTotal;
window.removeAmenityFromUI = removeAmenityFromUI;
window.clearSelectedItems = clearSelectedItems;
window.proceedToReservation = proceedToReservation;
window.initializeAmenitySelector = initializeAmenitySelector;
window.applyPromoCode = applyPromoCode;
