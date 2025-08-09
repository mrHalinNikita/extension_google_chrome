let startBtn, stopBtn, statusEl;

// Функция для обновления UI на основе состояния
function updateUI(isTracking) {
  if (!statusEl) return;

  if (isTracking) {
    if (startBtn) startBtn.disabled = true;
    if (stopBtn) stopBtn.disabled = false;
    statusEl.textContent = "Запись: активна";
  } else {
    if (startBtn) startBtn.disabled = false;
    if (stopBtn) stopBtn.disabled = true;
    statusEl.textContent = "Запись: остановлена";
  }
}

function loadState() {
  chrome.storage.local.get(['isTracking'], (result) => {
    const isTracking = result.isTracking || false;
    updateUI(isTracking);
  });
}

function sendMessage(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Ошибка:", chrome.runtime.lastError.message);
        statusEl.textContent = "Ошибка: не удалось отправить команду";
      } else {
        console.log("Команда отправлена:", action);
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  statusEl = document.getElementById('status');

  startBtn.addEventListener('click', () => {
    sendMessage('start-tracking');
    updateUI(true);
  });

  stopBtn.addEventListener('click', () => {
    sendMessage('stop-tracking');
    updateUI(false);
  });

  loadState();
});