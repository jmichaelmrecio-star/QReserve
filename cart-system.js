/**
 * cart-system.js
 * Handles shopping cart state, UI, and checkout transition.
 */

// --- Cart Data Management ---

function getCart() {
  return JSON.parse(localStorage.getItem("qreserve_cart")) || [];
}

function saveCart(cart) {
  localStorage.setItem("qreserve_cart", JSON.stringify(cart));
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

// handleCartCheckout removed: sessionStorage cart is no longer used

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
