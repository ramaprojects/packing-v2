let historyCache = [];

async function fetchAndRenderHistory() {
    const container = document.getElementById('history-list');
    const emptyView = document.getElementById('history-empty');
    const searchInput = document.getElementById('historySearch');

    container.innerHTML = `<p class="text-center text-muted mt-5">Memuat riwayat dari server...</p>`;
    container.classList.remove('d-none');
    emptyView.classList.add('d-none');
    searchInput.disabled = true;

    try {
        const response = await fetch(LINK_GAS);
        if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);

        const result = await response.json();
if (result.status !== 'success') throw new Error(result.message);

/* ===== MERGE SERVER + LOCAL (ANTI HILANG SESI RESI) ===== */
const serverSessions = result.data;
const localSessions = loadAllSessions() || [];

// Buat map berdasarkan sessionId (server pakai SessionID)
const localMap = new Map(
    localSessions.map(s => [s.sessionId, s])
);

// Masukkan / update data dari server
serverSessions.forEach(serverSession => {
    const id = serverSession.SessionID;

    if (localMap.has(id)) {
        // Update status jadi SYNCED tapi jangan hapus field lokal lain
        localMap.set(id, {
            ...localMap.get(id),
            status: 'SYNCED'
        });
    } else {
        // Tambahkan sesi dari server jika belum ada di lokal
        localMap.set(id, {
            sessionId: id,
            status: 'SYNCED',
            ...serverSession
        });
    }
});

// Simpan hasil merge
saveAllSessions(Array.from(localMap.values()));
/* ===== END MERGE ===== */


        historyCache = result.data.sort((a, b) => {
            const dateA = a.WaktuSelesai || a.WaktuDibuat;
            const dateB = b.WaktuSelesai || b.WaktuDibuat;
            return new Date(dateB) - new Date(dateA);
        });

        renderHistory();

    } catch (error) {
        console.error("Gagal memuat riwayat dari server:", error);
        container.innerHTML = `<p class="text-center text-danger mt-5">Gagal memuat riwayat. Periksa koneksi dan coba lagi.</p>`;
    } finally {
        searchInput.disabled = false;
    }
}

function renderHistory(list = historyCache) {
    const container = document.getElementById('history-list');
    const emptyView = document.getElementById('history-empty');
    if (!container || !emptyView) return;

    if (!list.length) {
        container.classList.add('d-none');
        emptyView.classList.remove('d-none');
        const isSearching = document.getElementById('historySearch').value !== '';
        emptyView.querySelector('h5').textContent = isSearching ? 'Tidak Ditemukan' : 'Belum Ada Riwayat';
        emptyView.querySelector('p').textContent = isSearching
            ? 'Tidak ada riwayat yang cocok dengan pencarian Anda.'
            : 'Mulai sesi packing baru untuk melihat riwayat di sini.';
        return;
    }

    container.classList.remove('d-none');
    emptyView.classList.add('d-none');
    container.innerHTML = '';

    const groupedByDate = list.reduce((acc, session) => {
        const groupDate = session.WaktuSelesai || session.WaktuDibuat;
        const dateKey = new Date(groupDate).toISOString().split('T')[0];

        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(session);
        return acc;
    }, {});

    Object.keys(groupedByDate).forEach((dateKey, index) => {
        const sessionsOnDate = groupedByDate[dateKey];
        const isFirstGroup = index === 0;
        const collapseId = `collapse-${dateKey}`;
        const formattedDate = new Date(dateKey).toLocaleDateString('id-ID', {
            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
        });

        const accordionItem = document.createElement('div');
        accordionItem.className = 'accordion-item mb-3 border rounded-3 shadow-sm';

        accordionItem.innerHTML = `
            <h2 class="accordion-header" style="position: relative;">
                <button class="accordion-button collapsed" type="button" data-bs-toggle="collapse" data-bs-target="#${collapseId}">
                    ${formattedDate}
                    <span class="badge bg-secondary-subtle text-secondary-emphasis ms-auto me-5">${sessionsOnDate.length} Sesi</span>
                </button>
                <!-- Tombol WhatsApp terpisah dari tombol accordion -->
                <button class="btn btn-sm btn-success position-absolute end-0 top-0 me-2 my-2 btn-send-group-whatsapp" data-date-key="${dateKey}" title="Kirim Laporan Tanggal Ini ke WhatsApp">
                    <i class="bi bi-whatsapp"></i>
                </button>
            </h2>
            <div id="${collapseId}" class="accordion-collapse collapse" data-bs-parent="#history-list">
                <div class="list-group list-group-flush">
                    ${sessionsOnDate.map(session => createSessionCard(session)).join('')}
                </div>
            </div>
        `;
        container.appendChild(accordionItem);
    });
}

function createSessionCard(session) {
    const badge = getStatusBadgeDetails(session.Status);
    return `
        <div class="swipe-container list-group-item list-group-item-action p-0">
            <div class="swipe-actions">
                <button class="swipe-delete-button" data-session-id="${session.SessionID}">
                    <i class="bi bi-trash-fill"></i>
                </button>
            </div>
            <div class="swipe-card p-3" data-session-id="${session.SessionID}" data-href="summary.html?sessionId=${session.SessionID}">
                <div class="d-flex w-100 justify-content-between">
                    <h6 class="mb-1 text-truncate fw-semibold">${session.Penerima}</h6>
                    <small class="text-muted">${new Date(session.WaktuDibuat).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small>
                </div>
                <small class="mb-1 d-block text-muted">${session.JenisBarang} - ${session.Platform}</small>
                <span class="badge ${badge.className}">${badge.label}</span>
            </div>
        </div>
    `;
}

