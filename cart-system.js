/**
 * cart-system.js
 * Handles shopping cart state, UI, and checkout transition.
 * Cart is stored per user using their email as the identifier
 */

// --- Cart Data Management ---

/**
 * Get the current user's email for cart identification
 * @returns {string} User's email or null if not logged in
 */
function getCurrentUserEmail() {
  return localStorage.getItem('qreserve_logged_user_email') || null;
}

/**
 * Get cart storage key for current user
 * @returns {string} Storage key like "qreserve_cart_user@example.com" or "qreserve_cart_guest"
 */
function getCartStorageKey() {
  const userEmail = getCurrentUserEmail();
  return userEmail ? `qreserve_cart_${userEmail}` : 'qreserve_cart_guest';
}

function getCart() {
  const key = getCartStorageKey();
  const cart = JSON.parse(localStorage.getItem(key)) || [];
  
  // Safety check: if user is logged in but has no cart, check for guest cart
  if (cart.length === 0 && getCurrentUserEmail()) {
    const guestCart = JSON.parse(localStorage.getItem('qreserve_cart_guest')) || [];
    if (guestCart.length > 0) {
      console.log('Found guest cart while loading user cart, migrating now...');
      migrateCartToUser(getCurrentUserEmail());
      // Return the migrated cart
      return JSON.parse(localStorage.getItem(key)) || [];
    }
  }
  
  return cart;
}

function saveCart(cart) {
  const key = getCartStorageKey();
  localStorage.setItem(key, JSON.stringify(cart));
}

function addToCart(serviceData) {
  const cart = getCart();
  const newItem = {
    ...serviceData,
    cartItemId: Date.now() + Math.floor(Math.random() * 1000)
  };
  cart.push(newItem);
  saveCart(cart);
  updateCartBadge();
  if (typeof showToast === "function") {
    showToast(`${serviceData.serviceName} added to cart!`, "success");
  }
}

function removeFromCart(cartItemId) {
  let cart = getCart();
  cart = cart.filter(item => item.cartItemId !== cartItemId);
  saveCart(cart);
  updateCartBadge();
  renderCartItems();
}

function clearCart() {
  const key = getCartStorageKey();
  localStorage.removeItem(key);
  // Also remove old generic cart key for migration
  localStorage.removeItem("qreserve_cart");
  updateCartBadge();
}

function updateCartBadge() {
  const badge = document.getElementById("cart-badge");
  if (!badge) return;
  const cart = getCart();
  if (cart.length > 0) {
    badge.textContent = cart.length;
    badge.style.display = "inline-block";
  } else {
    badge.style.display = "none";
  }
}

function calculateCartTotal() {
  const cart = getCart();
  return cart.reduce((total, item) => total + parseFloat(item.price || 0), 0);
}

function calculateCartTotalFromItems(cartItems) {
  return cartItems.reduce((total, item) => total + parseFloat(item.price || 0), 0);
}

// --- Cart UI Rendering ---

function renderCartItems() {
  // Use the correct container for cart.html
  const listElement = document.getElementById("cart-items-container") || document.getElementById("cart-items-list");
  const emptyMsg = document.getElementById("cart-empty-message");
  const summary = document.getElementById("cart-summary");
  if (!listElement) return;

  const cart = getCart();
  if (cart.length === 0) {
    listElement.innerHTML = '';
    if (emptyMsg) emptyMsg.style.display = '';
    if (summary) summary.style.display = 'none';
    return;
  }

  if (emptyMsg) emptyMsg.style.display = 'none';
  if (summary) summary.style.display = '';

  listElement.innerHTML = cart.map((item, idx) => `
    <div class="cart-item" style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #eee; padding: 1rem 0;">
      <div class="cart-item-details">
        <h4 style="margin: 0 0 0.5rem 0;">${escapeHtml(item.serviceName)}</h4>
        <p style="margin: 0;">Check-in: ${item.checkIn ? escapeHtml(item.checkIn) : ''}</p>
        <p style="margin: 0;">Check-out: ${item.checkOut ? escapeHtml(item.checkOut) : ''}</p>
        <p style="margin: 0;">Guests: ${item.guests}</p>
      </div>
      <div class="cart-item-price" style="text-align: right;">
        <span style="font-weight: bold; font-size: 1.1rem;">₱${parseFloat(item.price).toLocaleString()}</span><br>
        <button onclick="removeFromCart(${item.cartItemId}); renderCartItems();" class="btn btn-danger btn-sm" style="margin-top: 0.5rem;">Remove</button>
      </div>
    </div>
  `).join("");

  // Update summary totals
  const totalAmount = document.getElementById("cart-total-amount");
  const downpaymentAmount = document.getElementById("cart-downpayment-amount");
  const total = calculateCartTotal();
  if (totalAmount) totalAmount.textContent = `₱${total.toLocaleString(undefined, {minimumFractionDigits:2})}`;
  if (downpaymentAmount) downpaymentAmount.textContent = `₱${(total * 0.5).toLocaleString(undefined, {minimumFractionDigits:2})}`;
}

// --- Checkout Logic ---

