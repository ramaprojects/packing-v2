/*********************************
 * 1. KONSTANTA & KONFIGURASI
 *********************************/
const STORAGE_KEY = 'packing_sessions';
const CURRENT_SESSION_KEY = 'current_session';
let currentSessionId = null;

/*********************************
 * 2. UTIL UMUM
 *********************************/
function generateUUID() {
    return crypto.randomUUID();
}

function now() {
    return new Date().toISOString();
}

function formatDate(isoString) {
    if (!isoString) return '-';

    const d = new Date(isoString);

    return d.toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
    });
}

function formatDateTime(isoString) {
    if (!isoString) return '-';

    const d = new Date(isoString);

    return d.toLocaleString('id-ID', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
}

async function compressImage(file, maxWidth = 1280, quality = 0.7) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        const reader = new FileReader();

        reader.onload = e => {
            img.src = e.target.result;
        };

        img.onload = () => {
            const scale = Math.min(1, maxWidth / img.width);
            const canvas = document.createElement('canvas');
            canvas.width = img.width * scale;
            canvas.height = img.height * scale;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

            canvas.toBlob(
                blob => {
                    if (!blob) reject('Compress failed');
                    resolve(blob);
                },
                'image/jpeg',
                quality
            );
        };

        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function countPendingResi() {
    return loadAllSessions().filter(s =>
        s.status === 'CHECKLIST_DONE' &&
        (!s.resi || !s.resi.number)
    ).length;
}

function updateResiBadge() {
    const badge = document.getElementById('resi-badge');
    if (!badge) return;

    const count = countPendingResi();

    if (count > 0) {
        badge.textContent = count;
        badge.classList.remove('d-none');
    } else {
        badge.classList.add('d-none');
    }
}

function updateResiNavBadge() {
    const badge = document.getElementById('resi-badge-nav');
    if (!badge) return;

    const count = countPendingResi();
    badge.textContent = count;
    badge.classList.toggle('d-none', count === 0);
}

/*********************************
 * 3. NAV GLOBAL
 *********************************/
document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-nav]');
    if (!btn) return;

    const target = btn.dataset.nav;

    if (target === 'checklist') { window.location.href = 'index.html'; }
    if (target === 'resi') { window.location.href = 'resi.html'; }
    if (target === 'history') { window.location.href = 'history.html'; }
});

/*********************************
 * 3. STATE STORAGE (localStorage)
 *********************************/
function loadAllSessions() {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
}

function saveAllSessions(sessions) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
}

function loadCurrentSession() {
    return JSON.parse(localStorage.getItem(CURRENT_SESSION_KEY));
}

function saveCurrentSession(session) {
    localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(session));
}

function clearCurrentSession() {
    localStorage.removeItem(CURRENT_SESSION_KEY);
}

/*********************************
 * 4. SESSION FACTORY
 *********************************/
function createNewSession(shipping) {
    return {
        sessionId: generateUUID(),
        shipping,
        checklist: [],
        resi: { number: null, photoId: null },
        progress: 0,
        status: 'DRAFT',
        // DRAFT | CHECKLIST_DONE | finished 
        createdAt: now(),
        updatedAt: now()
    };
}

function getStatusLabel(status) {
    const map = {
        DRAFT: 'Draft',
        CHECKLIST_DONE: 'Belum ada resi',
        finished: 'Resi Terisi',
        SYNCED: 'Terkirim'
    };

    return map[status] || status;
}


/*********************************
 * 5. CHECKLIST GENERATOR
 *********************************/
function generateChecklistByJenis(jenis) {
    const MAP = {
        T1: ['EDC', 'Banner', 'Sertifikat', 'Layanan QRIS', 'QRIS', 'Thermal'],
        T3: ['EDC', 'Banner', 'Sertifikat', 'Layanan QRIS', 'QRIS', 'Thermal'],
        M3: ['EDC', 'Banner', 'Sertifikat', 'Thermal'],
        ARRANET: ['EDC'],
        USER: ['EDC'],
        Thermal: ['Thermal Paper']
    };

    const items = MAP[jenis] || [];

    return items.map(label => ({
        id: label.toLowerCase(),
        label,
        photoId: null,
        photoFile: null
    }));
}

