/**
 * Mobile Responsiveness Enhancements
 * Provides touch-friendly interactions and device-specific optimizations
 */

(function() {
  'use strict';

  // Detect device capabilities
  const isTouchDevice = () => {
    return (
      (navigator.maxTouchPoints > 0) ||
      (navigator.msMaxTouchPoints > 0) ||
      (window.ontouchstart !== undefined)
    );
  };

  const isSmallScreen = () => window.innerWidth < 768;
  const isMobileDevice = () => /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

  // Ensure proper viewport meta tag
  function ensureViewportMeta() {
    let viewport = document.querySelector('meta[name="viewport"]');
    if (!viewport) {
      viewport = document.createElement('meta');
      viewport.name = 'viewport';
      viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
      document.head.appendChild(viewport);
    } else {
      viewport.content = 'width=device-width, initial-scale=1.0, viewport-fit=cover';
    }
  }

  // Add touch-friendly feedback class to body
  function initTouchDetection() {
    if (isTouchDevice()) {
      document.body.classList.add('is-touch-device');
      document.body.classList.remove('is-mouse-device');
    } else {
      document.body.classList.add('is-mouse-device');
      document.body.classList.remove('is-touch-device');
    }

    if (isSmallScreen()) {
      document.body.classList.add('is-mobile');
    }

    if (isMobileDevice()) {
      document.body.classList.add('is-native-mobile');
    }
  }

  // Improve form inputs on mobile
  function optimizeFormInputs() {
    const inputs = document.querySelectorAll('input, select, textarea');
    inputs.forEach(input => {
      // Ensure minimum touch target size
      if (!input.classList.contains('checkbox-item')) {
        input.style.minHeight = '44px';
      }

      // Add better focus handling for mobile
      input.addEventListener('focus', function() {
        if (isSmallScreen()) {
          // Scroll input into view on mobile
          setTimeout(() => {
            this.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }, 300);
        }
      });
    });
  }

  // Improve button touch targets
  function optimizeButtons() {
    const buttons = document.querySelectorAll('button, .btn, a.button-primary, a.button-secondary');
    buttons.forEach(button => {
      // Ensure minimum touch target size
      const styles = window.getComputedStyle(button);
      const height = parseInt(styles.height);
      const width = parseInt(styles.width);

      if (height < 44) {
        button.style.minHeight = '44px';
      }
      if (width < 44 && !button.classList.contains('icon-button')) {
        button.style.minWidth = '44px';
      }

      // Prevent double-tap zoom on buttons
      button.addEventListener('click', function(e) {
        e.preventDefault();
        e.target.click();
      });
    });
  }

  // Handle viewport orientation changes
  function handleOrientationChange() {
    window.addEventListener('orientationchange', function() {
      setTimeout(() => {
        // Adjust layout after orientation change
        document.body.classList.toggle('landscape', window.orientation === 90 || window.orientation === -90);
        document.body.classList.toggle('portrait', window.orientation === 0 || window.orientation === 180);
      }, 100);
    });
  }

  // Prevent iOS zoom on input focus
  function preventIOSZoom() {
    if (/iPhone|iPad|iPod/.test(navigator.userAgent)) {
      let lastTouchEnd = 0;
      document.addEventListener('touchend', function(event) {
        lastTouchEnd = Date.now();
      }, false);

      document.addEventListener('touchstart', function(event) {
        // Prevent zoom on double-tap
        if (Date.now() - lastTouchEnd <= 300 && event.target.tagName !== 'INPUT' && event.target.tagName !== 'TEXTAREA') {
          event.preventDefault();
        }
      }, false);
    }
  }

  // Add safe area padding for notched devices
  function applySafeAreaPadding() {
    const root = document.documentElement;
    const safePaddingTop = getComputedStyle(root).getPropertyValue('--safe-area-inset-top') || '0';
    const safePaddingBottom = getComputedStyle(root).getPropertyValue('--safe-area-inset-bottom') || '0';

    if (navigator.userAgent.includes('iPhone')) {
      document.body.style.paddingTop = `env(safe-area-inset-top)`;
      document.body.style.paddingBottom = `env(safe-area-inset-bottom)`;
    }
  }

  // Smooth scroll polyfill for older browsers
  function enableSmoothScroll() {
    if (!('scrollBehavior' in document.documentElement.style)) {
      const smoothScroll = function(element) {
        const startPosition = window.pageYOffset;
        const targetPosition = element.offsetTop;
        const distance = targetPosition - startPosition;
        const duration = 300;
        let start = null;

        window.requestAnimationFrame(function step(timestamp) {
          if (!start) start = timestamp;
          const progress = timestamp - start;
          window.scrollBy(0, easeInOutQuad(progress, startPosition, distance, duration));
          if (progress < duration) window.requestAnimationFrame(step);
        });
      };

      const easeInOutQuad = (t, b, c, d) => {
        t /= d / 2;
        if (t < 1) return c / 2 * t * t + b;
        t--;
        return -c / 2 * (t * (t - 2) - 1) + b;
      };

      // Apply to smooth scroll links
      document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function(e) {
          e.preventDefault();
          const target = document.querySelector(this.getAttribute('href'));
          if (target) smoothScroll(target);
        });
      });
    }
  }

  // Debounce utility for resize events
  const debounce = (func, wait) => {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  };

  // Handle window resize with debouncing
  const handleResize = debounce(() => {
    const wasMobile = document.body.classList.contains('is-mobile');
    if (isSmallScreen() && !wasMobile) {
      document.body.classList.add('is-mobile');
    } else if (!isSmallScreen() && wasMobile) {
      document.body.classList.remove('is-mobile');
    }
  }, 250);

  window.addEventListener('resize', handleResize);

  // Improve accessibility for touch devices
  function improveAccessibility() {
    // Add ARIA labels to icon buttons
    const iconButtons = document.querySelectorAll('.icon-button, .btn-icon, .carousel-nav-btn');
    iconButtons.forEach((btn, index) => {
      if (!btn.getAttribute('aria-label')) {
        const ariaLabel = btn.className || `Button ${index + 1}`;
        btn.setAttribute('aria-label', ariaLabel);
      }
    });

    // Ensure all form controls have labels
    const formControls = document.querySelectorAll('input, select, textarea');
    formControls.forEach((control) => {
      if (!control.id) {
        control.id = `control-${Math.random().toString(36).substr(2, 9)}`;
      }
      const label = document.querySelector(`label[for="${control.id}"]`);
      if (!label && control.placeholder) {
        control.setAttribute('aria-label', control.placeholder);
      }
    });
  }

  // Initialize all mobile enhancements on DOM ready
  function init() {
    ensureViewportMeta();
    initTouchDetection();
    optimizeFormInputs();
    optimizeButtons();
    handleOrientationChange();
    preventIOSZoom();
    applySafeAreaPadding();
    enableSmoothScroll();
    improveAccessibility();

    // Log device info for debugging
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('📱 Mobile Responsiveness Info:', {
        isTouchDevice: isTouchDevice(),
        isSmallScreen: isSmallScreen(),
        isMobileDevice: isMobileDevice(),
        screenWidth: window.innerWidth,
        screenHeight: window.innerHeight,
        userAgent: navigator.userAgent
      });
    }
  }

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Expose utility functions globally
  window.responsiveUtils = {
    isTouchDevice,
    isSmallScreen,
    isMobileDevice,
    debounce
  };
})();
