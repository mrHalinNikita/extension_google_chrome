let startBtn, stopBtn, statusEl, sessionsList;

// UI
function updateUI(isTracking) {
    if (!statusEl) return;

    if (isTracking) {
        startBtn.disabled = true;
        stopBtn.disabled = false;
        statusEl.textContent = "Запись: активна";
        statusEl.classList.add("active");
    } else {
        startBtn.disabled = false;
        stopBtn.disabled = true;
        statusEl.textContent = "Запись: остановлена";
        statusEl.classList.remove("active");
    }
}

// Загрузка состояния трекинга
function loadTrackingState() {
    chrome.storage.local.get(['isTracking'], (result) => {
        const isTracking = result.isTracking || false;
        updateUI(isTracking);
    });
}

// Загрузка списка сессий
function loadSessions() {
    chrome.storage.local.get(['sessions'], (result) => {
        const sessions = result.sessions || [];
        renderSessions(sessions);
    });
}

// Отображение сессий
function renderSessions(sessions) {
    sessionsList.innerHTML = '';

    if (sessions.length === 0) {
        const emptyMsg = document.createElement('p');
        emptyMsg.className = 'empty-message';
        emptyMsg.textContent = 'Сессии не найдены';
        sessionsList.appendChild(emptyMsg);
        return;
    }

    // Сортируем по дате
    sessions
        .sort((a, b) => new Date(b.session_start) - new Date(a.session_start))
        .forEach(session => {
            const duration = formatDuration(
                new Date(session.session_end) - new Date(session.session_start)
            );

            const item = document.createElement('div');
            item.className = 'session-item';

            item.innerHTML = `
                <div class="session-info">
                    <div><strong>${formatDate(session.session_start)}</strong></div>
                    <div class="session-duration">${duration}</div>
                </div>
                <button class="download-btn" data-session-id="${session.user_id}" data-start="${session.session_start}">
                    Скачать
                </button>
            `;

            sessionsList.appendChild(item);
        });

    document.querySelectorAll('.download-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const userId = btn.dataset.sessionId;
            const start = btn.dataset.start;

            chrome.storage.local.get(['sessions'], (result) => {
                const sessions = result.sessions || [];
                const session = sessions.find(s => s.user_id === userId && s.session_start === start);
                if (session) {
                    downloadSession(session);
                }
            });
        });
    });
}

// Скачать сессию
function downloadSession(session) {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `session_${session.user_id}_${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function formatDate(isoString) {
    return new Date(isoString).toLocaleString('ru-RU', {
        day: '2-digit',
        month: '2-digit',
        year: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
    });
}

function formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}м ${secs}с`;
}

function sendMessage(action) {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        const tab = tabs[0];

        if (!tab || !tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
            statusEl.textContent = "Ошибка: Нельзя на этой странице";
            return;
        }

        chrome.tabs.sendMessage(tab.id, { action }, (response) => {
            if (chrome.runtime.lastError) {
                console.error("Ошибка отправки:", chrome.runtime.lastError.message);
                statusEl.textContent = "Ошибка: не удалось отправить";
                return;
            }

            if (action === 'start-tracking') {
                updateUI(true);
            } else if (action === 'stop-tracking') {
                updateUI(false);
                // После остановки — перезагружаем список сессий
                setTimeout(loadSessions, 100);
            }
        });
    });
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    statusEl = document.getElementById('status');
    sessionsList = document.getElementById('sessionsList');

    loadTrackingState();
    loadSessions();

    startBtn.addEventListener('click', () => {
        sendMessage('start-tracking');
    });

    stopBtn.addEventListener('click', () => {
        sendMessage('stop-tracking');
    });
});