async function proceedToCartCheckout() {
  const cart = getCart();
  if (cart.length === 0) {
    showAlert("Your cart is empty.", "warning");
    return;
  }

  const user = getLoggedInUser();
  if (!user) {
    showAlert("Please log in to proceed with checkout.", "warning");
    setTimeout(() => { window.location.href = "login.html?redirect=cart.html"; }, 1500);
    return;
  }

  // Show loading state
  const btn = document.getElementById("cart-checkout-btn");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "Processing...";
  }

  const checkoutReservations = [];
  
  // Create individual reservations for each cart item
  for (const item of cart) {
    const payload = {
      serviceId: item.serviceId,
      serviceType: item.serviceType,
      number_of_guests: item.guests,
      checkin_date: item.checkIn,
      checkout_date: item.checkOut,
      customer_name: user.full_name,
      customer_contact: user.phone,
      customer_email: user.email,
      customer_address: user.address,
      basePrice: item.price,
      finalTotal: item.price,
      selectedDuration: item.durationId || null
    };

    try {
      const response = await fetch('http://localhost:3000/api/reservations/create-reservation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await response.json();
      if (data.success) {
        checkoutReservations.push({
          ...item,
          reservationId: data.reservationId,
          reservationHash: data.reservationHash
        });
      }
    } catch (err) {
      console.error("Cart checkout item error:", err);
    }
  }

  if (checkoutReservations.length === cart.length) {
    // Store checkout data in sessionStorage for payment page to display
    sessionStorage.setItem('checkoutCart', JSON.stringify(checkoutReservations));
    
    // Calculate totals for payment summary
    const totalAmount = checkoutReservations.reduce((sum, item) => sum + parseFloat(item.price || 0), 0);
    const downpaymentAmount = totalAmount * 0.5;
    const remainingBalance = totalAmount - downpaymentAmount;
    
    // Store summary data for payment page
    sessionStorage.setItem('checkout_total_amount', totalAmount.toString());
    sessionStorage.setItem('checkout_downpayment', downpaymentAmount.toString());
    sessionStorage.setItem('checkout_remaining_balance', remainingBalance.toString());
    
    // Redirect to payment page
    window.location.href = 'payment.html';
  } else {
    showAlert("Some items failed to process. Please try again.", "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Proceed to Payment";
    }
  }
}

// Stub for handleCartCheckout - no longer used but kept for compatibility
function handleCartCheckout() {
  // This function is no longer needed - cart data is now in sessionStorage (checkoutCart)
  // Payment page handles rendering the checkout data directly from sessionStorage
  console.log('handleCartCheckout called - no action needed, using checkoutCart from sessionStorage');
}

/**
 * Migrate cart from guest/old storage to user-specific storage
 * Called when user logs in to transfer any guest cart to their account
 * @param {string} userEmail - Email of the newly logged-in user
 */
function migrateCartToUser(userEmail) {
  if (!userEmail) {
    console.warn('migrateCartToUser called with empty email');
    return;
  }
  
  const guestCart = JSON.parse(localStorage.getItem('qreserve_cart_guest')) || [];
  const oldCart = JSON.parse(localStorage.getItem('qreserve_cart')) || [];
  
  // Also check if user already has a cart (from previous login)
  const userCartKey = `qreserve_cart_${userEmail}`;
  const existingUserCart = JSON.parse(localStorage.getItem(userCartKey)) || [];
  
  console.log('Cart Migration Debug:', {
    guestCartItems: guestCart.length,
    oldCartItems: oldCart.length,
    existingUserCartItems: existingUserCart.length,
    userEmail: userEmail,
    userCartKey: userCartKey
  });
  
  // Use guest cart if it exists, otherwise use old cart
  const cartToMigrate = guestCart.length > 0 ? guestCart : oldCart;
  
  if (cartToMigrate.length > 0) {
    // Merge with existing user cart (don't overwrite)
    const mergedCart = [...existingUserCart, ...cartToMigrate];
    localStorage.setItem(userCartKey, JSON.stringify(mergedCart));
    console.log(`✓ Migrated ${cartToMigrate.length} cart items to user ${userEmail}. Total items: ${mergedCart.length}`);
    
    // Clean up old storage keys
    localStorage.removeItem('qreserve_cart_guest');
    localStorage.removeItem('qreserve_cart');
  } else {
    console.log(`No guest cart to migrate for ${userEmail}. Existing cart items: ${existingUserCart.length}`);
  }
  
  // Update badge to show migrated items
  updateCartBadge();
}

/**
 * Clear user-specific cart when logging out
 * Keeps cart data associated with their account
 */
function handleLogout() {
  // Don't clear cart on logout - it should persist with their account
  // Just clear the session and let them log back in to see their cart
  console.log('User logged out - cart preserved for next login');
}

// Initialization
document.addEventListener("DOMContentLoaded", () => {
    updateCartBadge();
    if (document.getElementById("cart-items-list")) {
        renderCartItems();
    }
    const checkoutBtn = document.getElementById("cart-checkout-btn");
    if (checkoutBtn) {
        checkoutBtn.addEventListener("click", proceedToCartCheckout);
    }
});

// Expose globals
window.addToCart = addToCart;
window.removeFromCart = removeFromCart;
window.clearCart = clearCart;
window.updateCartBadge = updateCartBadge;
window.proceedToCartCheckout = proceedToCartCheckout;
window.handleCartCheckout = handleCartCheckout;
window.getCart = getCart;
window.getCurrentUserEmail = getCurrentUserEmail;
window.getCartStorageKey = getCartStorageKey;
window.migrateCartToUser = migrateCartToUser;
window.handleLogout = handleLogout;
