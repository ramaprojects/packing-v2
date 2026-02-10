// GANTI SELURUH ISI history.js DENGAN INI

let historyCache = [];

function renderHistory(list = historyCache) {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="text-center text-muted mt-4">Tidak ada riwayat untuk ditampilkan.</p>';
    return;
  }

  container.innerHTML = '';

  list.forEach(s => {
    const cardLink = document.createElement('a');
    cardLink.className = 'card shadow-sm mb-3 text-decoration-none text-dark';
    cardLink.style.borderRadius = '14px';
    cardLink.href = `summary.html?sessionId=${s.sessionId}`;

    // --- PERUBAHAN DI SINI ---
    // Panggil fungsi terpusat untuk mendapatkan detail badge
    const badge = getStatusBadgeDetails(s.status);

    cardLink.innerHTML = `
      <div class="card-body">
        <div class="d-flex justify-content-between align-items-center mb-2">
          <strong class="text-truncate" style="max-width: 70%;">Packing ${s.shipping.jenis} - ${s.shipping.penerima}</strong>
          <span class="badge ${badge.className}">${badge.label}</span>
        </div>
        <div class="row small text-muted">
          <div class="col-6">
            <div>PIC Packing</div>
            <div class="text-dark fw-medium">${s.operator || '-'}</div>
            <div class="mt-2">Packing ID</div>
            <div class="text-dark">${s.sessionId.slice(-8)}</div>
          </div>
          <div class="col-6">
            <div>Resi</div>
            <div class="text-dark fw-medium">${s.resi?.number || '-'}</div>
            <div class="mt-2">Tanggal</div>
            <div class="text-dark">${formatDate(s.createdAt)}</div>
          </div>
        </div>
      </div>
    `;
    // --- AKHIR PERUBAHAN ---
    container.appendChild(cardLink);
  });
}


// Fungsi getHistorySummary dan listener klik global yang lama tidak lagi diperlukan
// dan dapat dihapus untuk menjaga kebersihan kode.

document.addEventListener('DOMContentLoaded', () => {
  // Memuat SEMUA sesi, tidak hanya yang 'finished' agar lebih fleksibel
  historyCache = loadAllSessions()
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)); // Sortir berdasarkan tanggal pembuatan

  renderHistory();

  const search = document.getElementById('historySearch');
  if (!search) return;

  search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();
    const filtered = historyCache.filter(s =>
      (s.resi?.number || '').toLowerCase().includes(q) ||
      formatDate(s.createdAt).toLowerCase().includes(q) ||
      s.shipping.penerima.toLowerCase().includes(q) ||
      (s.operator || '-').toLowerCase().includes(q) ||
      s.shipping.jenis.toLowerCase().includes(q)
    );
    renderHistory(filtered);
  });
});

// Panggil fungsi badge dari app.js
updateResiBadge();
updateResiNavBadge();

