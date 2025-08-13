let startBtn, stopBtn, statusEl, sessionsList, clearBtn, downloadSelectedBtn, downloadAllBtn;

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

            const formattedDate = formatDate(session.session_start);
            const filenameSafeDate = formatDateForFilename(session.session_start);

            item.innerHTML = `
                <input 
                    type="checkbox" 
                    class="session-checkbox"
                    data-session-id="${session.user_id}" 
                    data-start="${session.session_start}"
                >
                <div class="session-info">
                    <div><strong>${formattedDate}</strong></div>
                    <div class="session-duration">${duration}</div>
                </div>
                <button class="download-btn" data-session-id="${session.user_id}" data-start="${session.session_start}">
                    Скачать
                </button>
            `;

            sessionsList.appendChild(item);
        });

    // Обработчики для чекбоксов
    const checkboxes = sessionsList.querySelectorAll('.session-checkbox');
    checkboxes.forEach(checkbox => {
        checkbox.addEventListener('change', updateDownloadSelectedButton);
    });

    // Обработчики для отдельной кнопки "Скачать"
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

    // Инициализация состояния кнопки
    updateDownloadSelectedButton();
}

function updateDownloadSelectedButton() {
    const checked = document.querySelectorAll('.session-checkbox:checked');
    downloadSelectedBtn.disabled = checked.length === 0;
}

// Скачать сессию
function downloadSession(session) {
    const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
    const filename = `session_${session.user_id}_${formatDateForFilename(session.session_start)}.json`;
    downloadBlob(blob, filename);
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

async function downloadAllSessions() {
    const result = await chrome.storage.local.get(['sessions']);
    const sessions = result.sessions || [];

    if (sessions.length === 0) {
        alert('Нет сессий для скачивания');
        return;
    }

    const zip = new JSZip();

    sessions.forEach((session, index) => {
        const filename = `session_${session.user_id}_${formatDateForFilename(session.session_start)}.json`;
        zip.file(filename, JSON.stringify(session, null, 2));
    });

    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `sessions_archive_${Date.now()}.zip`);
    } catch (err) {
        console.error('Ошибка при создании архива:', err);
        alert('Не удалось создать архив');
    }
}

async function downloadSelectedSessions() {
    const checkedBoxes = sessionsList.querySelectorAll('input[type="checkbox"]:checked');
    if (checkedBoxes.length === 0) {
        alert('Выберите хотя бы одну сессию');
        return;
    }

    const zip = new JSZip();

    for (const checkbox of checkedBoxes) {
        const userId = checkbox.dataset.sessionId;
        const start = checkbox.dataset.start;

        const result = await chrome.storage.local.get(['sessions']);
        const sessions = result.sessions || [];
        const session = sessions.find(s => s.user_id === userId && s.session_start === start);

        if (session) {
            const filename = `session_${session.user_id}_${formatDateForFilename(session.session_start)}.json`;
            zip.file(filename, JSON.stringify(session, null, 2));
        }
    }

    try {
        const blob = await zip.generateAsync({ type: 'blob' });
        downloadBlob(blob, `selected_sessions_${Date.now()}.zip`);
    } catch (err) {
        console.error('Ошибка при создании архива:', err);
        alert('Не удалось создать архив');
    }
}

function formatDateForFilename(isoString) {
    return new Date(isoString).toISOString().replace(/[:.]/g, '-').slice(0, -5);
}

function downloadBlob(blob, filename) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    startBtn = document.getElementById('startBtn');
    stopBtn = document.getElementById('stopBtn');
    statusEl = document.getElementById('status');
    sessionsList = document.getElementById('sessionsList');
    clearBtn = document.getElementById('clearSessions');
    downloadSelectedBtn = document.getElementById('downloadSelected');
    downloadAllBtn = document.getElementById('downloadAll');

    loadTrackingState();
    loadSessions();

    clearBtn.addEventListener('click', () => {
        chrome.storage.local.get(['sessions'], (result) => {
            const sessions = result.sessions || [];

            if (sessions.length === 0) {
                alert('История уже очищена');
                return;
            }

            const confirmed = confirm('Вы уверены, что хотите удалить все сессии? Это действие нельзя отменить.');
            if (confirmed) {
                chrome.storage.local.set({ sessions: [] }, () => {
                    renderSessions([]);
                    console.log('История сессий очищена');
                });
            }
        });
    });

    startBtn.addEventListener('click', () => {
        sendMessage('start-tracking');
    });

    stopBtn.addEventListener('click', () => {
        sendMessage('stop-tracking');
    });

    downloadSelectedBtn.addEventListener('click', downloadSelectedSessions);
    downloadAllBtn.addEventListener('click', downloadAllSessions);
});