const platformSelect = document.getElementById('input-platform');
const jenisSelect = document.getElementById('input-jenis');

const allJenisOptions = [...jenisSelect.options];
const defaultOption = allJenisOptions[0];

jenisSelect.disabled = true;

platformSelect.addEventListener('change', () => {
    const value = platformSelect.value;

    jenisSelect.disabled = !value;

    let newOptions;

    if (value === 'Retur') {
        newOptions = allJenisOptions.filter(opt => ['ARRANET', 'USER'].includes(opt.value));
    } else if (value === 'Aplikasi') {
        newOptions = allJenisOptions.filter(opt => ['T1', 'T3', 'M3'].includes(opt.value));
    } else if (value === 'TikTok') {
        newOptions = allJenisOptions.filter(opt => ['T1', 'T3', 'M3', 'Thermal'].includes(opt.value));
    } else if (value === 'Shopee') {
        newOptions = allJenisOptions.filter(opt => ['T1', 'T3', 'M3', 'Thermal'].includes(opt.value));
    } else {
        newOptions = [];
    }

    jenisSelect.innerHTML = '';
    jenisSelect.append(defaultOption, ...newOptions);
    jenisSelect.value = '';
});

/*********************************
 * 5.1 STATE MUTATION
 *********************************/
function updateSession(mutator) {
    const session = loadCurrentSession();
    if (!session) return;

    mutator(session);
    session.updatedAt = now();
    saveCurrentSession(session);
}

/*********************************
 * 6. PROGRESS & VALIDATION
 *********************************/
function calculateProgress(list) {
    if (!list.length) return 0;
    const done = list.filter(i => i.photoId).length;
    return Math.round((done / list.length) * 100);
}


/*********************************
 * 9. PERSIST LIST
 *********************************/
function persistSession() {
    const all = loadAllSessions();
    const cur = loadCurrentSession();
    if (!cur) return;

    const idx = all.findIndex(s => s.sessionId === cur.sessionId);
    if (idx >= 0) all[idx] = cur;
    else all.push(cur);

    saveAllSessions(all);
}

/*********************************
 * 8. FASE TRANSITION
 *********************************/
function startChecklist(shipping) {
    const session = createNewSession(shipping);
    const operatorInput = document.getElementById('operatorName');
    session.operator = operatorInput?.value?.trim() || '-';
    session.checklist = generateChecklistByJenis(shipping.jenis);
    saveCurrentSession(session);
}

function finishChecklist() {
    updateSession(session => {
        session.status = 'CHECKLIST_DONE';
        session.progress = 100;
    });
    persistSession();
}

/*********************************
 * 9. SESSION LIST (QUEUE & HISTORY)
 *********************************/

// function getChecklistQueue() {
//     return loadAllSessions().filter(s => s.status === 'CHECKLIST_DONE');
// }

// function getHistory() {
//     return loadAllSessions().filter(s => s.status === 'SYNCED');
// }

/*********************************
 * 10. PAGE INIT
 *********************************/