/**
 * @param {Array} sessions
 * @param {string} dateKey
 * @returns {string} 
 */
function createBulkWhatsAppMessage(sessions, dateKey) {
    const formattedDate = new Date(dateKey).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    let message = `*Laporan Harian Packing - ${formattedDate}*\n`;
    message += `*Total Sesi:* ${sessions.length}\n\n`;

    sessions.forEach((session, index) => {
        message += `*Sesi ${index + 1}: ${session.Penerima}*\n`;
        message += `- Resi: ${session.NomorResi || 'Belum diisi'}\n`;
        message += `- Petugas: ${session.Petugas || '-'}\n`;
        const summaryUrl = `${window.location.origin}${window.location.pathname.replace('history.html', '')}public-summary.html?sessionId=${session.SessionID}`;

        message += `- Detail & Foto: ${summaryUrl}\n\n`;
    });

    return message;
}

/**
 * @param {string} dateKey 
 */
function handleBulkSendToWhatsApp(dateKey) {
    const sessionsOnDate = historyCache.filter(s => {
        const sessionDate = s.WaktuSelesai || s.WaktuDibuat;
        return new Date(sessionDate).toISOString().split('T')[0] === dateKey;
    });

    if (sessionsOnDate.length === 0) {
        alert("Tidak ada sesi untuk dikirim pada tanggal ini.");
        return;
    }

    let phone = prompt("Masukkan nomor WhatsApp tujuan (contoh: 081234567890):");
    if (!phone) return;

    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }

    const message = createBulkWhatsAppMessage(sessionsOnDate, dateKey);
    const encodedMessage = encodeURIComponent(message);

    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}


/**
 * @param {string} sessionId 
 * @param {HTMLElement} cardElement
 */
async function handleDeleteSession(sessionId, cardElement) {
    if (!confirm(`Anda yakin ingin menghapus sesi untuk "${cardElement.querySelector('h6').textContent}"? Tindakan ini tidak bisa dibatalkan.`)) {
        return;
    }
    cardElement.style.opacity = '0.5';

    try {
        const url = `${LINK_GAS}?type=delete_session&sessionId=${sessionId}`;
        const response = await fetch(url, { method: 'POST' });
        const result = await response.json();

        if (result.status !== 'success') {
            throw new Error(result.message);
        }

        cardElement.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        cardElement.style.transform = 'translateX(-100%)';
        cardElement.style.opacity = '0';

        setTimeout(() => {
            cardElement.closest('.accordion-item').remove(); 
            historyCache = historyCache.filter(s => s.SessionID !== sessionId);
        }, 300);

    } catch (error) {
        alert(`Gagal menghapus sesi: ${error.message}`);
        cardElement.style.opacity = '1';
    }
}

document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderHistory();

    const container = document.getElementById('history-list');
    let activeCard = null;
    let startX = 0;
    let currentX = 0;
    let isSwiping = false;

    container.addEventListener('touchstart', e => {
        const card = e.target.closest('.swipe-card');
        if (!card) return;

        activeCard = card;
        startX = e.touches[0].clientX;
        activeCard.style.transition = 'none'; 
    }, { passive: true });

    container.addEventListener('touchmove', e => {
        if (!activeCard) return;

        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        if (diff < 0 && diff > -85) {
            isSwiping = true;
            activeCard.style.transform = `translateX(${diff}px)`;
        }
    }, { passive: true });

    container.addEventListener('touchend', e => {
        if (!activeCard || !isSwiping) return;

        const diff = currentX - startX;
        activeCard.style.transition = 'transform 0.3s ease';

        if (diff < -40) {
            activeCard.style.transform = 'translateX(-80px)';
        } else {
            activeCard.style.transform = 'translateX(0)';
        }

        isSwiping = false;
        activeCard = null;
    }, { passive: true });

    // --- LOGIKA KLIK 
    container.addEventListener('click', e => {
        const deleteButton = e.target.closest('.swipe-delete-button');
        const card = e.target.closest('.swipe-card');

        if (deleteButton) {
            const sessionId = deleteButton.dataset.sessionId;
            const cardContainer = deleteButton.closest('.swipe-container');
            handleDeleteSession(sessionId, cardContainer);
            return;
        }

        if (card && !isSwiping) {
            const cardTransform = window.getComputedStyle(card).transform;
            if (cardTransform === 'none' || cardTransform === 'matrix(1, 0, 0, 1, 0, 0)') {
                window.location.href = card.dataset.href;
            } else {
                card.style.transform = 'translateX(0)';
            }
        }
    });

    const search = document.getElementById('historySearch');
    search.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        const filtered = historyCache.filter(s =>
            (s.NomorResi || '').toLowerCase().includes(q) ||
            s.Penerima.toLowerCase().includes(q) ||
            (s.Petugas || '-').toLowerCase().includes(q)
        );
        renderHistory(filtered);
    });

    container.addEventListener('click', (e) => {
        const whatsappButton = e.target.closest('.btn-send-group-whatsapp');
        if (whatsappButton) {
            const dateKey = whatsappButton.dataset.dateKey;
            handleBulkSendToWhatsApp(dateKey);
        }
    });
    updateResiNavBadge();
});

