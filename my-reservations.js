// my-reservations.js
// This script will handle fetching and rendering the user's reservations in the my-reservations.html page.

document.addEventListener('DOMContentLoaded', function () {
    // Example: Fetch reservations from backend or local storage (replace with real API call)
    // For now, use static data as in the original section
    const reservations = [
        {
            id: 'TRR-20260205-003',
            service: 'charm',
            checkin: 'Feb 16, 2026',
            checkout: 'Feb 17, 2026',
            status: 'COMPLETED',
            statusClass: 'status-completed',
            paid: '₱0.00',
            paymentImg: '/trr-backend/uploads/1770256519128-190276611.jpg',
            qr: 'confirmation.html?hash=7f2768357b2dad5a8fdf42e124ca92d6',
            qrEnabled: true
        },
        {
            id: 'TRR-20260205-002',
            service: 'charm',
            checkin: 'Feb 12, 2026',
            checkout: 'Feb 13, 2026',
            status: 'CANCELLED',
            statusClass: 'status-cancelled',
            paid: '₱0.00',
            paymentImg: '/trr-backend/uploads/1770256203600-492744657.png',
            qr: '',
            qrEnabled: false
        },
        {
            id: 'TRR-20260205-001',
            service: 'charm',
            checkin: 'Feb 19, 2026',
            checkout: 'Feb 19, 2026',
            status: 'COMPLETED',
            statusClass: 'status-completed',
            paid: '₱2,000.00',
            paymentImg: '/trr-backend/uploads/1770255601411-656724587.png',
            qr: 'confirmation.html?hash=c0f722b057a8473948576a4a4f1d2b62',
            qrEnabled: true
        }
    ];

    const tbody = document.getElementById('user-reservations-list');
    tbody.innerHTML = '';
    reservations.forEach(res => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td><strong>${res.id}</strong></td>
            <td>${res.service}</td>
            <td>${res.checkin}</td>
            <td>${res.checkout}</td>
            <td><span class="${res.statusClass}">${res.status}</span></td>
            <td>${res.paid}</td>
            <td><a href="${res.paymentImg}" target="_blank"><img src="${res.paymentImg}" alt="Receipt" style="max-width:60px;max-height:60px;border-radius:6px;box-shadow:0 2px 8px #ccc;"></a></td>
            <td>
                ${res.qrEnabled
                    ? `<a href="${res.qr}" style="display: inline-block; padding: 6px 12px; background-color: var(--primary-color); color: white; text-decoration: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; transition: background-color 0.3s; border: none; cursor: pointer;" onmouseover="this.style.backgroundColor='#1e7a34'" onmouseout="this.style.backgroundColor='var(--primary-color)'">View QR</a>`
                    : `<button style="display: inline-block; padding: 6px 12px; background-color: #cccccc; color: #666666; border: none; border-radius: 4px; font-weight: 500; font-size: 0.9rem; cursor: not-allowed;" disabled>View QR</button>`
                }
            </td>
        `;
        tbody.appendChild(tr);
    });
});
