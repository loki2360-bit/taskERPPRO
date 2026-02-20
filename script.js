// Константы
const SECRET_COMMAND = 'loyalty42'; // Секретная команда для сотрудников
const POINTS_PER_PURCHASE = 100;
const REWARD_THRESHOLD = 1000;
const STORAGE_KEY_CLIENTS = 'loyalty_clients';
const STORAGE_KEY_TRANSACTIONS = 'loyalty_transactions';
const STORAGE_KEY_REWARDS = 'loyalty_rewards';

// Проверка поддержки localStorage
if (typeof(Storage) === "undefined") {
  alert("Ваш браузер не поддерживает localStorage. Программа лояльности работать не будет.");
}

// Инициализация хранилища
function initStorage() {
  if (!localStorage.getItem(STORAGE_KEY_CLIENTS)) {
    localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEY_TRANSACTIONS)) {
    localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify([]));
  }
  if (!localStorage.getItem(STORAGE_KEY_REWARDS)) {
    localStorage.setItem(STORAGE_KEY_REWARDS, JSON.stringify([]));
  }
}

// Получение данных из хранилища
function getClients() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_CLIENTS)) || [];
}

function getTransactions() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_TRANSACTIONS)) || [];
}

function getRewards() {
  return JSON.parse(localStorage.getItem(STORAGE_KEY_REWARDS)) || [];
}

// Сохранение данных
function saveClients(clients) {
  localStorage.setItem(STORAGE_KEY_CLIENTS, JSON.stringify(clients));
}

function saveTransactions(transactions) {
  localStorage.setItem(STORAGE_KEY_TRANSACTIONS, JSON.stringify(transactions));
}

function saveRewards(rewards) {
  localStorage.setItem(STORAGE_KEY_REWARDS, JSON.stringify(rewards));
}

// Генерация 4-значного ID
function generateClientId() {
  let clientId;
  let exists = true;
  const clients = getClients();
  
  while (exists) {
    clientId = Math.floor(1000 + Math.random() * 9000).toString();
    exists = clients.some(client => client.id === clientId);
  }
  
  return clientId;
}

// Генерация промокода
function generatePromoCode() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Регистрация нового клиента
function registerClient() {
  const name = document.getElementById('client-name').value.trim();
  if (!name) {
    showResult('Введите ваше имя', 'error');
    return;
  }

  try {
    const clientId = generateClientId();
    const clients = getClients();
    
    // Добавляем нового клиента
    clients.push({
      id: clientId,
      name: name,
      balance: 0,
      createdAt: new Date().toISOString()
    });
    
    saveClients(clients);
    
    // Показываем результат
    const resultHTML = `
      <div class="result success">
        <strong>Регистрация успешна!</strong><br>
        Ваш номер: <span style="font-weight:bold; font-size:1.2em">${clientId}</span>
        Сохраните его для проверки баланса
      </div>
    `;
    document.getElementById('registration-result').innerHTML = resultHTML;
    document.getElementById('client-name').value = '';
    
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    showResult('Ошибка регистрации. Попробуйте позже.', 'error');
  }
}

// Проверка баланса клиента
function checkBalance() {
  const clientId = document.getElementById('client-id-input').value.trim();
  if (!/^\d{4}$/.test(clientId)) {
    showResult('Введите корректный 4-значный номер', 'error');
    return;
  }

  try {
    const clients = getClients();
    const client = clients.find(c => c.id === clientId);
    
    if (!client) {
      showResult('Клиент не найден', 'error');
      return;
    }

    // Проверяем наличие неиспользованных промокодов
    const rewards = getRewards();
    const activeReward = rewards.find(r => r.clientId === clientId && !r.redeemed);

    // Формируем отображение баланса
    let balanceHTML = `
      <strong>Баланс:</strong> ${client.balance} из ${REWARD_THRESHOLD}
      <div class="progress-bar">
        <div class="progress" style="width: ${Math.min(client.balance / REWARD_THRESHOLD * 100, 100)}%"></div>
      </div>
    `;

    if (activeReward) {
      balanceHTML += `
        <div class="promo-code">
          Ваш промокод: <strong>${activeReward.code}</strong><br>
          Используйте его при следующей покупке
        </div>
      `;
    }

    document.getElementById('balance-display').innerHTML = balanceHTML;
    
  } catch (error) {
    console.error('Ошибка проверки баланса:', error);
    showResult('Ошибка при проверке баланса', 'error');
  }
}

// Активация режима сотрудника
function activateStaffMode() {
  if (document.getElementById('secret-command').value === SECRET_COMMAND) {
    document.getElementById('staff-controls').classList.remove('hidden');
    document.getElementById('secret-command').value = '';
    showResult('Режим сотрудника активирован', 'success');
  } else {
    showResult('Неверная команда', 'error');
  }
}

