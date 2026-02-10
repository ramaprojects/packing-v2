// summary.js

/**
 * Fungsi utama yang berjalan saat halaman dimuat
 */
document.addEventListener('DOMContentLoaded', () => {
    // 1. Dapatkan sessionId dari parameter URL
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');

    const sessionIdEl = document.getElementById('summary-session-id');
    if (sessionIdEl) sessionIdEl.textContent = `ID: ${sessionId?.slice(-8) || 'Tidak Valid'}`;

    if (!sessionId) {
        showErrorPage();
        return;
    }

    // 2. Muat semua sesi dan cari yang cocok
    const allSessions = loadAllSessions(); // Fungsi ini ada di app.js
    const session = allSessions.find(s => s.sessionId === sessionId);

    // 3. Jika sesi ditemukan, render datanya.
    if (session) {
        renderShippingDetails(session);
        renderResiPhoto(session);
        renderChecklistPhotos(session);
    } else {
        showErrorPage();
    }
});

function renderShippingDetails(session) {
    const container = document.getElementById('summary-shipping-details');
    if (!container) return;

    const s = session.shipping;
    container.innerHTML = `
        <div class="row small">
            <div class="col-6 mb-2">
                <div class="text-muted">Penerima</div>
                <div class="fw-medium">${s.penerima}</div>
            </div>
            <div class="col-6 mb-2">
                <div class="text-muted">Petugas</div>
                <div class="fw-medium">${session.operator || '-'}</div>
            </div>
            <div class="col-6">
                <div class="text-muted">Platform & Jenis</div>
                <div class="fw-medium">${s.platform} - ${s.jenis}</div>
            </div>
             <div class="col-6">
                <div class="text-muted">No. Resi</div>
                <div class="fw-medium">${session.resi?.number || '-'}</div>
            </div>
        </div>
    `;
}

function renderResiPhoto(session) {
    const container = document.getElementById('summary-resi-photo');
    if (!container) return;

    if (session.resi?.photoUrl) {
        container.innerHTML = `<img src="${session.resi.photoUrl}" class="img-fluid rounded" alt="Foto Resi">`;
    } else {
        container.innerHTML = `<p class="text-muted text-center mb-0">Foto resi tidak tersedia.</p>`;
    }
}

function renderChecklistPhotos(session) {
    const container = document.getElementById('summary-checklist-container');
    if (!container) return;

    container.innerHTML = ''; // Kosongkan kontainer

    session.checklist.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card shadow-sm mb-3';
        card.style.borderRadius = '14px';

        const imageHtml = item.photoId
            ? `<img src="${item.photoId}" class="card-img-top" alt="Foto ${item.label}">`
            : `<div class="card-body text-center text-muted">Foto tidak tersedia</div>`;

        card.innerHTML = `
            ${imageHtml}
            <div class="card-body">
                <h6 class="card-title mb-0">${item.label}</h6>
            </div>
        `;
        container.appendChild(card);
    });
}

function showErrorPage() {
    // Sembunyikan konten utama dan tampilkan pesan error
    document.querySelector('main > .card, main > h5').forEach(el => el.classList.add('d-none'));
    document.getElementById('summary-not-found').classList.remove('d-none');
}
