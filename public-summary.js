document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('sessionId');

    if (!sessionId) {
        showErrorPage();
        return;
    }
    
    fetchSessionDataFromServer(sessionId);
});

async function fetchSessionDataFromServer(sessionId) {
    showLoadingState(); 

    try {
        const url = `${LINK_GAS}?action=get_session&id=${sessionId}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error("Gagal terhubung ke server.");

        const result = await response.json();
        if (result.status !== 'success' || !result.data) {
            throw new Error("Sesi tidak ditemukan di server.");
        }

        const session = result.data;
        renderShippingDetails(session);
        renderResiPhoto(session);
        renderChecklistPhotos(session);

    } catch (error) {
        console.error("Gagal memuat sesi:", error);
        showErrorPage(error.message);
    }
}

function showLoadingState() {
    document.getElementById('summary-shipping-details').innerHTML = '<p class="text-muted">Memuat data...</p>';
}

function showErrorPage(message = "Sesi dengan ID yang diberikan tidak dapat ditemukan.") {
    document.querySelectorAll('main > .card, main > h5').forEach(el => el.classList.add('d-none'));
    
    const errorContainer = document.getElementById('summary-not-found');
    errorContainer.classList.remove('d-none');
    errorContainer.querySelector('p').textContent = message;
}


function renderShippingDetails(session) {
    const container = document.getElementById('summary-shipping-details');
    if (!container) return;
    container.innerHTML = `
        <div class="row small">
            <div class="col-6 mb-2"><div class="text-muted">Penerima</div><div class="fw-medium">${session.Penerima}</div></div>
            <div class="col-6 mb-2"><div class="text-muted">Petugas</div><div class="fw-medium">${session.Petugas || '-'}</div></div>
            <div class="col-6"><div class="text-muted">Platform & Jenis</div><div class="fw-medium">${session.Platform} - ${session.JenisBarang}</div></div>
            <div class="col-6"><div class="text-muted">No. Resi</div><div class="fw-medium">${session.NomorResi || '-'}</div></div>
        </div>
    `;
}

function renderResiPhoto(session) {
    const container = document.getElementById('summary-resi-photo');
    const card = document.getElementById('resi-photo-card');
    if (!container || !card) return;

    if (session.LinkFotoResi) {
        card.classList.remove('d-none');
        container.innerHTML = `<img src="${session.LinkFotoResi}" class="img-fluid rounded" alt="Foto Resi">`;
    }
}

function renderChecklistPhotos(session) {
    const container = document.getElementById('summary-checklist-container');
    if (!container) return;

    const checklist = session.ChecklistData || [];
    if (checklist.length === 0) {
        container.innerHTML = '<p class="text-muted">Data checklist tidak tersedia.</p>';
        return;
    }
    container.innerHTML = '';
    checklist.forEach(item => {
        const card = document.createElement('div');
        card.className = 'card shadow-sm mb-3';
        card.innerHTML = (item.photoUrl ? `<img src="${item.photoUrl}" class="card-img-top" alt="Foto ${item.label}">` : `<div class="card-body text-center text-muted">Foto tidak tersedia</div>`) + `<div class="card-body"><h6 class="card-title mb-0">${item.label}</h6></div>`;
        container.appendChild(card);
    });
}
