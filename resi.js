
/**
 * @param {object} session
 */
async function syncSessionToServer(session) {
    try {
        const url = LINK_GAS + '?type=sync_session';

        const response = await fetch(url, {
            method: 'POST',
            mode: 'cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8',
            },
            body: JSON.stringify(session)
        });

        if (!response.ok) {
            throw new Error(`Server merespons dengan status: ${response.status}`);
        }

        const result = await response.json();
        if (result.status === 'success') {
            console.log('Sinkronisasi sesi berhasil:', session.sessionId);
            const all = loadAllSessions();
            const index = all.findIndex(s => s.sessionId === session.sessionId);
            if (index > -1) {
                all[index].status = 'SYNCED';
                saveAllSessions(all);
            }
        } else {
            throw new Error(result.message || 'Sinkronisasi gagal di sisi server.');
        }
    } catch (error) {
        console.error('Sinkronisasi sesi gagal:', error);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const summaryEl = document.getElementById('resi-summary');
    const panelEl = document.getElementById('resi-panel');
    const overlayEl = document.getElementById('resi-panel-overlay');
    const titleEl = document.getElementById('resi-title');
    const shippingSummaryEl = document.getElementById('resi-shipping-summary');
    const photoPreviewEl = document.getElementById('resi-photo-preview');

    const inputResi = document.getElementById('input-resi-number');
    const btnFinish = document.getElementById('btn-finish-resi');
    const btnClosePanel = document.getElementById('btn-close-panel');
    const btnUploadResi = document.getElementById('btn-upload-resi');
    const inputUploadResi = document.getElementById('input-upload-resi');

    let currentSessionId = null;
    let resiPhotoFile = null;

    function showResiPanel() {
        panelEl.classList.add('show');
        overlayEl.classList.remove('d-none');
        overlayEl.classList.add('show');
        document.body.style.overflow = 'hidden';
    }

    function hideResiPanel() {
        panelEl.classList.remove('show');
        overlayEl.classList.remove('show');
        setTimeout(() => {
            overlayEl.classList.add('d-none');
        }, 300);
        document.body.style.overflow = 'auto';

        currentSessionId = null;
        resiPhotoFile = null;
        inputResi.value = '';
        inputUploadResi.value = '';
        photoPreviewEl.classList.add('d-none');
        photoPreviewEl.src = '#';
    }

    btnClosePanel?.addEventListener('click', hideResiPanel);
    overlayEl?.addEventListener('click', hideResiPanel);

    // === RENDER QUEUE ===
    function getQueue() {
        return loadAllSessions().filter(s => s.status === 'CHECKLIST_DONE');
    }

    function renderQueue() {
        const queue = getQueue();
        summaryEl.innerHTML = '';
        if (!queue.length) {
            summaryEl.innerHTML = `<div class="text-center text-muted p-5">Belum ada antrian untuk diisi resi.</div>`;
            return;
        }
        queue.forEach(session => {
            const card = document.createElement('div');
            card.className = 'card shadow-sm';
            card.innerHTML = `
                <div class="card-body">
                    <div class="d-flex justify-content-between align-items-center mb-2">
                        <strong>${session.shipping.jenis} - ${session.shipping.penerima}</strong>
                        <span class="badge ${getStatusBadgeDetails(session.status).className}">${getStatusBadgeDetails(session.status).label}</span>
                    </div>
                    <div class="row small text-muted mb-3">
                        <div class="col-4"><div>PIC Packing</div><div class="text-dark fw-medium">${session.operator || '-'}</div></div>
                        <div class="col-4"><div>Packing ID</div><div class="text-dark">${session.sessionId.slice(-8)}</div></div>
                        <div class="col-4"><div>Tanggal</div><div class="text-dark">${formatDate(session.createdAt)}</div></div>
                    </div>
                    <div class="d-grid"><button class="btn btn-primary btn-resi-action" data-session-id="${session.sessionId}">Input Resi</button></div>
                </div>
            `;
            summaryEl.appendChild(card);
        });
    }

    // === BUKA PANEL ===
    summaryEl.addEventListener('click', (e) => {
        const actionButton = e.target.closest('.btn-resi-action');
        if (!actionButton) return;
        currentSessionId = actionButton.dataset.sessionId;
        const session = getQueue().find(s => s.sessionId === currentSessionId);
        if (!session) return;
        titleEl.textContent = `Input Resi untuk ${session.shipping.penerima}`;
        shippingSummaryEl.innerHTML = `<strong>${session.shipping.platform}</strong> - ${session.shipping.jenis}<div class="small text-muted">Oleh: ${session.operator}</div>`;
        updateFinishButton();
        showResiPanel();
    });

    // === VALIDATION ===
    function updateFinishButton() {
        const hasResi = inputResi.value.trim() !== '';
        const hasPhoto = !!resiPhotoFile;
        btnFinish.disabled = !(hasResi && hasPhoto);
    }
    inputResi.addEventListener('input', updateFinishButton);
    btnUploadResi.addEventListener('click', () => inputUploadResi.click());
    inputUploadResi.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        resiPhotoFile = file;
        const reader = new FileReader();
        reader.onload = (event) => {
            photoPreviewEl.src = event.target.result;
            photoPreviewEl.classList.remove('d-none');
        };
        reader.readAsDataURL(file);
        updateFinishButton();
    });

   /* ===============================
       4. FINISH RESI
    =============================== */
    btnFinish.addEventListener('click', async () => {
        if (!currentSessionId) return;

        const fileToUpload = resiPhotoFile;
        const sessionIdToUpdate = currentSessionId;
        const resiNumber = inputResi.value.trim();

        showLoading();
        hideResiPanel();

        let sessionToSync = null; 

        const all = loadAllSessions();
        const sessionIndex = all.findIndex(s => s.sessionId === sessionIdToUpdate);
        if (sessionIndex < 0) {
            hideLoading();
            return;
        }

        all[sessionIndex].resi.number = resiNumber;
        all[sessionIndex].status = 'finished';
        all[sessionIndex].finishedAt = new Date().toISOString();
        
        sessionToSync = all[sessionIndex];
        saveAllSessions(all);

        if (fileToUpload) {
            try {
                const { photoUrl } = await uploadPhoto({
                    sessionId: sessionIdToUpdate,
                    type: 'resi',
                    resiNumber,
                    file: fileToUpload,
                    penerima: sessionToSync.shipping.penerima 
                });

                const currentSessions = loadAllSessions();
                const finalIndex = currentSessions.findIndex(s => s.sessionId === sessionIdToUpdate);
                if (finalIndex >= 0) {
                    currentSessions[finalIndex].resi.photoUrl = photoUrl;
                    sessionToSync = currentSessions[finalIndex];
                    saveAllSessions(currentSessions);
                }
            } catch (err) {
                console.error('Upload foto resi gagal:', err);
                alert('Gagal mengunggah foto resi, namun data nomor resi sudah tersimpan.');
            }
        }
        
        hideLoading();

        if (sessionToSync) {
            syncSessionToServer(sessionToSync); 
        }

        renderQueue();
        updateResiBadge();
        updateResiNavBadge();
    });

    function showLoading() { document.getElementById('loading-overlay')?.classList.remove('d-none'); }
    function hideLoading() { document.getElementById('loading-overlay')?.classList.add('d-none'); }

    renderQueue();
    updateResiBadge();
    updateResiNavBadge();
});
