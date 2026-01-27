// ========================================
// INCOMPLETE RESERVATION TRACKING SYSTEM
// ========================================

// Add animations for modal if not already defined
(function() {
    if (!document.getElementById('incomplete-modal-animations')) {
        const style = document.createElement('style');
        style.id = 'incomplete-modal-animations';
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
})();

/**
 * Saves the current reservation progress to localStorage
 * Called whenever user makes changes on services-list.html or reserve.html
 * @param {string} page - Current page ('services-list' or 'reserve')
 * @param {object} data - Reservation data to save
 */
function saveReservationProgress(page, data) {
    const userEmail = localStorage.getItem('qreserve_logged_user_email');
    
    // Only save if user is logged in
    if (!userEmail) {
        console.log('User not logged in, skipping save');
        return;
    }
    
    // Get existing incomplete reservations
    let incompleteReservations = JSON.parse(localStorage.getItem('qreserve_incomplete_reservations')) || [];
    
    // Use selected service as unique identifier (or generate one if needed)
    const uniqueId = data.selectedServiceId || data.selectedService || 'default_' + Date.now();
    
    // Check if we already have this reservation and update it, don't remove all
    const existingIndex = incompleteReservations.findIndex(r => r.email === userEmail && r.uniqueId === uniqueId);
    
    // Create new incomplete reservation object
    const newReservation = {
        email: userEmail,
        uniqueId: uniqueId,
        page: page,
        data: data,
        savedAt: new Date().toISOString(),
        timestamp: Date.now()
    };
    
    // Update existing or add new
    if (existingIndex !== -1) {
        incompleteReservations[existingIndex] = newReservation;
    } else {
        incompleteReservations.push(newReservation);
    }
    
    localStorage.setItem('qreserve_incomplete_reservations', JSON.stringify(incompleteReservations));
    
    console.log('Reservation progress saved:', newReservation);
}

/**
 * Retrieves all incomplete reservations for the current logged-in user
 * @returns {array} Array of incomplete reservation objects
 */
function getIncompleteReservations() {
    const userEmail = localStorage.getItem('qreserve_logged_user_email');
    
    if (!userEmail) {
        return [];
    }
    
    const allIncomplete = JSON.parse(localStorage.getItem('qreserve_incomplete_reservations')) || [];
    
    // Filter to only this user's incomplete reservations
    return allIncomplete.filter(r => r.email === userEmail);
}

/**
 * Clears a saved incomplete reservation for a specific user and service
 * Called after user completes reservation or chooses to start fresh
 * @param {string} email - User's email address
 * @param {string} uniqueId - Service ID to clear (optional, clears all if not provided)
 */
function clearIncompleteReservation(email, uniqueId = null) {
    let incompleteReservations = JSON.parse(localStorage.getItem('qreserve_incomplete_reservations')) || [];
    
    // Remove specific reservation for this email and uniqueId, or all if uniqueId not provided
    if (uniqueId) {
        incompleteReservations = incompleteReservations.filter(r => !(r.email === email && r.uniqueId === uniqueId));
    } else {
        incompleteReservations = incompleteReservations.filter(r => r.email !== email);
    }
    
    // If no reservations left, completely remove the key from localStorage
    if (incompleteReservations.length === 0) {
        localStorage.removeItem('qreserve_incomplete_reservations');
    } else {
        localStorage.setItem('qreserve_incomplete_reservations', JSON.stringify(incompleteReservations));
    }
    
    console.log('Incomplete reservation cleared for:', email, uniqueId);
}

/**
 * Resumes a previously saved reservation
 * Restores sessionStorage with saved data and redirects to appropriate page
 * @param {object} reservation - The incomplete reservation object to resume
 */
function resumeReservation(reservation) {
    // Restore session storage from saved data
    const data = reservation.data;
    
    // Restore session storage values
    if (data.selectedServiceId) sessionStorage.setItem('selectedServiceId', data.selectedServiceId);
    if (data.selectedServiceName) sessionStorage.setItem('selectedServiceName', data.selectedServiceName);
    if (data.selectedServicePrice) sessionStorage.setItem('selectedServicePrice', data.selectedServicePrice);
    if (data.selectedServiceMaxGuests) sessionStorage.setItem('selectedServiceMaxGuests', data.selectedServiceMaxGuests);
    if (data.selectedServiceType) sessionStorage.setItem('selectedServiceType', data.selectedServiceType);
    if (data.selectedDuration) sessionStorage.setItem('selectedDuration', data.selectedDuration);
    if (data.selectedDurationLabel) sessionStorage.setItem('selectedDurationLabel', data.selectedDurationLabel);
    if (data.serviceInclusions) sessionStorage.setItem('serviceInclusions', data.serviceInclusions);
    if (data.guests) sessionStorage.setItem('guests', data.guests);
    if (data.checkinDate) sessionStorage.setItem('checkinDate', data.checkinDate);
    if (data.checkoutDate) sessionStorage.setItem('checkoutDate', data.checkoutDate);
    if (data.customerName) sessionStorage.setItem('customerName', data.customerName);
    if (data.customerContact) sessionStorage.setItem('customerContact', data.customerContact);
    if (data.customerEmail) sessionStorage.setItem('customerEmail', data.customerEmail);
    if (data.customerAddress) sessionStorage.setItem('customerAddress', data.customerAddress);
    if (data.customerNotes) sessionStorage.setItem('customerNotes', data.customerNotes);
    if (data.finalTotal) sessionStorage.setItem('finalTotal', data.finalTotal);
    if (data.discountValue) sessionStorage.setItem('discountValue', data.discountValue);
    if (data.appliedPromoCode) sessionStorage.setItem('appliedPromoCode', data.appliedPromoCode);
    if (data.promoCode) sessionStorage.setItem('promoCode', data.promoCode);
    if (data.gcashReference) sessionStorage.setItem('gcashReference', data.gcashReference);
    
    // Clear the incomplete reservation from localStorage
    clearIncompleteReservation(reservation.email, reservation.uniqueId);
    
    // Redirect to the page where they left off
    if (reservation.page === 'services-list') {
        window.location.href = 'services-list.html';
    } else if (reservation.page === 'reserve') {
        window.location.href = 'reserve.html';
    } else if (reservation.page === 'payment') {
        // If resuming payment page, redirect with reservation ID from URL if available
        const currentUrl = window.location.href;
        if (currentUrl.includes('reservationId=')) {
            // Keep the same URL with parameters
            window.location.href = 'payment.html' + window.location.search;
        } else {
            window.location.href = 'payment.html';
        }
    }
}

// Global variable to store current reservation for modal
let currentReservationForModal = null;
let allIncompleteReservations = [];

/**
 * Detect current page name based on URL
 * @returns {string} - 'services-list', 'reserve', 'payment', or null
 */
function getCurrentPageName() {
    const currentUrl = window.location.pathname;
    
    if (currentUrl.includes('services-list.html')) {
        return 'services-list';
    } else if (currentUrl.includes('reserve.html')) {
        return 'reserve';
    } else if (currentUrl.includes('payment.html')) {
        return 'payment';
    }
    return null;
}

/**
 * Capture all relevant data from the current page
 * @param {string} pageName - Current page name
 * @returns {object} - All captured data
 */
function captureCurrentPageData(pageName) {
    const data = {};
    
    // Always capture service data from sessionStorage (available on all pages)
    data.selectedServiceId = sessionStorage.getItem('selectedServiceId') || '';
    data.selectedServiceName = sessionStorage.getItem('selectedServiceName') || '';
    data.selectedServicePrice = sessionStorage.getItem('selectedServicePrice') || '';
    data.selectedServiceMaxGuests = sessionStorage.getItem('selectedServiceMaxGuests') || '';
    data.selectedServiceType = sessionStorage.getItem('selectedServiceType') || '';
    data.selectedDuration = sessionStorage.getItem('selectedDuration') || '';
    data.selectedDurationLabel = sessionStorage.getItem('selectedDurationLabel') || '';
    data.serviceInclusions = sessionStorage.getItem('serviceInclusions') || '';
    
    // If on reserve page, capture form data
    if (pageName === 'reserve') {
        data.guests = document.getElementById('guests')?.value || '';
        data.checkinDate = document.getElementById('checkin')?.value || '';
        data.checkoutDate = document.getElementById('checkout')?.value || '';
        data.customerName = document.getElementById('name')?.value || '';
        data.customerContact = document.getElementById('contact')?.value || '';
        data.customerEmail = document.getElementById('email')?.value || '';
        data.customerAddress = document.getElementById('address')?.value || '';
        data.customerNotes = document.getElementById('notes')?.value || '';
        data.promoCode = document.getElementById('promo-code-input')?.value || '';
        data.finalTotal = document.getElementById('finalTotalInput')?.value || sessionStorage.getItem('finalTotal') || '';
        data.discountValue = document.getElementById('discountValueInput')?.value || sessionStorage.getItem('discountValue') || '';
        data.appliedPromoCode = sessionStorage.getItem('appliedPromoCode') || document.getElementById('promoCodeInput')?.value || '';
        data.termsAccepted = document.getElementById('termsCheckbox')?.checked || false;
    }
    
    // If on payment page, capture payment data
    if (pageName === 'payment') {
        data.gcashReference = document.getElementById('gcashReferenceNumber')?.value || '';
        data.finalTotal = document.getElementById('paymentAmount')?.textContent || '';
        data.paymentPage = true;
    }
    
    return data;
}

/**
 * Shows modal popup with incomplete reservations
 * User can choose to resume or start fresh
 */
function showResumeReservationModal() {
    // NOTE: Do NOT auto-save current page state when showing modal
    // If user navigated to home page to click Resume, we don't want to overwrite
    // the previous incomplete state (e.g., payment.html) with home page data
    // Only the actual reservation pages (services-list, reserve, payment) should auto-save
    
    // Small delay to ensure any pending saves complete
    setTimeout(() => {
        const incompleteReservations = getIncompleteReservations();
        
        // Show message if no incomplete reservations, but still allow modal to show
        if (incompleteReservations.length === 0) {
            showToast('No incomplete reservations found. You can start a new reservation!', 'info');
            return;
        }
        
        // Store all reservations for reference
        allIncompleteReservations = incompleteReservations;
    
    // Build list of all incomplete reservations
    let reservationsHTML = '';
    incompleteReservations.forEach((reservation, index) => {
        const savedDate = new Date(reservation.savedAt);
        const formattedDate = savedDate.toLocaleDateString() + ' ' + savedDate.toLocaleTimeString();
        const pageLabel = reservation.page === 'services-list' ? 'Services Selection' : 
                         reservation.page === 'reserve' ? 'Reservation Form' : 'Payment Page';
        
        reservationsHTML += `
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 6px; margin: 10px 0; border: 2px solid #e0e0e0;">
                <p style="margin: 5px 0;"><strong>Service:</strong> ${reservation.data.selectedServiceName || 'Not specified'}</p>
                <p style="margin: 5px 0;"><strong>Saved on:</strong> ${formattedDate}</p>
                <p style="margin: 5px 0; font-size: 0.85rem; color: #666;">Current Page: ${pageLabel}</p>
                ${reservation.data.customerName ? `<p style="margin: 5px 0; font-size: 0.85rem; color: #666;">Customer: ${reservation.data.customerName}</p>` : ''}
                <button onclick="resumeSpecificReservation(${index})" 
                        style="width: 100%; padding: 10px; margin-top: 10px; background-color: #28a745; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
                    Resume This Reservation
                </button>
            </div>
        `;
    });
    
    // Create modal HTML dynamically
    const modalHTML = `
        <div id="resumeReservationModal" style="display: flex; position: fixed; z-index: 9999; left: 0; top: 0; width: 100%; height: 100%; background-color: rgba(0, 0, 0, 0.5); animation: fadeIn 0.3s ease-in; align-items: center; justify-content: center; font-family: Arial, sans-serif;">
            <div style="background-color: #ffffff; margin: 5% auto; padding: 30px; border-radius: 12px; width: 90%; max-width: 900px; max-height: 90vh; overflow-y: auto; box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15); animation: slideDown 0.3s ease-out; border-top: 5px solid #28a745;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 20px;">
                    <h2 style="margin: 0; color: #333; font-size: 1.5rem;">Resume Your Reservation?</h2>
                    <span onclick="closeResumeModal()" style="cursor: pointer; color: #999; font-size: 28px; font-weight: bold; line-height: 1; padding: 0; margin: 0;">&times;</span>
                </div>
                <p style="color: #666; margin: 0 0 20px 0; font-size: 1rem;">You have ${incompleteReservations.length} incomplete reservation(s). Select one to continue:</p>
                
                <div style="margin: 20px 0;">
                    ${reservationsHTML}
                </div>
                
                <div style="margin-top: 20px; border-top: 1px solid #ddd; padding-top: 15px;">
                    <button onclick="clearAllIncompleteReservations()" 
                            style="width: 100%; padding: 12px; background-color: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; font-size: 1rem; font-weight: bold; transition: background-color 0.3s;">
                        Clear All & Start Fresh
                    </button>
                </div>
                <p style="text-align: center; font-size: 0.85rem; color: #999; margin-top: 15px; margin-bottom: 0;">
                    Or click the X to close this dialog.
                </p>
            </div>
        </div>
    `;
    
    // Add modal to page if not already present
    if (!document.getElementById('resumeReservationModal')) {
        document.body.insertAdjacentHTML('beforeend', modalHTML);
    } else {
        document.getElementById('resumeReservationModal').outerHTML = modalHTML;
    }
    }, 100); // Small delay to ensure save completes
}

/**
 * Resume a specific reservation from the list
 * @param {number} index - Index of the reservation in the array
 */
function resumeSpecificReservation(index) {
    if (allIncompleteReservations[index]) {
        // Mark that we're resuming (to prevent duplicate submission)
        sessionStorage.setItem('resuming_reservation', 'true');
        resumeReservation(allIncompleteReservations[index]);
    }
}

/**
 * Clear all incomplete reservations for the current user
 * Also clears all session storage data related to reservations
 */
function clearAllIncompleteReservations() {
    const userEmail = localStorage.getItem('qreserve_logged_user_email');
    if (userEmail) {
        // Clear localStorage incomplete reservations
        clearIncompleteReservation(userEmail);
        
        // Also clear all auto-saved sessionStorage data
        const sessionStorageKeysToRemove = [
            'selectedServiceId',
            'selectedServiceName',
            'selectedServicePrice',
            'selectedServiceMaxGuests',
            'selectedServiceType',
            'selectedDuration',
            'selectedDurationLabel',
            'serviceInclusions',
            'guests',
            'checkinDate',
            'checkoutDate',
            'customerName',
            'customerContact',
            'customerEmail',
            'customerAddress',
            'customerNotes',
            'finalTotal',
            'discountValue',
            'appliedPromoCode',
            'promoCode',
            'gcashReference',
            'resuming_reservation'
        ];
        
        sessionStorageKeysToRemove.forEach(key => {
            sessionStorage.removeItem(key);
        });
        
        showToast('All incomplete reservations cleared. You can start fresh!', 'info');
        closeResumeModal();
        // Re-render navigation to remove resume button
        if (typeof renderNavigation === 'function') {
            renderNavigation();
        }
    }
}

/**
 * Closes the resume reservation modal
 */
function closeResumeModal() {
    const modal = document.getElementById('resumeReservationModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

/**
 * Adds "Resume Reservation" button to navigation
 * NOW ALWAYS SHOWN - with visual indicator if incomplete reservations exist
 * Called by renderNavigation()
 */
function addResumeReservationNav() {
    const incompleteReservations = getIncompleteReservations();
    const userEmail = localStorage.getItem('qreserve_logged_user_email');
    
    // Only show if user is logged in AND has incomplete reservations
    if (!userEmail || incompleteReservations.length === 0) {
        return;
    }
    
    // Check if button already exists
    const existingBtn = document.getElementById('resume-reservation-nav-btn');
    if (existingBtn) {
        // Update existing button - no need to check again since we already filtered above
        existingBtn.innerHTML = `
            <a href="#" onclick="showResumeReservationModal(); return false;" style="color: #28a745; font-weight: bold;">
                ↺ Resume <span style="color: #dc3545; font-weight: bold;">(!)</span>
            </a>
        `;
        return;
    }
    
    // Add button to navigation
    const navUl = document.querySelector('nav ul');
    if (!navUl) return;
    
    const resumeLi = document.createElement('li');
    resumeLi.id = 'resume-reservation-nav-btn';
    resumeLi.classList.add('nav-action'); // Add nav-action class for proper layout alignment
    
    resumeLi.innerHTML = `
        <a href="#" onclick="showResumeReservationModal(); return false;" style="color: #28a745; font-weight: bold;">
            ↺ Resume <span style="color: #dc3545; font-weight: bold;">(!)</span>
        </a>
    `;
    
    // Insert AFTER Amenities button (2nd in action zone, right after Amenities)
    const reserveBtn = document.getElementById('nav-reserve-now-li');
    const profileDropdown = navUl.querySelector('.profile-dropdown');
    
    if (reserveBtn && reserveBtn.nextElementSibling) {
        // Insert after Amenities, before whatever comes next
        navUl.insertBefore(resumeLi, reserveBtn.nextElementSibling);
    } else if (profileDropdown) {
        // Fallback: insert before profile dropdown
        navUl.insertBefore(resumeLi, profileDropdown);
    } else {
        // Last resort: append to end
        navUl.appendChild(resumeLi);
    }
}

// Make functions globally accessible
window.saveReservationProgress = saveReservationProgress;
window.getIncompleteReservations = getIncompleteReservations;
window.clearIncompleteReservation = clearIncompleteReservation;
window.resumeReservation = resumeReservation;
window.resumeSpecificReservation = resumeSpecificReservation;
window.clearAllIncompleteReservations = clearAllIncompleteReservations;
window.showResumeReservationModal = showResumeReservationModal;
window.closeResumeModal = closeResumeModal;
window.addResumeReservationNav = addResumeReservationNav;