document.addEventListener('DOMContentLoaded', () => {

    // ===== DOM REFERENCES =====
    const phaseInput = document.getElementById('phase-input');
    const phaseChecklist = document.getElementById('phase-checklist');
    const headerDefault = document.getElementById('header-default');
    const headerChecklist = document.getElementById('header-checklist');
    const checklistFooter = document.getElementById('checklist-footer');
    const checklistContainer = document.getElementById('checklist-container');
    const progressBar = document.getElementById('checklist-progress');
    const btnStart = document.getElementById('btn-start-checklist');
    const btnFinish = document.getElementById('btn-finish-checklist');
    const btnBack = document.getElementById('btn-back-checklist');
    const inputResi = document.getElementById('input-resi-number');

    // inputs
    const inputPetugas = document.getElementById('operatorName');
    const inputPenerima = document.getElementById('input-penerima');
    const inputPlatform = document.getElementById('input-platform');
    const inputJenis = document.getElementById('input-jenis');

    if (!phaseInput || !phaseChecklist) return;

    // ===== MODAL =====
    const cancelModalEl = document.getElementById('cancelModal');
    const cancelModal = cancelModalEl
        ? new bootstrap.Modal(cancelModalEl)
        : null;

    // ==== UI HELPERS ====
    function goToInputPhase() {
        phaseChecklist.classList.add('d-none');
        checklistFooter.classList.add('d-none');
        headerChecklist.classList.add('d-none');

        phaseInput.classList.remove('d-none');
        headerDefault.classList.remove('d-none');
    }

    function goToChecklist() {
        phaseInput.classList.add('d-none');
        headerDefault.classList.add('d-none');

        phaseChecklist.classList.remove('d-none');
        headerChecklist.classList.remove('d-none');
        checklistFooter.classList.remove('d-none');
    }

    function fillChecklistHeader() {
        const session = loadCurrentSession();
        if (!session) return;

        headerChecklist.querySelector('span').textContent =
            `Checklist ${session.shipping.jenis} ${session.shipping.penerima}`;

        headerChecklist.querySelector('small').textContent =
            `${session.shipping.petugas}`;
    }

    function fillShippingSummary() {
        const s = loadCurrentSession();
        const el = document.getElementById('summary-shipping');
        if (!s || !el) return;

        el.innerHTML = `
                <span>${s.shipping.petugas}</span>
                <span>${s.shipping.penerima}</span>
                <span>${s.shipping.platform}</span>
                <span>${s.shipping.jenis}</span>
        `;
    }

    function renderChecklist() {
        const s = loadCurrentSession();
        if (!s || !checklistContainer) return;

        checklistContainer.innerHTML = '';
        s.checklist.forEach((item, idx) => {
            const hasPhoto = item.photoFile || item.photoId;
            const card = document.createElement('div');
            card.className = `card mb-2 ${hasPhoto ? 'border-success' : ''}`;
            card.style.background = hasPhoto ? '#f6fffa' : '';
            card.innerHTML = `
            <div class="card-body d-flex align-items-center gap-3">
                <div class="flex-grow-1">
                    <div class="d-flex align-items-center gap-2">

                        <div class="flex-grow-1">
                            <div>
                                <div class="fw-semibold">${item.label}</div>
                                <small class="text-muted">
                                   ${hasPhoto ? 'Foto OK' : 'Upload foto'}
                                </small>
                            </div>
                        </div>

                        ${item.photoId ? `

                <img
                    src="${item.photoId}"
                    class="rounded border"
                    style="width:48px;height:48px;object-fit:cover"
                />
                ` : ''}

                <input
                    type="file"
                    accept="image/*"    
                    capture="environment"
                    class="d-none checklist-photo"
                    data-index="${idx}"
                    ${item.photoId ? 'disabled' : ''}
                />

                <button
                    class="btn btn-sm ${hasPhoto ? 'btn-success' : 'btn-outline-secondary'} btn-upload-photo"
                    data-index="${idx}"
                    ${hasPhoto ? 'disabled' : ''}>
                        📷
  </button>

</div>

        </div>`;
            checklistContainer.appendChild(card);
        });
    }

    checklistContainer.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-upload-photo');
        if (!btn) return;

        const idx = Number(btn.dataset.index);
        const session = loadCurrentSession();
        if (!session) return;

        if (session.checklist[idx].photoId) return;

        const input = checklistContainer.querySelector(
            `.checklist-photo[data-index="${idx}"]`
        );
        input.click();
    });

    checklistContainer.addEventListener('change', async (e) => {
        if (!e.target.matches('.checklist-photo')) return;

        const idx = Number(e.target.dataset.index);
        const file = e.target.files[0];
        if (!file) return;

        updateSession(s => {
            if (s.checklist[idx].photoId) return;
            s.checklist[idx].photoFile = file;
        });

        renderChecklist();
        updateProgressUI();
        validateFinish();

        // Upload async (background)
        try {
            const session = loadCurrentSession();
            const { photoUrl } = await uploadPhoto({
                sessionId: session.sessionId,
                type: 'checklist',
                item: session.checklist[idx].id,
                file
            });

            updateSession(s => {
                s.checklist[idx].photoId = photoUrl;
                s.checklist[idx].photoFile = null; // optional
                s.progress = calculateProgress(s.checklist);
            });

        } catch (err) {
            console.error('Upload checklist gagal', err);
        }
    });

    function updateProgressUI() {
        const session = loadCurrentSession();
        if (!session || !progressBar) return;
        progressBar.style.width = `${session.progress}%`;
    }

    function validateFinish() {
        const s = loadCurrentSession();
        if (!s || !btnFinish) return;
    }

    // ===== VALIDATION =====
    function validateInputPhase() {
        const valid =
            inputPetugas.value.trim() !== '' &&
            inputPenerima.value.trim() !== '' &&
            inputPlatform.value !== '' &&
            inputJenis.value !== '';

        btnStart.disabled = !valid;
    }

    [inputPetugas, inputPenerima, inputPlatform, inputJenis].forEach(el => {
        el.addEventListener('input', validateInputPhase);
        el.addEventListener('change', validateInputPhase);
    });

    // ===== START =====
    btnStart?.addEventListener('click', () => {
        startChecklist({
            petugas: inputPetugas.value.trim(),
            penerima: inputPenerima.value.trim().toUpperCase(),
            platform: inputPlatform.value,
            jenis: inputJenis.value
        });

        goToChecklist();
        fillChecklistHeader();
        renderChecklist();
        updateProgressUI();
        validateFinish();
        fillShippingSummary()
    });

    // ===== FINISH =====
    btnFinish?.addEventListener('click', () => {
        showLoading();
        finishChecklist();

        setTimeout(() => {
            hideLoading();
            window.location.href = 'resi.html';
        }, 3000);
    });

    function showLoading() {
        document.getElementById('loading-overlay').classList.remove('d-none');
    }

    function hideLoading() {
        document.getElementById('loading-overlay').classList.add('d-none');
    }

    // ===== CANCEL =====
    btnBack?.addEventListener('click', () => {
        cancelModal?.show();
    });

    document
        .getElementById('confirm-cancel')
        ?.addEventListener('click', () => {
            clearCurrentSession();
            cancelModal?.hide();
            goToInputPhase();
        });

    // ===== RESUME =====
    const session = loadCurrentSession();
    if (session?.status === 'DRAFT') {
        goToChecklist();
        fillChecklistHeader();
        fillShippingSummary();
        renderChecklist();
        updateProgressUI();
        validateFinish();
    }

});


async function uploadPhoto({ sessionId, type, item, resiNumber, file }) {
    const base64 = await fileToBase64(file);

    const form = new FormData();
    form.append('sessionId', sessionId);
    form.append('type', type);
    form.append('item', item || '');
    form.append('resiNumber', resiNumber || '');
    form.append('filename', file.name);
    form.append('mimeType', file.type);
    form.append('base64', base64);

    const res = await fetch('https://script.google.com/macros/s/AKfycbyTAe8m4utEzs8QK9WhfUkyFaeDTTa2dq0uO-G5ipK5GitOJUibnntSEMN8htcHPssS/exec', {
        method: 'POST',
        body: form
    });

    const photoUrl = await res.text();
    return { photoUrl };
}


function fileToBase64(file) {
    return new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () =>
            resolve(reader.result.split(',')[1]);
        reader.readAsDataURL(file);
    });
}

updateResiBadge();
updateResiNavBadge();



