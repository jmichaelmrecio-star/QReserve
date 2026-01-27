/**
 * unsaved-changes-modal.js
 * Handles detection of unsaved form changes and displays a modal forcing user to
 * either continue editing or cancel (which clears the data).
 * 
 * Integrates with cart-system.js to preserve data when items are added to cart.
 */

// Track whether form has been modified since page load or last cart add
let formHasUnsavedChanges = false;
let lastAddedToCartTime = 0;
let isResumingReservation = false;

// Define which form inputs to track for changes
const RESERVATION_FORM_FIELDS = [
    'duration-selector',
    'guests',
    'checkin',
    'checkout',
    'contact',
    'address',
    'notes',
    'promoCodeInput'
];

// Define which sessionStorage keys contain reservation data
const RESERVATION_SESSION_KEYS = [
    'selectedServiceId',
    'selectedServiceName',
    'selectedServicePrice',
    'selectedServiceMaxGuests',
    'selectedServiceType',
    'selectedDuration',
    'selectedDurationLabel',
    'serviceInclusions'
];

/**
 * Initialize unsaved changes tracking on a reservation form
 * Called when page loads (reserve.html, payment.html)
 * 
 * @param {string} formId - ID of the form to track (e.g., 'reservationForm')
 */
function initializeUnsavedChangesTracking(formId) {
    const form = document.getElementById(formId);
    if (!form) {
        console.warn(`Form with ID "${formId}" not found`);
        return;
    }

    // Check if user is resuming from cart or previous session
    isResumingReservation = sessionStorage.getItem('resuming_reservation') === 'true';
    lastAddedToCartTime = parseInt(sessionStorage.getItem('last_added_to_cart_time') || '0');

    // Reset the flag once we've checked it
    sessionStorage.removeItem('resuming_reservation');

    // Track changes on all form inputs
    RESERVATION_FORM_FIELDS.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.addEventListener('change', () => {
                markFormAsModified();
            });
            field.addEventListener('input', () => {
                markFormAsModified();
            });
        }
    });
    // NOTE: Do NOT attach click handler to addToCartBtn here
    // reserve.html already handles the button click and calls addToCartHandler()
    // We only need to track form changes, not intercept the button
}

/**
 * Mark the form as having unsaved changes
 */
function markFormAsModified() {
    formHasUnsavedChanges = true;
}

/**
 * Check if form has unsaved changes
 * Returns true only if form was modified AND user hasn't just added to cart
 * 
 * @returns {boolean} - True if there are unsaved changes
 */
function hasUnsavedChanges() {
    // If data was recently added to cart, don't consider it unsaved
    const timeSinceLastCart = Date.now() - lastAddedToCartTime;
    if (timeSinceLastCart < 2000) { // 2 second grace period
        return false;
    }

    return formHasUnsavedChanges;
}

/**
 * Get all current form data from the reservation form
 * 
 * @returns {object} - Object containing all form field values
 */
function getCurrentFormData() {
    const data = {};
    
    // Get form input values
    RESERVATION_FORM_FIELDS.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            data[fieldId] = field.value || '';
        }
    });

    // Also capture sessionStorage reservation data
    RESERVATION_SESSION_KEYS.forEach(key => {
        data[key] = sessionStorage.getItem(key) || '';
    });

    return data;
}

/**
 * Clear all form data and session storage for this reservation
 * Used when user clicks "Cancel" in the unsaved changes modal
 */
function clearReservationData() {
    // Clear form inputs
    RESERVATION_FORM_FIELDS.forEach(fieldId => {
        const field = document.getElementById(fieldId);
        if (field) {
            field.value = '';
        }
    });

    // Clear sessionStorage keys
    RESERVATION_SESSION_KEYS.forEach(key => {
        sessionStorage.removeItem(key);
    });

    // Reset tracking flags
    formHasUnsavedChanges = false;
    lastAddedToCartTime = 0;

    console.log('Reservation data cleared');
}

/**
 * Show modal asking user to continue or cancel
 * Called when user tries to navigate away with unsaved changes
 * 
 * @param {function} onContinue - Callback when user clicks "Continue"
 * @param {function} onCancel - Callback when user clicks "Cancel"
 */
