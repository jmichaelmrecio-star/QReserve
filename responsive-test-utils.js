/**
 * Responsive Testing Utilities
 * Test mobile responsiveness across different breakpoints
 */

(function() {
  'use strict';

  // Device breakpoints for testing
  const BREAKPOINTS = {
    'iPhone SE (360px)': { width: 360, height: 667, name: 'Mobile (360px)' },
    'iPhone 11 (414px)': { width: 414, height: 896, name: 'Mobile (414px)' },
    'iPhone 12 (390px)': { width: 390, height: 844, name: 'Mobile (390px)' },
    'Pixel 4 (412px)': { width: 412, height: 869, name: 'Mobile (412px)' },
    'Galaxy S10 (360px)': { width: 360, height: 800, name: 'Mobile (360px)' },
    'iPad Mini (768px)': { width: 768, height: 1024, name: 'Tablet (768px)' },
    'iPad (812px)': { width: 812, height: 1024, name: 'Tablet (812px)' },
    'Desktop (1024px)': { width: 1024, height: 768, name: 'Desktop (1024px)' },
    'Desktop (1280px)': { width: 1280, height: 720, name: 'Desktop (1280px)' },
    'Large Desktop (1920px)': { width: 1920, height: 1080, name: 'Large Desktop (1920px)' }
  };

  // Pages to test for responsive design
  const PAGES_TO_TEST = [
    '/',
    '/index.html',
    '/login.html',
    '/register.html',
    '/reserve.html',
    '/payment.html',
    '/amenities.html',
    '/feedback.html',
    '/contact.html',
    '/admin-dashboard.html'
  ];

  /**
   * Create responsive testing panel for developers
   */
  function createTestingPanel() {
    // Only show in development/localhost
    if (!window.location.hostname.includes('localhost') && !window.location.hostname.includes('127.0.0.1')) {
      return;
    }

    const panel = document.createElement('div');
    panel.id = 'responsive-test-panel';
    panel.style.cssText = `
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
      background: white;
      border: 2px solid #28a745;
      border-radius: 8px;
      padding: 15px;
      max-width: 300px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
      font-family: monospace;
      font-size: 12px;
    `;

    let html = `
      <div style="margin-bottom: 10px; font-weight: bold; color: #28a745;">
        📱 Responsive Test Panel
      </div>
      <div style="margin-bottom: 10px;">
        <strong>Current Breakpoint:</strong>
        <div id="current-breakpoint" style="color: #007bff; font-weight: bold;">
          ${getCurrentBreakpoint()}
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>Viewport:</strong>
        <div id="viewport-size" style="color: #666;">
          ${window.innerWidth}x${window.innerHeight}
        </div>
      </div>
      <div style="margin-bottom: 10px;">
        <strong>Test Sizes:</strong>
        <div style="display: flex; flex-wrap: wrap; gap: 5px;">
    `;

    // Add quick test buttons
    Object.entries(BREAKPOINTS).forEach(([key, value]) => {
      html += `
        <button data-width="${value.width}" data-height="${value.height}"
          style="
            padding: 4px 8px;
            background: #e9ecef;
            border: 1px solid #ccc;
            border-radius: 4px;
            cursor: pointer;
            font-size: 10px;
          "
          title="${value.name}">
          ${value.width}w
        </button>
      `;
    });

    html += `
        </div>
      </div>
      <div>
        <button id="reset-viewport" style="
          width: 100%;
          padding: 8px;
          background: #28a745;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-weight: bold;
        ">
          Reset Viewport
        </button>
      </div>
    `;

    panel.innerHTML = html;
    document.body.appendChild(panel);

    // Add event listeners
    panel.querySelectorAll('[data-width]').forEach(button => {
      button.addEventListener('click', function() {
        const width = parseInt(this.dataset.width);
        const height = parseInt(this.dataset.height);
        simulateViewport(width, height);
      });
    });

    panel.querySelector('#reset-viewport').addEventListener('click', () => {
      resetViewport();
    });

    // Update breakpoint on window resize
    window.addEventListener('resize', () => {
      const breakpointEl = document.getElementById('current-breakpoint');
      const viewportEl = document.getElementById('viewport-size');
      if (breakpointEl && viewportEl) {
        breakpointEl.textContent = getCurrentBreakpoint();
        viewportEl.textContent = `${window.innerWidth}x${window.innerHeight}`;
      }
    });
  }

  /**
   * Simulate different viewport sizes
   */
  function simulateViewport(width, height) {
    const meta = document.querySelector('meta[name="viewport"]');
    if (!meta) return;

    meta.content = `width=${width}, initial-scale=1.0, viewport-fit=cover`;
    window.innerWidth = width;

    // Update meta viewport for CSS media queries
    document.documentElement.style.fontSize = '16px';

    console.log(`📱 Simulating viewport: ${width}x${height}`);
    showNotification(`Viewport: ${width}x${height}`);
  }

  /**
   * Reset viewport to actual device size
   */
  function resetViewport() {
    const meta = document.querySelector('meta[name="viewport"]');
    if (meta) {
      meta.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    }
    console.log('✅ Viewport reset to device width');
    showNotification('Viewport reset to actual device');
  }

  /**
   * Get current breakpoint based on window width
   */
  function getCurrentBreakpoint() {
    const width = window.innerWidth;
    if (width < 360) return '💔 < 360px';
    if (width < 480) return '📱 360-480px';
    if (width < 768) return '📱 480-768px';
    if (width < 1024) return '📱 768-1024px';
    if (width < 1440) return '🖥️ 1024-1440px';
    return '🖥️ 1440px+';
  }

  /**
   * Show temporary notification
   */
  function showNotification(message) {
    const notification = document.createElement('div');
    notification.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #28a745;
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      font-family: Arial, sans-serif;
      z-index: 10000;
      animation: slideIn 0.3s ease-out;
    `;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
      notification.style.animation = 'slideOut 0.3s ease-in';
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  /**
   * Check for common responsive design issues
   */
  function auditResponsiveness() {
    const issues = [];

    // Check viewport meta tag
    const viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      issues.push('⚠️ Missing viewport meta tag');
    }

    // Check for fixed width elements
    document.querySelectorAll('*').forEach(el => {
      const style = window.getComputedStyle(el);
      const width = style.width;
      
      if (width && width.endsWith('px')) {
        const widthNum = parseInt(width);
        if (widthNum > 1200 && widthNum < window.innerWidth * 0.9) {
          // This might be a fixed-width issue on narrow screens
        }
      }
    });

    // Check for overflow issues
    document.querySelectorAll('table, pre, code').forEach(el => {
      if (el.scrollWidth > window.innerWidth) {
        issues.push(`⚠️ ${el.tagName} overflows viewport (${el.scrollWidth}px > ${window.innerWidth}px)`);
      }
    });

    // Check button sizes
    document.querySelectorAll('button, a.btn, input[type="button"]').forEach(btn => {
      const rect = btn.getBoundingClientRect();
      if (rect.height < 44 || rect.width < 44) {
        issues.push(`⚠️ Button too small: ${Math.round(rect.width)}x${Math.round(rect.height)}px (min 44x44px)`);
      }
    });

    if (issues.length === 0) {
      console.log('✅ Responsive design audit passed!');
      showNotification('✅ Responsive audit passed!');
    } else {
      console.log('⚠️ Responsive design issues found:');
      issues.forEach(issue => console.log(issue));
      showNotification(`⚠️ ${issues.length} responsive issues found`);
    }

    return issues;
  }

  // Initialize on page load
  function init() {
    createTestingPanel();

    // Add audit function to window for console access
    window.testResponsive = {
      audit: auditResponsiveness,
      simulate: (width, height) => simulateViewport(width, height),
      reset: resetViewport,
      breakpoints: BREAKPOINTS,
      pages: PAGES_TO_TEST,
      getCurrentBreakpoint
    };

    console.log('📱 Responsive testing utilities loaded. Use window.testResponsive for testing.');
  }

  // Add required styles for animations
  const style = document.createElement('style');
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(400px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(400px); opacity: 0; }
    }
  `;
  document.head.appendChild(style);

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
