document.addEventListener('DOMContentLoaded', () => {
    const allSessions = loadAllSessions();
    const lastOperator = localStorage.getItem(LAST_OPERATOR_KEY);
    const welcomeEl = document.getElementById('welcome-message');
    if (lastOperator && welcomeEl) {
        welcomeEl.querySelector('h5').textContent = `Selamat datang, ${lastOperator}!`;
    }

    renderStats(allSessions);
    renderRecentActivity(allSessions);
    updateResiNavBadge();
});

/**
 * Menghitung dan menampilkan statistik utama di kartu.
 * @param {Array} sessions - Array semua sesi packing.
 */
function renderStats(sessions) {
    const pendingResiEl = document.getElementById('stat-pending-resi');
    const todayCountEl = document.getElementById('stat-today-count');

    // 1. Hitung sesi yang menunggu resi
    const pendingResiCount = sessions.filter(s => s.status === 'CHECKLIST_DONE').length;

    // 2. Hitung sesi yang selesai hari ini
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const todayCount = sessions.filter(s => {
        const finishedDate = new Date(s.finishedAt || s.updatedAt);
        return (s.status === 'finished' || s.status === 'SYNCED') && finishedDate >= todayStart;
    }).length;

    // Tampilkan di HTML
    if (pendingResiEl) pendingResiEl.textContent = pendingResiCount;
    if (todayCountEl) todayCountEl.textContent = todayCount;
}


function renderRecentActivity(sessions) {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;

    const recentSessions = sessions
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
        .slice(0, 3);

    if (recentSessions.length === 0) {
        container.innerHTML = '<p class="text-center text-muted p-4">Belum ada aktivitas.</p>';
        return;
    }

    container.innerHTML = '';

    recentSessions.forEach(session => {
        // --- PERUBAHAN DI SINI ---
        // Panggil fungsi terpusat untuk mendapatkan detail badge
        const badge = getStatusBadgeDetails(session.status);
        
        const linkItem = document.createElement('a');
        linkItem.href = `summary.html?sessionId=${session.sessionId}`;
        linkItem.className = 'list-group-item list-group-item-action';
        
        // Gunakan properti .label dan .className dari objek badge
        linkItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-truncate">${session.shipping.penerima}</h6>
                <small>${formatDate(session.createdAt)}</small>
            </div>
            <small class="mb-1 d-block">${session.shipping.jenis} - ${session.shipping.platform}</small>
            <span class="badge ${badge.className}">${badge.label}</span>
        `;
        // --- AKHIR PERUBAHAN ---
        container.appendChild(linkItem);
    });
}

