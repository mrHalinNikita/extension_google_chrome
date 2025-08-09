let startBtn, stopBtn, statusEl;

// Функция для обновления UI на основе состояния
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

function loadState() {
  chrome.storage.local.get(['isTracking'], (result) => {
    const isTracking = result.isTracking || false;
    updateUI(isTracking);
  });
}

function sendMessage(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    const tab = tabs[0];

    if (!tab.url || tab.url.startsWith('chrome://') || tab.url.startsWith('chrome-extension://')) {
      if (statusEl) {
        statusEl.textContent = "Ошибка: Нельзя на этой странице";
      }
      return;
    }

    chrome.tabs.sendMessage(tab.id, { action }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Ошибка отправки:", chrome.runtime.lastError.message);
        if (statusEl) {
          statusEl.textContent = "Ошибка: не удалось отправить";
        }
      } else {
        console.log("Команда отправлена:", action);
        // После отправки — обновляем состояние
        if (action === 'start-tracking') {
          updateUI(true);
        } else if (action === 'stop-tracking') {
          updateUI(false);
        }
      }
    });
  });
}

document.addEventListener('DOMContentLoaded', () => {
  startBtn = document.getElementById('startBtn');
  stopBtn = document.getElementById('stopBtn');
  statusEl = document.getElementById('status');

  loadState();

  startBtn.addEventListener('click', () => {
    sendMessage('start-tracking');
  });

  stopBtn.addEventListener('click', () => {
    sendMessage('stop-tracking');
  });

});