/**
 * Payment Reminder Modal
 * Displays a reminder when user tries to leave the payment page without submitting
 */

function initializePaymentReminderModal() {
    const modal = document.getElementById('paymentReminderModal');
    const continueBtn = document.getElementById('confirmContinueLater');
    const cancelBtn = document.getElementById('cancelPaymentLeave');
    const continueLink = document.getElementById('continuePaymentLaterBtn');

    if (!modal) {
        console.warn('Payment reminder modal not found in DOM');
        return;
    }

    // Handle "Continue Later" button click
    if (continueLink) {
        continueLink.addEventListener('click', function(e) {
            e.preventDefault();
            showPaymentReminderModal();
        });
    }

    // Confirm continue later
    if (continueBtn) {
        continueBtn.addEventListener('click', function() {
            hidePaymentReminderModal();
            // Navigate to my-reservations
            window.location.href = 'my-reservations.html';
        });
    }

    // Cancel leaving
    if (cancelBtn) {
        cancelBtn.addEventListener('click', function() {
            hidePaymentReminderModal();
        });
    }

    // Handle page navigation attempts
    window.addEventListener('beforeunload', function(e) {
        const refNum = document.getElementById('gcashReferenceNumber');
        const hasReceipt = window.gcashReceiptFile || window.gcashReceiptBase64;
        
        // Only show warning if user has started filling out the form
        if ((refNum && refNum.value.trim()) || hasReceipt) {
            e.preventDefault();
            e.returnValue = '';
            return '';
        }
    });

    // Intercept navigation links (only for internal navigation)
    document.addEventListener('click', function(e) {
        const target = e.target.closest('a[href]');
        if (!target) return;

        const href = target.getAttribute('href');
        
        // Check if it's an internal link (not the continue later button)
        if (href && !href.startsWith('http') && !href.startsWith('mailto') && !href.startsWith('#') && target.id !== 'continuePaymentLaterBtn') {
            const refNum = document.getElementById('gcashReferenceNumber');
            const hasReceipt = window.gcashReceiptFile || window.gcashReceiptBase64;
            
            // If user has started filling out the form, show reminder
            if ((refNum && refNum.value.trim()) || hasReceipt) {
                e.preventDefault();
                
                // Store the intended destination
                window.paymentPageNavTarget = href;
                showPaymentReminderModal();
            }
        }
    });
}

function showPaymentReminderModal() {
    const modal = document.getElementById('paymentReminderModal');
    if (modal) {
        modal.style.display = 'flex';
        document.body.style.overflow = 'hidden';
    }
}

function hidePaymentReminderModal() {
    const modal = document.getElementById('paymentReminderModal');
    if (modal) {
        modal.style.display = 'none';
        document.body.style.overflow = 'auto';
    }
}

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', initializePaymentReminderModal);
