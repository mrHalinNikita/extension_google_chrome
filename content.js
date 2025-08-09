let isTracking = false;
let sessionStart = null;
let sessionEnd = null;
let sessionData = [];
let userId = null;

// Генерация ID пользователя
function generateUserId() {
    return 'user_' + Math.random().toString(36).slice(2, 9);
}

// Восстановление состояния при загрузке
async function restoreState() {
    const result = await chrome.storage.local.get([
        'isTracking',
        'userId',
        'sessionStart',
        'sessionData'
    ]);

    if (result.isTracking && result.userId) {
        isTracking = true;
        userId = result.userId;
        sessionStart = result.sessionStart;
        sessionData = result.sessionData || [];

        // Восстанавливаем события
        startEventListeners();
        logAction('session_restored', {
            message: 'Сессия восстановлена после перезагрузки',
            url: window.location.href
        });
    }
}

// Обработчик сообщений
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'start-tracking') {
        if (!isTracking) {
            startTracking();
        }
        sendResponse({ status: 'tracking started', userId });
    } else if (request.action === 'stop-tracking') {
        if (isTracking) {
            stopTracking();
        }
        sendResponse({ status: 'tracking stopped' });
    }
    return true;
});

// Начало трекинга
function startTracking() {
    if (isTracking) return;

    isTracking = true;
    userId = userId || generateUserId();
    sessionStart = new Date().toISOString();
    sessionData = [];

    // Сохраняем состояние
    saveState();

    logAction('session_started', {
        message: 'Сессия началась',
        url: window.location.href
    });

    startEventListeners();
}

// Подписка на события
function startEventListeners() {
    document.addEventListener('click', handleClick);
    document.addEventListener('submit', handleSubmit);
    document.addEventListener('input', handleInput);
    window.addEventListener('popstate', handlePopState);

    // Переопределение pushState
    const originalPushState = history.pushState;
    history.pushState = function (...args) {
        originalPushState.apply(this, args);
        setTimeout(() => {
            logAction('navigation', {
                from: document.referrer || 'unknown',
                to: window.location.href,
                type: 'pushState'
            });
            saveState();
        }, 0);
    };
}

// Остановка трекинга
function stopTracking() {
    if (!isTracking) return;

    isTracking = false;
    sessionEnd = new Date().toISOString();

    logAction('session_stopped', {
        message: 'Сессия завершена',
        url: window.location.href
    });

    // Сохраняем итоговую сессию
    const session = {
        user_id: userId,
        session_start: sessionStart,
        session_end: sessionEnd,
        actions: sessionData
    };

    chrome.storage.local.set({
        isTracking: false,
        sessionEnd,
        lastSession: session
    }, () => {
        chrome.storage.local.get(['sessions'], (result) => {
            const sessions = result.sessions || [];
            sessions.push(session);
            chrome.storage.local.set({ sessions }, () => {
                console.log("Можете скачать сессию");
            });
        });
    });

    // Удаляем слушатели
    document.removeEventListener('click', handleClick);
    document.removeEventListener('submit', handleSubmit);
    document.removeEventListener('input', handleInput);
    window.removeEventListener('popstate', handlePopState);
}

// Логирование действий
function logAction(type, data) {
    const action = {
        type,
        timestamp: new Date().toISOString(),
        url: window.location.href,
        ...data
    };
    sessionData.push(action);
    saveState();
}

// Сохранение состояния в хранилище
function saveState() {
    chrome.storage.local.set({
        isTracking,
        userId,
        sessionStart,
        sessionData
    });
}

// Обработчики событий

function handleClick(e) {
    const target = e.target;
    const tagName = target.tagName;
    const role = target.getAttribute('role');
    const ariaLabel = target.getAttribute('aria-label');
    const text = (target.textContent || '').trim().substring(0, 100);
    const href = target.closest('a')?.href || null;

    let actionType = 'click';
    let details = {
        target: tagName,
        id: target.id,
        className: target.className.split(' ').filter(c => c).join(' '),
        text,
        ariaLabel,
        xpath: getXPath(target)
    };

    if (href) {
        actionType = 'navigation_click';
        details.href = href;
        details.linkText = text;
    }

    if (tagName === 'BUTTON' || role === 'button') {
        actionType = 'button_click';
    }

    logAction(actionType, details);
}

function handleSubmit(e) {
    logAction('form_submit', {
        formId: e.target.id,
        formName: e.target.name,
        action: e.target.action,
        method: e.target.method,
        xpath: getXPath(e.target),
        fieldCount: e.target.elements.length
    });
}

function handleInput(e) {
    const target = e.target;
    logAction('input_type', {
        target: target.tagName,
        name: target.name,
        id: target.id,
        type: target.type,
        value: (target.value || '').substring(0, 200),
        xpath: getXPath(target)
    });
}

function handlePopState() {
    logAction('navigation', {
        from: document.referrer || 'unknown',
        to: window.location.href,
        type: 'popstate'
    });
}

// Получение XPath
function getXPath(element) {
    if (!element || element.nodeType !== Node.ELEMENT_NODE) return '';
    if (element.id) return `//*[@id="${element.id}"]`;
    if (element === document.body) return '/html/body';
    if (element === document.documentElement) return '';

    const parent = element.parentNode;
    if (!parent) return '';

    let index = 0;
    for (let i = 0; i < parent.childNodes.length; i++) {
        const sibling = parent.childNodes[i];
        if (sibling === element) {
            const parentPath = getXPath(parent);
            return `${parentPath}/${element.tagName}[${index + 1}]`;
        }
        if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
            index++;
        }
    }
    return '';
}

// Сохранение сессии в файл
function saveSessionToFile(session) {
    try {
        const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `session_${userId}_${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        console.log('Сессия сохранена в файл:', session);
    } catch (err) {
        console.error('Ошибка при сохранении файла:', err);
    }
}

// Инициализация
restoreState().catch(console.error);