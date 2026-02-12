document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');

    const sessionIdEl = document.getElementById('summary-session-id');
    if (sessionIdEl) sessionIdEl.textContent = `ID: ${sessionId?.slice(-8).toUpperCase() || 'Tidak Valid'}`;

    if (!sessionId) {
        showErrorPage();
        return;
    }

    const allSessions = loadAllSessions(); 
    const session = allSessions.find(s => s.SessionID === sessionId);

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

    container.innerHTML = `
        <div class="row small">
            <div class="col-6 mb-2">
                <div class="text-muted">Penerima</div>
                <div class="fw-medium">${session.Penerima}</div>
            </div>
            <div class="col-6 mb-2">
                <div class="text-muted">Petugas</div>
                <div class="fw-medium">${session.Petugas || '-'}</div>
            </div>
            <div class="col-6">
                <div class="text-muted">Platform & Jenis</div>
                <div class="fw-medium">${session.Platform} - ${session.JenisBarang}</div>
            </div>
             <div class="col-6">
                <div class="text-muted">No. Resi</div>
                <div class="fw-medium">${session.NomorResi || '-'}</div>
            </div>
        </div>
    `;
}

function renderResiPhoto(session) {
    const container = document.getElementById('summary-resi-photo');
    if (!container) return;

    if (session.LinkFotoResi) {
        container.innerHTML = `<img src="${session.LinkFotoResi}" class="img-fluid rounded" alt="Foto Resi">`;
    } else {
        container.innerHTML = `<p class="text-muted text-center mb-0">Foto resi tidak tersedia.</p>`;
    }
}

function renderChecklistPhotos(session) {
    const container = document.getElementById('summary-checklist-container');
    if (!container) return;

    container.innerHTML = '';
    
    const checklist = session.ChecklistData || [];

    if (checklist.length === 0) {
        container.innerHTML = '<p class="text-muted">Data checklist tidak tersedia.</p>';
        return;
    }

    checklist.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card shadow-sm mb-3';
        card.style.borderRadius = '14px';

        const imageHtml = item.photoUrl
            ? `<img src="${item.photoUrl}" class="card-img-top" alt="Foto ${item.label}">`
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
    document.querySelectorAll('main > .card, main > h5').forEach(el => el.classList.add('d-none'));
    
    const waButton = document.getElementById('btn-send-whatsapp');
    if (waButton) waButton.classList.add('d-none');
    
    document.getElementById('summary-not-found').classList.remove('d-none');
}
