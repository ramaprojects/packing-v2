

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
 * @param {Array} sessions
 */
function renderStats(sessions) {
    const pendingResiEl = document.getElementById('stat-pending-resi');
    const todayCountEl = document.getElementById('stat-today-count');
    const pendingResiCount = sessions.filter(s => s.Status === 'CHECKLIST_DONE').length;
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayCount = sessions.filter(s => {
        const finishedDate = s.WaktuSelesai ? new Date(s.WaktuSelesai) : null;
        return (s.Status === 'finished' || s.Status === 'SYNCED') && finishedDate && finishedDate >= todayStart;
    }).length;
    if (pendingResiEl) pendingResiEl.textContent = pendingResiCount;
    if (todayCountEl) todayCountEl.textContent = todayCount;
}


/**
 * @param {Array} sessions
 */
function renderRecentActivity(sessions) {
    const container = document.getElementById('recent-activity-list');
    if (!container) return;
    const recentSessions = sessions
        .sort((a, b) => new Date(b.WaktuDibuat) - new Date(a.WaktuDibuat))
        .slice(0, 3);
    if (recentSessions.length === 0) {
        container.innerHTML = '<p class="text-center text-muted p-4">Belum ada aktivitas.</p>';
        return;
    }

    container.innerHTML = '';

    recentSessions.forEach(session => {
        const badge = getStatusBadgeDetails(session.Status);
        
        const linkItem = document.createElement('a');
        linkItem.href = `summary.html?sessionId=${session.SessionID}`; 
        linkItem.className = 'list-group-item list-group-item-action';
        
        linkItem.innerHTML = `
            <div class="d-flex w-100 justify-content-between">
                <h6 class="mb-1 text-truncate">${session.Penerima}</h6>
                <small>${formatDate(session.WaktuDibuat)}</small>
            </div>
            <small class="mb-1 d-block">${session.JenisBarang || ''} - ${session.Platform || ''}</small>
            <span class="badge ${badge.className}">${badge.label}</span>
        `;
        container.appendChild(linkItem);
    });
}
