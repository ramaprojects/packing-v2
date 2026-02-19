/*********************************
 * 1. KONSTANTA & KONFIGURASI
 *********************************/
const STORAGE_KEY = 'packing_sessions';
const CURRENT_SESSION_KEY = 'current_session';
const LAST_OPERATOR_KEY = 'last_operator_name';
const LINK_GAS = 'https://script.google.com/macros/s/AKfycbyYBeQTh9s42llNfpTFqJxjQKxyKWmrF51VWbGPIX46D6P7UmFTMgnoPMYvXcMb96rv/exec'
let currentSessionId = null;
let isFinishingProcess = false;
let fileBuffer = {};

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

function getStatusBadgeDetails(status) {
    const MAP = {
        DRAFT: {
            label: 'Draft',
            className: 'bg-secondary-subtle text-secondary'
        },
        CHECKLIST_DONE: {
            label: 'Belum Ada Resi',
            className: 'bg-danger-subtle text-danger' // Merah: butuh tindakan
        },
        finished: {
            label: 'Resi Terisi',
            className: 'bg-primary-subtle text-primary' // Biru: proses berjalan
        },
        SYNCED: {
            label: 'Terkirim',
            className: 'bg-success-subtle text-success' // Hijau: selesai
        }
    };

    const defaultDetails = {
        label: status,
        className: 'bg-light text-dark'
    };

    return MAP[status] || defaultDetails;
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

    if (target === 'dashboard') { window.location.href = 'index.html'; }
    if (target === 'checklist') { window.location.href = 'checklist.html'; }
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
        resi: { number: null, photoUrl: null },
        progress: 0,
        status: 'DRAFT',
        createdAt: now(),
        updatedAt: now()
    };
}

function getStatusLabel(status) {
    return getStatusBadgeDetails(status).label;
}

/*********************************
 * 5. CHECKLIST GENERATOR
 *********************************/