// Загрузка истории клиента
function loadClientHistory() {
  const clientId = document.getElementById('staff-client-id').value.trim();
  if (!/^\d{4}$/.test(clientId)) {
    showResult('Введите корректный 4-значный номер', 'error');
    return;
  }

  try {
    const clients = getClients();
    const client = clients.find(c => c.id === clientId);
    
    if (!client) {
      showResult('Клиент не найден', 'error');
      return;
    }

    // Загружаем историю транзакций
    const transactions = getTransactions().filter(tx => tx.clientId === clientId);
    
    // Формируем отображение истории
    let historyHTML = `
      <h3>Клиент: ${client.name} (Баланс: ${client.balance})</h3>
      <ul>
    `;

    if (transactions.length > 0) {
      transactions.slice(0, 20).forEach(tx => {
        const date = new Date(tx.timestamp).toLocaleString('ru-RU', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit',
          hour: '2-digit',
          minute: '2-digit'
        });
        
        historyHTML += `
          <li>
            <strong>${date}</strong> - 
            ${tx.points > 0 ? '+' : ''}${tx.points} баллов 
            (${tx.type === 'purchase' ? 'Покупка' : 
              tx.type === 'reward' ? 'Скидка' : 'Сброс'})
          </li>
        `;
      });
    } else {
      historyHTML += `<li>История операций пуста</li>`;
    }

    historyHTML += '</ul>';
    document.getElementById('client-history').innerHTML = historyHTML;
    
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
    showResult('Ошибка при загрузке истории', 'error');
  }
}

// Добавление транзакции
function addTransaction(clientId, points, type) {
  const transactions = getTransactions();
  transactions.push({
    clientId: clientId,
    points: points,
    type: type,
    timestamp: new Date().toISOString()
  });
  saveTransactions(transactions);
}

// Начисление баллов
function addPoints() {
  const clientId = document.getElementById('staff-client-id').value.trim();
  if (!/^\d{4}$/.test(clientId)) {
    showResult('Сначала загрузите историю клиента', 'error');
    return;
  }

  try {
    const clients = getClients();
    const clientIndex = clients.findIndex(c => c.id === clientId);
    
    if (clientIndex === -1) {
      showResult('Клиент не найден', 'error');
      return;
    }

    // Обновляем баланс
    const client = clients[clientIndex];
    client.balance += POINTS_PER_PURCHASE;
    let promoCode = null;
    
    // Проверяем достижение порога
    if (client.balance >= REWARD_THRESHOLD) {
      // Генерируем уникальный промокод
      const rewards = getRewards();
      do {
        promoCode = generatePromoCode();
      } while (rewards.some(r => r.code === promoCode));
      
      // Сохраняем промокод
      rewards.push({
        clientId: clientId,
        code: promoCode,
        redeemed: false,
        createdAt: new Date().toISOString()
      });
      saveRewards(rewards);
      
      // Сбрасываем баланс
      client.balance = 0;
      
      // Добавляем транзакцию сброса
      addTransaction(clientId, -REWARD_THRESHOLD, 'reset');
    }
    
    // Сохраняем обновленные данные
    clients[clientIndex] = client;
    saveClients(clients);
    
    // Добавляем запись в историю
    addTransaction(clientId, POINTS_PER_PURCHASE, 'purchase');
    
    // Обновляем историю
    loadClientHistory();
    
    // Показываем результат
    if (promoCode) {
      showResult(`Начислено! Промокод сгенерирован: ${promoCode}`, 'success');
    } else {
      showResult(`Начислено ${POINTS_PER_PURCHASE} баллов`, 'success');
    }
    
  } catch (error) {
    console.error('Ошибка начисления баллов:', error);
    showResult('Ошибка при начислении баллов', 'error');
  }
}

// Вспомогательные функции
function showResult(message, type = 'info') {
  const resultDiv = document.createElement('div');
  resultDiv.className = `result ${type}`;
  resultDiv.textContent = message;
  
  // Очищаем предыдущие сообщения
  const resultContainer = document.getElementById('registration-result');
  resultContainer.innerHTML = '';
  resultContainer.appendChild(resultDiv);
  
  // Автоматическое исчезновение через 5 секунд
  setTimeout(() => {
    if (resultDiv.parentNode) {
      resultDiv.parentNode.removeChild(resultDiv);
    }
  }, 5000);
}

// Инициализация приложения
function initApp() {
  initStorage();
  
  // Обработчики событий
  document.getElementById('register-btn').addEventListener('click', registerClient);
  document.getElementById('check-balance').addEventListener('click', checkBalance);
  document.getElementById('activate-staff').addEventListener('click', activateStaffMode);
  document.getElementById('load-history').addEventListener('click', loadClientHistory);
  document.getElementById('add-points').addEventListener('click', addPoints);
  
  // Поддержка Enter
  document.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const activeElement = document.activeElement;
      if (activeElement.id === 'client-name') {
        registerClient();
      } else if (activeElement.id === 'client-id-input') {
        checkBalance();
      } else if (activeElement.id === 'secret-command') {
        activateStaffMode();
      } else if (activeElement.id === 'staff-client-id') {
        loadClientHistory();
      }
    }
  });
  
  console.log('Программа лояльности готова к работе (локальный режим)');
}

// Запуск приложения
document.addEventListener('DOMContentLoaded', initApp);
