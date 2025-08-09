const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');

// Функция для обновления UI на основе состояния
function updateUI(isTracking) {
  if (isTracking) {
    startBtn.disabled = true;
    stopBtn.disabled = false;
    statusEl.textContent = "Запись: активна";
  } else {
    startBtn.disabled = false;
    stopBtn.disabled = true;
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

// Обработчики кнопок
startBtn.addEventListener('click', () => {
  sendMessage('start-tracking');
  updateUI(true);
});

stopBtn.addEventListener('click', () => {
  sendMessage('stop-tracking');
  updateUI(false);
});

document.addEventListener('DOMContentLoaded', loadState);