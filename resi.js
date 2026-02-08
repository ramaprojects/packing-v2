document.addEventListener('DOMContentLoaded', () => {
  const summaryEl = document.getElementById('resi-summary');
  const panelEl = document.getElementById('resi-panel');
  const titleEl = document.getElementById('resi-title');
  const inputResi = document.getElementById('input-resi-number');
  const btnFinish = document.getElementById('btn-finish-resi');
  const btnBack = document.getElementById('btn-back-resi');
  const btnUploadResi = document.getElementById('btn-upload-resi');
  const inputUploadResi = document.getElementById('input-upload-resi');

  btnBack?.addEventListener('click', () => {
    clearCurrentSession();

    panelEl.classList.add('d-none');
    summaryEl.classList.remove('d-none');

    inputResi.value = '';
    btnFinish.disabled = true;
  });

  /* ===============================
     1. LOAD QUEUE
  =============================== */
  function getQueue() {
    return loadAllSessions().filter(
      s => s.status === 'CHECKLIST_DONE'
    );
  }

  /* ===============================
     2. RENDER QUEUE
  =============================== */
  function renderQueue() {
    const queue = getQueue();
    summaryEl.innerHTML = '';

    if (!queue.length) {
      summaryEl.innerHTML =
        `<div class="text-muted">Belum ada checklist</div>`;
      return;
    }

    queue.forEach(session => {
      const card = document.createElement('div');
      card.className = 'card mb-2';
      card.className = 'card shadow-sm';
      card.style.borderRadius = '14px';

      card.innerHTML = `
  <div class="card-body">

    <!-- Header -->
    <div class="d-flex justify-content-between align-items-center mb-2">
      <strong>${session.shipping.jenis} - ${session.shipping.penerima}</strong>
      <span class="badge bg-danger-subtle text-danger">
        ${getStatusLabel(session.status)}
      </span>
    </div>

    <!-- Content -->
    <div class="row small text-muted mb-3">
      <div class="col-4">
        <div>PIC Packing</div>
        <div class="text-dark fw-medium">${session.operator || '-'}</div>
      </div>

      <div class="col-4">
      <div>Packing ID</div>
      <div class="text-dark">${session.sessionId.slice(-8)}</div>
      </div>

      <div class="col-4">
        <div>Tanggal</div>
        <div class="text-dark">${formatDate(session.createdAt)}</div>
      </div>
    </div>

    <!-- Action -->
    <div class="d-flex justify-content-end">
      <button
        class="btn btn-sm btn-primary btn-resi-action"
        data-session-id="${session.sessionId}">
        Input Resi
      </button>
    </div>

  </div>
`;


      card
        .querySelector('button')
        .addEventListener('click', () => {
          openResiPanel(session.sessionId);
        });

      summaryEl.appendChild(card);
    });
  }

  /* ===============================
     3. OPEN PANEL
  =============================== */
  function openResiPanel(sessionId) {
    const all = loadAllSessions();
    const session = all.find(s => s.sessionId === sessionId);
    if (!session) return;

    saveCurrentSession(session);

    summaryEl.classList.add('d-none');
    panelEl.classList.remove('d-none');

    titleEl.textContent =
      `${session.shipping.penerima} - ${session.shipping.jenis}`;

    inputResi.value = '';
    btnFinish.disabled = true;
  }

  /* ===============================
     4. VALIDATION
  =============================== */

  function updateFinishButton() {
    const hasResi = inputResi.value.trim() !== '';
    const hasPhoto = !!resiPhotoFile;

    btnFinish.disabled = !(hasResi && hasPhoto);
  }

  inputResi.addEventListener('input', () => {
    updateFinishButton();
  });

  let resiPhotoFile = null;

  btnUploadResi.addEventListener('click', () => {
    inputUploadResi.click();
  });


  inputUploadResi.addEventListener('change', e => {
    const file = e.target.files[0];
    resiPhotoFile = file || null;

    updateFinishButton();
  });

  /* ===============================
     5. FINISH RESI
  =============================== */
  btnFinish.addEventListener('click', async () => {
    const session = loadCurrentSession();
    if (!session) return;

    const resiNumber = inputResi.value.trim();
    if (!resiNumber) return;

    session.resi.number = resiNumber;
    session.status = 'RESI_DONE';
    session.updatedAt = now();

    const all = loadAllSessions();
    const idx = all.findIndex(s => s.sessionId === session.sessionId);
    if (idx >= 0) {
        all[idx] = session;
        all[idx].status = 'finished';
        all[idx].finishedAt = Date.now();
        saveAllSessions(all);
    }

    clearCurrentSession();
    showLoading();

    // update UI cepat
    panelEl.classList.add('d-none');
    summaryEl.classList.remove('d-none');
    renderQueue();
    updateResiBadge();

    // upload foto dan tunggu sampai selesai
    if (resiPhotoFile) {
        try {
            const { photoUrl } = await uploadPhoto({
                sessionId: session.sessionId,
                type: 'resi',
                resiNumber,
                file: resiPhotoFile
            });

            // update session history
            const allSessions = loadAllSessions();
            const idx2 = allSessions.findIndex(s => s.sessionId === session.sessionId);
            if (idx2 >= 0) {
                allSessions[idx2].resi.photoUrl = photoUrl;
                allSessions[idx2].status = 'finished';
                saveAllSessions(allSessions);
            }
        } catch (err) {
            console.error('Upload resi gagal', err);
            // session tetap valid, hanya foto yang pending
        }
    }

    // setelah upload selesai baru hide spinner & redirect
    hideLoading();
    window.location.href = 'history.html';
});



  function showLoading() {
    document.getElementById('loading-overlay').classList.remove('d-none');
  }

  function hideLoading() {
    document.getElementById('loading-overlay').classList.add('d-none');
  }

  /* ===============================
     INIT
  =============================== */
  renderQueue();
  updateResiBadge();
  updateResiNavBadge();
});

