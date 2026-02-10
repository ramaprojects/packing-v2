

function getHistorySummary(s) {
  return {
    id: s.sessionId,
    date: s.createdAt || '-',
    totalItem: s.checklist?.length || 0,
    resi: s.resi?.number || '-'
  };
}


let historyCache = [];

function renderHistory(list = historyCache) {
  const container = document.getElementById('history-list');
  if (!container) return;

  if (!list.length) {
    container.innerHTML = '<p class="text-muted">Tidak ada history.</p>';
    return;
  }

  container.innerHTML = '';

  list.forEach(s => {
    const card = document.createElement('div');
    card.className = 'card shadow-sm mb-3';
    card.style.borderRadius = '14px';

    card.innerHTML = `
  <div class="card-body">

    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>Packing ${s.shipping.jenis} - ${s.shipping.penerima}</strong>
      <span class="badge bg-success-subtle text-success">
        ${getStatusLabel(s.status)}
      </span>
    </div>

    <!-- Content -->
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
        <div class="text-dark">${formatDate(s.finishedAt)}</div>
      </div>
    </div>

  </div>
`;

    card.addEventListener('click', () => {
      renderDetail(s);
    });

    container.appendChild(card);
  });
}

document.addEventListener('click', e => {
  const card = e.target.closest('.history-card');
  if (!card) return;

  const id = card.dataset.id;
  const session = loadAllSessions().find(s => s.sessionId === id);
  if (!session) return;

  renderDetail(session);
});

function renderDetail(s) {
  const historyPage = document.getElementById('historyPage');
  const detailPage = document.getElementById('detailPage');

  historyPage.classList.add('d-none');
  detailPage.classList.remove('d-none');

  detailPage.innerHTML = `
    <header class="sticky-top bg-white border-bottom p-3 d-flex align-items-center">
      <button class="btn btn-link me-2" onclick="backToHistory()">←</button>
      <strong>Packing Detail</strong>
    </header>

    <main class="container py-3">

      <!-- INFO CARD -->
      <div class="card mb-3 shadow-sm" style="border-radius:14px">
        <div class="card-body small">
          <div class="row mb-2">
            <div class="col-6 text-muted">Packing ID</div>
            <div class="col-6 text-end">${s.sessionId.slice(-6)}</div>
          </div>

          <div class="row mb-2">
            <div class="col-6 text-muted">Petugas</div>
            <div class="col-6 text-end">${s.operator || '-'}</div>
          </div>

          <div class="row mb-2">
            <div class="col-6 text-muted">Resi</div>
            <div class="col-6 text-end">${s.resi?.number || '-'}</div>
          </div>

          <div class="row mb-2">
            <div class="col-6 text-muted">Tanggal</div>
            <div class="col-6 text-end">${formatDate(s.finishedAt)}</div>
          </div>
        </div>
      </div>

      <!-- ITEMS -->
      <div class="card shadow-sm" style="border-radius:14px">
        <div class="card-body p-0">
          <div class="d-flex justify-content-between p-3 border-bottom fw-semibold">
            <span>Items</span>
            <span>QTY</span>
          </div>

          ${s.checklist.map(i => `
            <div class="d-flex justify-content-between align-items-center p-3 border-bottom">
              <div>${i.text || i}</div>
              <strong>✔</strong>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- PHOTO -->
      <div class="mt-3">
        ${s.resi?.photo
      ? `<img src="${s.resi.photoUrl}" class="img-fluid rounded">`
      : `<p class="text-muted text-center">Tidak ada foto resi</p>`
    }
      </div>

    </main>
  `;
}

function backToHistory() {
  document.getElementById('detailPage').classList.add('d-none');
  document.getElementById('historyPage').classList.remove('d-none');
}



document.addEventListener('DOMContentLoaded', () => {
  historyCache = loadAllSessions()
    .filter(s => s.status === 'finished')
    .sort((a, b) => b.finishedAt - a.finishedAt);

  renderHistory();

  const search = document.getElementById('historySearch');
  if (!search) return;

  search.addEventListener('input', e => {
    const q = e.target.value.toLowerCase();

    const filtered = historyCache.filter(s =>
      (s.resi?.number || '').toLowerCase().includes(q) ||
      formatDate(s.finishedAt || s.date).toLowerCase().includes(q) ||
      s.shipping.penerima.toLowerCase().includes(q) ||
      (s.operator || '-').toLowerCase().includes(q) ||
      s.shipping.jenis.toLowerCase().includes(q)
    );

    renderHistory(filtered);
  });
});

updateResiBadge();
updateResiNavBadge();