let isTracking = false;
let sessionData = [];

// Обработчик сообщений от popup
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

function startTracking() {
  isTracking = true;
  sessionData = [];
  logEvent('session_start', {});
  
  // Слушаем события
  document.addEventListener('click', handleEvent);
  document.addEventListener('input', handleEvent);
  document.addEventListener('mousemove', throttle(handleMouseMove, 100));
}

function stopTracking() {
  isTracking = false;
  logEvent('session_stop', {});
  
  // Удаляем слушатели
  document.removeEventListener('click', handleEvent);
  document.removeEventListener('input', handleEvent);
  document.removeEventListener('mousemove', handleMouseMove);
}

function handleEvent(e) {
  logEvent(e.type, {
    target: e.target.tagName,
    value: e.target.value || e.target.textContent,
    id: e.target.id,
    className: e.target.className,
    xpath: getXPath(e.target),
    timestamp: Date.now()
  });
}

function handleMouseMove(e) {
  logEvent('mousemove', {
    x: e.clientX,
    y: e.clientY,
    timestamp: Date.now()
  });
}

function logEvent(type, data) {
  sessionData.push({
    type,
    data
  });
}

// Утилита: получение XPath элемента
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
}

// Функция для ограничения частоты вызова (throttle)
function throttle(func, limit) {
  let inThrottle;
  return function () {
    const args = arguments;
    const context = this;
    if (!inThrottle) {
      func.apply(context, args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  }
}

// Пока сохраняем в консоль. Позже — в файл.
function saveSessionToFile() {
  const blob = new Blob([JSON.stringify(sessionData, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  console.log("Сессия сохранена:", sessionData);
}