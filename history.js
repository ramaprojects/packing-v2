// Mempertahankan pola caching Anda yang efisien
let historyCache = [];

async function fetchAndRenderHistory() {
    const container = document.getElementById('history-list');
    const emptyView = document.getElementById('history-empty');
    const searchInput = document.getElementById('historySearch');

    // Tampilkan status "Memuat..."
    container.innerHTML = `<p class="text-center text-muted mt-5">Memuat riwayat dari server...</p>`;
    container.classList.remove('d-none');
    emptyView.classList.add('d-none');
    searchInput.disabled = true;

    try {
        // Asumsi LINK_GAS didefinisikan di app.js
        const response = await fetch('https://script.google.com/macros/s/AKfycbzOG14sXeZYe50c7IBgleSUHfe5SYt38NfSVhvtoTlrTkORFdv23LU99oPiZERSOoHS/exec'); 
        if (!response.ok) throw new Error(`Server Error: ${response.statusText}`);
        
        const result = await response.json();
        if (result.status !== 'success') throw new Error(result.message);

        // Simpan ke localStorage (untuk diakses oleh halaman summary.html)
        saveAllSessions(result.data);

        // --- PERUBAHAN: Menyesuaikan dengan format data dari server ---
        historyCache = result.data.sort((a, b) => {
            const dateA = a.WaktuSelesai || a.WaktuDibuat;
            const dateB = b.WaktuSelesai || b.WaktuDibuat;
            return new Date(dateB) - new Date(dateA);
        });

        // Render tampilan dengan data baru
        renderHistory();

    } catch (error) {
        console.error("Gagal memuat riwayat dari server:", error);
        container.innerHTML = `<p class="text-center text-danger mt-5">Gagal memuat riwayat. Periksa koneksi dan coba lagi.</p>`;
    } finally {
        searchInput.disabled = false;
    }
}


// === FUNGSI BARU: renderHistory ditulis ulang sepenuhnya ===
function renderHistory(list = historyCache) {
    const container = document.getElementById('history-list');
    const emptyView = document.getElementById('history-empty');
    if (!container || !emptyView) return;

    // 1. Tampilkan pesan kosong jika tidak ada data sama sekali
    if (!list.length) {
        container.classList.add('d-none');
        emptyView.classList.remove('d-none');
        // Sesuaikan pesan berdasarkan apakah ini hasil pencarian atau tidak
        const isSearching = document.getElementById('historySearch').value !== '';
        emptyView.querySelector('h5').textContent = isSearching ? 'Tidak Ditemukan' : 'Belum Ada Riwayat';
        emptyView.querySelector('p').textContent = isSearching 
            ? 'Tidak ada riwayat yang cocok dengan pencarian Anda.'
            : 'Mulai sesi packing baru untuk melihat riwayat di sini.';
        return;
    }

    // Sembunyikan pesan kosong jika ada data
    container.classList.remove('d-none');
    emptyView.classList.add('d-none');
    container.innerHTML = '';

    // 2. Kelompokkan sesi berdasarkan tanggal (inti dari perubahan)
    const groupedByDate = list.reduce((acc, session) => {
        const groupDate = session.WaktuSelesai || session.WaktuDibuat; 
        const dateKey = new Date(groupDate).toISOString().split('T')[0];
        
        if (!acc[dateKey]) acc[dateKey] = [];
        acc[dateKey].push(session);
        return acc;
    }, {});

    // 3. Render setiap grup tanggal sebagai item accordion
    Object.keys(groupedByDate).forEach((dateKey, index) => {
        const sessionsOnDate = groupedByDate[dateKey];
        const isFirstGroup = index === 0; // Buka grup pertama secara default
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

// === FUNGSI BARU: Membuat kartu sesi yang lebih ringkas ===
function createSessionCard(session) {
    // --- PERUBAHAN: Menyesuaikan dengan format data dari server ---
    const badge = getStatusBadgeDetails(session.Status); 
    return `
        <a href="summary.html?sessionId=${session.SessionID}" class="list-group-item list-group-item-action">
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-truncate fw-semibold">${session.Penerima}</h6>
                <small class="text-muted">${new Date(session.WaktuDibuat).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
            <small class="mb-1 d-block text-muted">${session.JenisBarang} - ${session.Platform}</small>
            <span class="badge ${badge.className}">${badge.label}</span>
        </a>
    `;
}

// Di dalam file: history.js (di luar fungsi lain)

/**
 * Membuat pesan WhatsApp massal dari beberapa sesi.
 * @param {Array} sessions - Daftar sesi untuk tanggal tertentu.
 * @param {string} dateKey - Kunci tanggal (YYYY-MM-DD).
 * @returns {string} - Pesan teks yang diformat.
 */
function createBulkWhatsAppMessage(sessions, dateKey) {
    // ... (Fungsi ini juga perlu di-update)
    const formattedDate = new Date(dateKey).toLocaleDateString('id-ID', { /* ... */ });
    let message = `*Laporan Harian Packing - ${formattedDate}*\n*Total Sesi:* ${sessions.length}\n\n`;

    sessions.forEach((session, index) => {
        message += `*Sesi ${index + 1}: ${session.Penerima}*\n`;
        message += `- Resi: ${session.NomorResi || 'Belum diisi'}\n`;
        message += `- Petugas: ${session.Petugas || '-'}\n`;
        const summaryUrl = `${window.location.origin}${window.location.pathname.replace('history.html', '')}summary.html?sessionId=${session.SessionID}`;
        message += `- Detail & Foto: ${summaryUrl}\n\n`;
    });
    return message;
}

/**
 * Handler utama untuk pengiriman laporan harian ke WhatsApp.
 * @param {string} dateKey - Kunci tanggal (YYYY-MM-DD) dari grup yang dipilih.
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

    // 2. Minta nomor telepon tujuan
    let phone = prompt("Masukkan nomor WhatsApp tujuan (contoh: 081234567890):");
    if (!phone) return; // Pengguna membatalkan

    if (phone.startsWith('0')) {
        phone = '62' + phone.substring(1);
    }
    
    // 3. Buat pesan massal dan lakukan encoding
    const message = createBulkWhatsAppMessage(sessionsOnDate, dateKey);
    const encodedMessage = encodeURIComponent(message);

    // 4. Buka URL WhatsApp
    const whatsappUrl = `https://wa.me/${phone}?text=${encodedMessage}`;
    window.open(whatsappUrl, '_blank');
}

// === DOMContentLoaded: Menggunakan struktur Anda yang sudah ada ===
document.addEventListener('DOMContentLoaded', () => {
    fetchAndRenderHistory();

const search = document.getElementById('historySearch');
    search.addEventListener('input', e => {
        const q = e.target.value.toLowerCase();
        // --- PERUBAHAN: Menyesuaikan dengan format data dari server ---
        const filtered = historyCache.filter(s =>
            (s.NomorResi || '').toLowerCase().includes(q) ||
            s.Penerima.toLowerCase().includes(q) ||
            (s.Petugas || '-').toLowerCase().includes(q)
        );
        renderHistory(filtered);
    });


    const container = document.getElementById('history-list');
    container.addEventListener('click', (e) => {
        // Cari tombol WhatsApp terdekat yang di-klik
        const whatsappButton = e.target.closest('.btn-send-group-whatsapp');
        if (whatsappButton) {
            // Dapatkan kunci tanggal dari data-attribute
            const dateKey = whatsappButton.dataset.dateKey;
            handleBulkSendToWhatsApp(dateKey);
        }
    });
    // Panggilan ini tetap relevan
    updateResiNavBadge();
});