function generateChecklistByJenis(jenis) {
    const MAP = {
        T1: ['EDC', 'Banner', 'Sertifikat', 'Layanan QRIS', 'QRIS', 'Thermal', 'Hardbox'],
        T3: ['EDC', 'Banner', 'Sertifikat', 'Layanan QRIS', 'QRIS', 'Thermal', 'Hardbox'],
        M3: ['EDC', 'Banner', 'Sertifikat', 'Thermal', 'Hardbox'],
        ARRANET: ['EDC'],
        USER: ['EDC'],
        ARAHNETS: ['EDC'],
        MPN: ['EDC'],
        Thermal: ['Thermal Paper'],
        Kaos: ['Kaos']
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
        newOptions = allJenisOptions.filter(opt => ['ARRANET', 'USER', 'ARAHNETS', 'MPN'].includes(opt.value));
    } else if (value === 'Aplikasi') {
        newOptions = allJenisOptions.filter(opt => ['T1', 'T3', 'M3'].includes(opt.value));
    } else if (value === 'TikTok') {
        newOptions = allJenisOptions.filter(opt => ['T1', 'T3', 'M3', 'Thermal', 'Kaos'].includes(opt.value));
    } else if (value === 'Shopee') {
        newOptions = allJenisOptions.filter(opt => ['T1', 'T3', 'M3', 'Thermal', 'Kaos'].includes(opt.value));
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
    const done = list.filter(i => i.photoId || i.hasPendingFile).length;
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

    if (inputPetugas) {
        // Muat nama yang terakhir disimpan dari localStorage
        const lastOperator = localStorage.getItem(LAST_OPERATOR_KEY);
        if (lastOperator) {
            inputPetugas.value = lastOperator;
            // PENTING: Panggil validasi agar tombol 'Start' bisa langsung aktif
            validateInputPhase();
        }
    }

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
            const hasPhoto = item.hasPendingFile || item.photoId;
            const imgSrc = item.photoId || item.photoPreviewUrl;

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

                        ${imgSrc ? `

                <img
                    src="${imgSrc}"
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

        const session = loadCurrentSession();
        const itemId = session.checklist[idx].id;

        fileBuffer[itemId] = file;

        const previewUrl = URL.createObjectURL(file);

        updateSession(s => {
            const item = s.checklist[idx];
            if (item.photoId) return;

            item.photoPreviewUrl = previewUrl;
            item.hasPendingFile = true;
            s.progress = calculateProgress(s.checklist);
        });

        renderChecklist();
        // validateFinish();
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
        const operatorName = inputPetugas.value.trim();
        localStorage.setItem(LAST_OPERATOR_KEY, operatorName);
        startChecklist({
            petugas: operatorName,
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
    btnFinish?.addEventListener('click', async () => {
        isFinishingProcess = true;
        showLoading();

        try {
            const session = loadCurrentSession();
            const itemsToUpload = session.checklist.filter(item => item.hasPendingFile && !item.photoId);

            if (itemsToUpload.length > 0) {
                const uploadPromises = itemsToUpload.map(item => {
                    const fileToUpload = fileBuffer[item.id];

                    if (!fileToUpload) {
                        throw new Error(`File untuk item ${item.id} tidak ditemukan di buffer.`);
                    }

                    return uploadPhoto({
                        sessionId: session.sessionId,
                        type: 'checklist',
                        item: item.id,
                        file: fileToUpload,
                        penerima: session.shipping.penerima
                    });
                });

                const uploadResults = await Promise.all(uploadPromises);

                updateSession(s => {
                    uploadResults.forEach(result => {
                        const sessionItem = s.checklist.find(i => i.id === result.item);
                        if (sessionItem && result?.photoUrl) {
                            sessionItem.photoId = result.photoUrl;
                            URL.revokeObjectURL(sessionItem.photoPreviewUrl);
                            sessionItem.photoPreviewUrl = null;
                            sessionItem.hasPendingFile = false;
                        }
                    });
                });
            }

            finishChecklist();
            fileBuffer = {};
            window.location.href = 'resi.html';

        } catch (error) {
            console.error('Proses upload massal gagal:', error);
            alert('Gagal mengunggah foto. Silakan periksa koneksi dan coba lagi.');
            isFinishingProcess = false;
            hideLoading();
        }
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

    document.getElementById('confirm-cancel')?.addEventListener('click', () => {
        const session = loadCurrentSession();
        if (session?.checklist) {
            session.checklist.forEach(item => {
                if (item.photoPreviewUrl) {
                    URL.revokeObjectURL(item.photoPreviewUrl);
                }
            });
        }

        fileBuffer = {};
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



async function uploadPhoto({ sessionId, type, item, penerima, resiNumber, file }) {

    try {
        console.log(`Mulai kompresi untuk item ${item}, ukuran asli: ${(file.size / 1024).toFixed(2)} KB`);
        const compressedBlob = await compressImage(file);
        console.log(`Kompresi selesai untuk item ${item}, ukuran baru: ${(compressedBlob.size / 1024).toFixed(2)} KB`);

        const base64 = await fileToBase64(compressedBlob);

        const form = new FormData();
        form.append('sessionId', sessionId);
        form.append('type', type);
        form.append('item', item || '');
        form.append('resiNumber', resiNumber || '');
        form.append('penerima', penerima || '');
        form.append('filename', file.name);
        form.append('mimeType', compressedBlob.type);
        form.append('base64', base64);

        const res = await fetch(LINK_GAS, {
            method: 'POST',
            body: form
        });

        if (!res.ok) {
            const errorText = await res.text();
            throw new Error(`Gagal upload ke server: ${res.status} - ${errorText}`);
        }

        const result = await res.json();
        const photoUrl = result.photoUrl;

        if (!photoUrl) {
            throw new Error("Server tidak mengembalikan photoUrl di dalam respons JSON.");
        }

        return { photoUrl, item: item };

    } catch (error) {
        console.error(`Gagal upload foto untuk item ${item}:`, error);

        throw error;
    }
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




