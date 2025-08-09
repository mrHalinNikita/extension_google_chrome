// Получаем элементы
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const status = document.getElementById('status');

// Отправляем сообщение в content script
function sendMessage(action) {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action }, (response) => {
      if (chrome.runtime.lastError) {
        console.error("Ошибка отправки сообщения:", chrome.runtime.lastError.message);
        status.textContent = "Ошибка: страница не поддерживается";
      } else {
        console.log("Сообщение отправлено:", response);
      }
    });
  });
}

// Кнопка "Начать"
startBtn.addEventListener('click', () => {
  sendMessage('start-tracking');
  startBtn.disabled = true;
  stopBtn.disabled = false;
  status.textContent = "Запись: активна";
});

// Кнопка "Остановить"
stopBtn.addEventListener('click', () => {
  sendMessage('stop-tracking');
  stopBtn.disabled = true;
  startBtn.disabled = false;
  status.textContent = "Запись: остановлена";
});