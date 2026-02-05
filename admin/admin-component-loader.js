/**
 * Admin Component Loader
 * Similar to PHP's include/require_once functionality
 * Loads HTML components dynamically and injects them into the page
 */

class AdminComponentLoader {
    constructor() {
        this.loadedComponents = new Set();
        this.componentCache = new Map();
    }

    /**
     * Load a component HTML file and inject it into a target element
     * @param {string} componentPath - Path to the HTML component file
     * @param {string} targetId - ID of the element where component will be injected
     * @param {boolean} cache - Whether to cache the component (default: true)
     * @returns {Promise<void>}
     */
    async loadComponent(componentPath, targetId, cache = true) {
        // Check if already loaded
        if (this.loadedComponents.has(componentPath) && cache) {
            console.log(`Component ${componentPath} already loaded, using cache`);
            return;
        }

        const targetElement = document.getElementById(targetId);
        if (!targetElement) {
            console.error(`Target element with ID "${targetId}" not found`);
            return;
        }

        try {
            // Check cache first
            if (this.componentCache.has(componentPath) && cache) {
                targetElement.innerHTML = this.componentCache.get(componentPath);
                this.loadedComponents.add(componentPath);
                this.initializeComponentScripts(targetElement);
                return;
            }

            // Fetch component
            const response = await fetch(componentPath);
            if (!response.ok) {
                throw new Error(`Failed to load component: ${response.status} ${response.statusText}`);
            }

            const html = await response.text();
            
            // Cache the component
            if (cache) {
                this.componentCache.set(componentPath, html);
                this.loadedComponents.add(componentPath);
            }

            // Inject into target
            targetElement.innerHTML = html;
            
            // Wait a bit for DOM to update, then initialize scripts
            setTimeout(() => {
                this.initializeComponentScripts(targetElement);
            }, 10);

            console.log(`✅ Loaded component: ${componentPath} into #${targetId}`);
        } catch (error) {
            console.error(`Error loading component ${componentPath}:`, error);
            targetElement.innerHTML = `<div style="padding: 20px; color: red;">Error loading component: ${componentPath}<br>${error.message}</div>`;
        }
    }

    /**
     * Initialize scripts within a loaded component
     * @param {HTMLElement} element - The element containing the component
     */
    initializeComponentScripts(element) {
        // Find all script tags in the component
        const scripts = element.querySelectorAll('script');
        
        scripts.forEach((oldScript) => {
            const newScript = document.createElement('script');
            
            // Copy attributes
            Array.from(oldScript.attributes).forEach((attr) => {
                newScript.setAttribute(attr.name, attr.value);
            });
            
            // Copy content
            if (oldScript.src) {
                newScript.src = oldScript.src;
            } else {
                newScript.textContent = oldScript.textContent;
            }
            
            // Replace old script with new one
            oldScript.parentNode.replaceChild(newScript, oldScript);
        });
    }

    /**
     * Load multiple components in parallel
     * @param {Array<{path: string, target: string}>} components - Array of component configs
     * @returns {Promise<void>}
     */
    async loadComponents(components) {
        const promises = components.map(comp => 
            this.loadComponent(comp.path, comp.target, comp.cache !== false)
        );
        await Promise.all(promises);
    }

    /**
     * Clear component cache
     */
    clearCache() {
        this.componentCache.clear();
        this.loadedComponents.clear();
    }

    /**
     * Remove a component from cache
     * @param {string} componentPath - Path to the component
     */
    removeFromCache(componentPath) {
        this.componentCache.delete(componentPath);
        this.loadedComponents.delete(componentPath);
    }
}

// Create global instance
window.adminComponentLoader = new AdminComponentLoader();

// Export for module systems if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AdminComponentLoader;
}
