// admin-schedule.js
// Handles loading services for blocking in the admin schedule page

async function loadServicesForBlocking() {
    const container = document.getElementById('serviceCheckboxes');
    if (!container) return;
    container.innerHTML = '<div>Loading services...</div>';
    try {
        const response = await fetch('/api/services/admin/all');
        if (!response.ok) throw new Error('Failed to fetch services');
        const services = await response.json();
        if (!Array.isArray(services) || services.length === 0) {
            container.innerHTML = '<div class="text-danger">No services found.</div>';
            return;
        }
        container.innerHTML = '';
        services.forEach(service => {
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'form-check-input';
            checkbox.id = `blockService_${service._id}`;
            checkbox.value = service._id;
            checkbox.name = 'blockServices';

            const label = document.createElement('label');
            label.className = 'form-check-label ms-2';
            label.htmlFor = checkbox.id;
            label.textContent = `${service.type}: ${service.name}`;

            const wrapper = document.createElement('div');
            wrapper.className = 'form-check mb-1';
            wrapper.appendChild(checkbox);
            wrapper.appendChild(label);

            container.appendChild(wrapper);
        });
    } catch (err) {
        container.innerHTML = `<div class='text-danger'>Error loading services: ${err.message}</div>`;
    }
}

// Expose for HTML inline script
window.loadServicesForBlocking = loadServicesForBlocking;
