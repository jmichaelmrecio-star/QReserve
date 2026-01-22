// --- Generate Report Logic (CSV Download) ---
async function generateReservationsReport() {
	// Prompt for date range
	const startDate = prompt('Enter report START date (YYYY-MM-DD):');
	if (!startDate) return;
	const endDate = prompt('Enter report END date (YYYY-MM-DD):');
	if (!endDate) return;
	try {
		const response = await fetch(`http://localhost:3000/api/reservations/admin/reports/generate?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`);
		const data = await response.json();
		if (data.success && data.report) {
			// Convert report to CSV
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
		} else {
			alert(data.message || 'Failed to generate report.');
		}
	} catch (err) {
		alert('Error generating report.');
	}
}

// Attach to both admin and manager report buttons
document.addEventListener('DOMContentLoaded', function() {
	const reportButton = document.getElementById('report-button');
	if (reportButton) {
		reportButton.addEventListener('click', generateReservationsReport);
	}
});