function showUnsavedChangesModal(onContinue, onCancel) {
    // Add animations styles if not already present
    if (!document.getElementById('unsaved-changes-animations')) {
        const style = document.createElement('style');
        style.id = 'unsaved-changes-animations';
        style.textContent = `
            @keyframes fadeIn {
                from { opacity: 0; }
                to { opacity: 1; }
            }
            @keyframes slideDown {
                from { 
                    transform: translateY(-50px);
                    opacity: 0;
                }
                to { 
                    transform: translateY(0);
                    opacity: 1;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // Create modal HTML
    const modalHTML = `
        <div id="unsavedChangesModal" style="display: flex; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); animation: fadeIn 0.3s ease-in; align-items: center; justify-content: center; font-family: Arial, sans-serif;">
            <div style="background-color: #ffffff; margin: 5% auto; padding: 30px; border-radius: 12px; width: 90%; max-width: 500px; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); animation: slideDown 0.3s ease-out; border-top: 5px solid #ffc107;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333; font-size: 1.3rem;">⚠️ Unsaved Changes</h2>
                    <span onclick="closeUnsavedChangesModal()" style="cursor: pointer; color: #999; font-size: 28px; font-weight: bold; line-height: 1; padding: 0; margin: 0;">&times;</span>
                </div>
                <p style="color: #666; margin: 0 0 20px 0; font-size: 1rem;">You have unsaved changes in your reservation form. What would you like to do?</p>
                
                <div style="margin: 25px 0; padding: 15px; background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                    <p style="margin: 0; color: #856404; font-size: 0.9rem;">
                        <strong>Continue:</strong> Keep your current data and go back to the form.
                    </p>
                </div>

                <div style="margin: 25px 0; padding: 15px; background-color: #f8d7da; border-radius: 8px; border-left: 4px solid #dc3545;">
                    <p style="margin: 0; color: #721c24; font-size: 0.9rem;">
                        <strong>Cancel:</strong> Clear all your data and navigate away.
                    </p>
                </div>

                <div style="display: flex; gap: 10px; margin-top: 30px;">
                    <button onclick="handleUnsavedContinue()" 
                            style="flex: 1; padding: 12px; background-color: #ffc107; color: #333; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; font-weight: bold; transition: background-color 0.3s;">
                        ← Continue Editing
                    </button>
                    <button onclick="handleUnsavedCancel()" 
                            style="flex: 1; padding: 12px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; font-weight: bold; transition: background-color 0.3s;">
                        ✓ Clear & Leave
                    </button>
                </div>
            </div>
        </div>
    `;

    // Remove existing modal if present
    const existingModal = document.getElementById('unsavedChangesModal');
    if (existingModal) {
        existingModal.remove();
    }

    // Add modal to DOM
    document.body.insertAdjacentHTML('beforeend', modalHTML);

    // Store callbacks globally for button handlers
    window._unsavedContinueCallback = onContinue;
    window._unsavedCancelCallback = onCancel;
}

/**
 * Handle "Continue" button click
 */
function handleUnsavedContinue() {
    closeUnsavedChangesModal();
    if (window._unsavedContinueCallback) {
        window._unsavedContinueCallback();
    }
}

/**
 * Handle "Cancel" button click
 */
function handleUnsavedCancel() {
    closeUnsavedChangesModal();
    clearReservationData();
    if (window._unsavedCancelCallback) {
        window._unsavedCancelCallback();
    }
}

/**
 * Close the unsaved changes modal
 */
function closeUnsavedChangesModal() {
    const modal = document.getElementById('unsavedChangesModal');
    if (modal) {
        modal.remove();
    }
}

/**
 * Attach listeners to detect navigation attempts (back button, link clicks, etc.)
 * Should be called after form initialization
 */
function attachNavigationListeners() {
    // 1. Handle browser back button and history changes
    window.addEventListener('beforeunload', (e) => {
        if (hasUnsavedChanges()) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });

    // 2. Handle link clicks to navigate away
    document.addEventListener('click', (e) => {
        const target = e.target.closest('a');
        if (!target) return;

        // Don't intercept if it's a modal trigger or same-page link
        if (target.href === '#' || target.getAttribute('onclick')) return;

        // Check if navigation would leave the page
        const targetUrl = new URL(target.href, window.location.origin);
        const currentUrl = new URL(window.location.href);

        if (targetUrl.pathname !== currentUrl.pathname) {
            if (hasUnsavedChanges()) {
                e.preventDefault();
                e.stopPropagation();

                showUnsavedChangesModal(
                    () => {
                        // Continue: do nothing, user stays on page
                    },
                    () => {
                        // Cancel: navigate to the link
                        window.location.href = target.href;
                    }
                );
            }
        }
    });

    // 3. Handle form submission (if not the standard form submit)
    // This allows other submit handlers to work while protecting unsaved changes
    window.addEventListener('popstate', (e) => {
        if (hasUnsavedChanges()) {
            e.preventDefault();
            showUnsavedChangesModal(
                () => {
                    // Continue: do nothing, user stays on page
                },
                () => {
                    // Cancel: proceed with the popstate
                    window.history.forward();
                }
            );
        }
    });
}

/**
 * Special handler for "Add to Cart" button
 * Integrates with cart-system.js addToCart function
 * This function should be called before the actual addToCart logic
 */
function prepareAddToCartData() {
    // Save the current timestamp so we know when data was added to cart
    lastAddedToCartTime = Date.now();
    sessionStorage.setItem('last_added_to_cart_time', lastAddedToCartTime.toString());
    
    // Reset unsaved changes flag
    formHasUnsavedChanges = false;
    
    // Keep all sessionStorage data intact so it persists in the cart
    console.log('Form data saved to cart, ready for editing or navigation');
}

// Expose functions globally
window.initializeUnsavedChangesTracking = initializeUnsavedChangesTracking;
window.hasUnsavedChanges = hasUnsavedChanges;
window.getCurrentFormData = getCurrentFormData;
window.clearReservationData = clearReservationData;
window.showUnsavedChangesModal = showUnsavedChangesModal;
window.handleUnsavedContinue = handleUnsavedContinue;
window.handleUnsavedCancel = handleUnsavedCancel;
window.closeUnsavedChangesModal = closeUnsavedChangesModal;
window.attachNavigationListeners = attachNavigationListeners;
window.prepareAddToCartData = prepareAddToCartData;
