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
  const listElement = document.getElementById("cart-items-list");
  if (!listElement) return;

  const cart = getCart();
  if (cart.length === 0) {
    listElement.innerHTML = '<div class="empty-cart"><p>Your cart is empty.</p><a href="services-list.html" class="btn btn-primary">Browse Services</a></div>';
    const checkoutBtn = document.getElementById("cart-checkout-btn");
    if (checkoutBtn) checkoutBtn.disabled = true;
    return;
  }

  listElement.innerHTML = cart.map((item) => `
    <div class="cart-item">
      <div class="cart-item-details">
        <h4>${escapeHtml(item.serviceName)}</h4>
        <p>Date: ${formatDate(item.checkIn)}</p>
        <p>Guests: ${item.guests}</p>
      </div>
      <div class="cart-item-price">
        <span>₱${parseFloat(item.price).toLocaleString()}</span>
        <button onclick="removeFromCart(${item.cartItemId})" class="btn-remove">Remove</button>
      </div>
    </div>
  `).join("");

  const totalDisplay = document.getElementById("cart-total-display");
  if (totalDisplay) {
    totalDisplay.textContent = `₱${calculateCartTotal().toLocaleString()}`;
  }
  
  const checkoutBtn = document.getElementById("cart-checkout-btn");
  if (checkoutBtn) checkoutBtn.disabled = false;
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
    sessionStorage.setItem('checkoutCart', JSON.stringify(checkoutReservations));
    window.location.href = 'payment.html';
  } else {
    showAlert("Some items failed to process. Please try again.", "error");
    if (btn) {
      btn.disabled = false;
      btn.textContent = "Proceed to Payment";
    }
  }
}

function handleCartCheckout() {
  const cartJson = sessionStorage.getItem('checkoutCart');
  if (!cartJson) return;
  
  const cart = JSON.parse(cartJson);
  const total = calculateCartTotalFromItems(cart);
  const downpayment = total * 0.5;
  
  const cartItemsList = document.getElementById('cart-items-container') || document.getElementById('cart-items-for-payment');
  if (cartItemsList) {
    cartItemsList.innerHTML = cart.map((item, idx) => `
      <div class="summary-item">
        <p><strong>${idx + 1}. ${item.serviceName}</strong></p>
        <p>Check-in: ${formatDate(item.checkIn)} | Guests: ${item.guests}</p>
        <p class="price-text">₱${parseFloat(item.price).toLocaleString()}</p>
      </div>
    `).join('');
  }

  const totalEl = document.getElementById("summary-total-cost") || document.getElementById("totalReservationCost") || document.getElementById("cart-total-amount");
  const payEl = document.getElementById("summary-downpayment") || document.getElementById("paymentAmount") || document.getElementById("cart-downpayment-amount");

  if (totalEl) totalEl.textContent = total.toLocaleString(undefined, {minimumFractionDigits:2});
  if (payEl) payEl.textContent = downpayment.toLocaleString(undefined, {minimumFractionDigits:2});
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
