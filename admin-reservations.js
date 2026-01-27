
// --- Generate Report Logic (Enhanced CSV Download, Modal-based) ---
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
				
				if (!response.ok) {
					throw new Error(`HTTP error! status: ${response.status}`);
				}
				
				const data = await response.json();
				
				if (data.success && data.report) {
					const report = data.report;
					
					// Build comprehensive CSV content
					let csvContent = '';
					
					// Header section
					csvContent += '=== TITO RENZ RESORT RESERVATION REPORT ===\n';
					csvContent += `Report Period,${startDate} to ${endDate}\n`;
					csvContent += `Generated On,${new Date().toLocaleString()}\n`;
					csvContent += '\n';
					
					// Summary section
					csvContent += '=== SUMMARY ===\n';
					csvContent += `Total Reservations,${report.totalReservations}\n`;
					csvContent += `Total Income,₱${report.totalIncome.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
					csvContent += '\n';
					
					// Service breakdown section
					if (report.serviceBreakdown && Object.keys(report.serviceBreakdown).length > 0) {
						csvContent += '=== BREAKDOWN BY SERVICE TYPE ===\n';
						csvContent += 'Service Type,Reservations,Revenue\n';
						for (const [serviceType, data] of Object.entries(report.serviceBreakdown)) {
							csvContent += `${serviceType},${data.count},₱${data.revenue.toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n`;
						}
						csvContent += '\n';
					}
					
					// Detailed reservations section
					if (report.detailedReservations && report.detailedReservations.length > 0) {
						csvContent += '=== DETAILED RESERVATION LIST ===\n';
						csvContent += 'Reservation ID,Customer Name,Email,Service Type,Check-in,Check-out,Guests,Base Price,Discount,Final Total,Status,GCash Ref,Date Created\n';
						
						report.detailedReservations.forEach(res => {
							csvContent += `${res.reservationId},"${res.customerName}",${res.email},${res.serviceType},${res.checkIn},${res.checkOut},${res.guests},₱${res.basePrice.toLocaleString()},₱${res.discount.toLocaleString()},₱${res.finalTotal.toLocaleString()},${res.status},${res.gcashRef},${res.dateCreated}\n`;
						});
					}
					
					// Create and download CSV
					const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
					const url = URL.createObjectURL(blob);
					const a = document.createElement('a');
					a.href = url;
					a.download = `tito_renz_reservation_report_${startDate}_to_${endDate}.csv`;
					a.style.display = 'none';
					document.body.appendChild(a);
					a.click();
					
					// Cleanup
					setTimeout(() => {
						document.body.removeChild(a);
						URL.revokeObjectURL(url);
					}, 100);
					
					statusDiv.innerHTML = `<div class="alert alert-success"><strong>Success!</strong> Report generated with ${report.totalReservations} reservation(s) and downloaded.</div>`;
					
					// Auto-close modal after 2 seconds
					setTimeout(() => {
						const reportModal = bootstrap.Modal.getInstance(document.getElementById('reportModal'));
						if (reportModal) reportModal.hide();
					}, 2000);
					
				} else {
					statusDiv.innerHTML = `<div class="alert alert-danger">${data.message || 'Failed to generate report.'}</div>`;
				}
			} catch (err) {
				console.error('Report generation error:', err);
				statusDiv.innerHTML = `<div class="alert alert-danger"><strong>Error:</strong> ${err.message || 'Failed to generate report. Please try again.'}</div>`;
			}
		});
	}
});
