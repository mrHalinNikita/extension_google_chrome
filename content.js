let isTracking = false;
let sessionStart = null;
let sessionEnd = null;
let sessionData = [];
let userId = null;

function generateUserId() {
  return 'user_' + Math.random().toString(36).substr(2, 9);
}

// Обработчик сообщений из popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'start-tracking') {
    if (!isTracking) {
      startTracking();
      sendResponse({ status: 'tracking started' });
    }
  } else if (request.action === 'stop-tracking') {
    if (isTracking) {
      stopTracking();
      saveSessionToFile();
    }
    sendResponse({ status: 'tracking stopped' });
  }
  return true;
});

// Начало записи
function startTracking() {
  isTracking = true;
  userId = userId || generateUserId();
  sessionStart = new Date().toISOString();
  sessionData = [];

  logAction('session_started', {
    message: 'Сессия началась',
    url: window.location.href
  });

  // Подписываемся на события
  document.addEventListener('click', handleClick);
  document.addEventListener('submit', handleSubmit);
  document.addEventListener('input', handleInput);

  // Отслеживаем смену URL
  const originalPushState = history.pushState;
  history.pushState = function (...args) {
    originalPushState.apply(this, args);
    setTimeout(() => {
      logAction('navigation', {
        from: document.referrer || 'unknown',
        to: window.location.href,
        type: 'pushState'
      });
    }, 0);
  };

  window.addEventListener('popstate', () => {
    logAction('navigation', {
      from: document.referrer || 'unknown',
      to: window.location.href,
      type: 'popstate'
    });
  });
}

// Остановка записи
function stopTracking() {
  if (!isTracking) return;
  isTracking = false;
  sessionEnd = new Date().toISOString();

  logAction('session_stopped', {
    message: 'Сессия завершена',
    url: window.location.href
  });

  // Удаляем слушатели
  document.removeEventListener('click', handleClick);
  document.removeEventListener('submit', handleSubmit);
  document.removeEventListener('input', handleInput);
}

// Логирование действий
function logAction(type, data) {
  sessionData.push({
    type,
    timestamp: new Date().toISOString(),
    url: window.location.href,
    ...data
  });
}

// Обработчики событий

// Клик
function handleClick(e) {
  const target = e.target;
  const tagName = target.tagName;
  const role = target.getAttribute('role');
  const ariaLabel = target.getAttribute('aria-label');
  const text = target.textContent.trim().substring(0, 100);
  const href = target.closest('a')?.href || null;

  let actionType = 'click';
  let details = {
    target: tagName,
    id: target.id,
    className: target.className,
    text,
    xpath: getXPath(target)
  };

  // Если это ссылка — это переход
  if (href) {
    actionType = 'navigation_click';
    details = {
      ...details,
      href,
      linkText: text,
      target: target.tagName
    };
  }

  // Если это кнопка
  if (tagName === 'BUTTON' || role === 'button') {
    actionType = 'button_click';
  }

  logAction(actionType, details);
}

// Отправка формы
function handleSubmit(e) {
  logAction('form_submit', {
    formId: e.target.id,
    formName: e.target.name,
    action: e.target.action,
    method: e.target.method,
    xpath: getXPath(e.target)
  });
}

// Ввод текста
function handleInput(e) {
  const target = e.target;
  logAction('input_type', {
    target: target.tagName,
    name: target.name,
    id: target.id,
    value: target.value.substring(0, 200),
    xpath: getXPath(target)
  });
}

// Получение XPath элемента
function getXPath(element) {
  if (element.id) return `//*[@id="${element.id}"]`;
  if (element === document.body) return '/html/body';

  let ix = 0;
  const siblings = element.parentNode.childNodes;
  for (let i = 0; i < siblings.length; i++) {
    const sibling = siblings[i];
    if (sibling === element) {
      return `${getXPath(element.parentNode)}/${element.tagName}[${ix + 1}]`;
    }
    if (sibling.nodeType === 1 && sibling.tagName === element.tagName) {
      ix++;
    }
  }
  return '';
}

// Сохранение сессии в JSON 
function saveSessionToFile() {
  const session = {
    user_id: userId,
    session_start: sessionStart,
    session_end: sessionEnd,
    actions: sessionData
  };

  const blob = new Blob([JSON.stringify(session, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session_${userId}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  console.log('Сессия сохранена:', session);
}