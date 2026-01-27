// Minimal Add Duration logic for admin-services
function addDurationRow() {
    const container = document.getElementById('durationsContainer');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'input-group mb-2 duration-row';
    row.innerHTML = `
        <input type="text" class="form-control" name="duration[]" placeholder="e.g. 8:00 AM - 12:00 PM" required>
        <button type="button" class="btn btn-danger remove-duration-btn">Remove</button>
    `;
    row.querySelector('.remove-duration-btn').onclick = function() {
        row.remove();
    };
    container.appendChild(row);
}

document.addEventListener('DOMContentLoaded', function() {
    const addDurationBtn = document.getElementById('addDurationBtn');
    if (addDurationBtn) {
        addDurationBtn.addEventListener('click', function(e) {
            e.preventDefault();
            addDurationRow();
        });
    }
});
