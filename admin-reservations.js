
// --- Generate Report Logic (CSV Download, Modal-based) ---
document.addEventListener('DOMContentLoaded', function() {
	const reportForm = document.getElementById('reportForm');
	if (reportForm) {
		reportForm.addEventListener('submit', async function(e) {
			e.preventDefault();
			const startDate = document.getElementById('reportStartDate').value;
			const endDate = document.getElementById('reportEndDate').value;
			const statusDiv = document.getElementById('reportStatus');
			statusDiv.innerHTML = '';
			if (!startDate || !endDate) {
				statusDiv.innerHTML = '<div class="alert alert-danger">Please select both dates.</div>';
				return;
			}
			if (endDate < startDate) {
				statusDiv.innerHTML = '<div class="alert alert-warning">End date cannot be before start date.</div>';
				return;
			}
			statusDiv.innerHTML = '<div class="alert alert-info">Generating report...</div>';
			try {
				const response = await fetch(`http://localhost:3000/api/reservations/admin/reports/generate?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
				const data = await response.json();
				if (data.success && data.report) {
					const csv = `Report Period,${startDate} to ${endDate}\nTotal Reservations,${data.report.totalReservations}\nTotal Income,${data.report.totalIncome}`;
					const blob = new Blob([csv], { type: 'text/csv' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `reservation_report_${startDate}_to_${endDate}.csv`;
					document.body.appendChild(a);
					a.click();
					document.body.removeChild(a);
					URL.revokeObjectURL(url);
					statusDiv.innerHTML = '<div class="alert alert-success">Report generated and downloaded.</div>';
				} else {
					statusDiv.innerHTML = `<div class='alert alert-danger'>${data.message || 'Failed to generate report.'}</div>`;
				}
			} catch (err) {
				statusDiv.innerHTML = '<div class="alert alert-danger">Error generating report.</div>';
			}
		});
	}
});
