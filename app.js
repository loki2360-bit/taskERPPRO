// === Хранилище данных ===
const STORAGE_KEY = 'erp_orders_v1';

function saveData(orders) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function loadData() {
  const data = localStorage.getItem(STORAGE_KEY);
  return data ? JSON.parse(data) : [];
}

// === Глобальные функции ===
let orders = loadData();

function renderOrders() {
  const container = document.getElementById('orders-list');
  container.innerHTML = '<h2>Заказы</h2>';
  
  if (orders.length === 0) {
    container.innerHTML += '<p>Нет заказов. Создайте первый!</p>';
    return;
  }

  orders.forEach((order, idx) => {
    const el = document.createElement('div');
    el.innerHTML = `
      <h3>${order.title}</h3>
      <p>Статус: ${order.status} | Этап: ${order.currentStageIndex + 1}/${order.stages.length}</p>
      <button onclick="openOrder(${idx})">Открыть</button>
      <button onclick="deleteOrder(${idx})" style="color:red;">Удалить</button>
    `;
    container.appendChild(el);
  });
}

function openOrder(index) {
  const order = orders[index];
  let stagesHtml = '';
  
  order.stages.forEach((stage, i) => {
    const isCurrent = i === order.currentStageIndex;
    const canApprove = isCurrent && stage.status === 'pending';
    
    stagesHtml += `
      <div class="stage">
        <strong>${stage.name}</strong> — ${stage.status}
        ${stage.comment ? `<p>Комментарий: ${stage.comment}</p>` : ''}
        <div class="photos">
          ${stage.photos?.map(url => `<img src="${url}" />`).join('') || ''}
        </div>
        ${canApprove ? 
          `<button onclick="approveStage(${index}, ${i})">Подтвердить этап</button>` : ''}
      </div>
    `;
  });

  document.getElementById('modal-body').innerHTML = `
    <h2>${order.title}</h2>
    <p><strong>Доп. поля:</strong> ${JSON.stringify(order.customFields || {})}</p>
    <h3>Этапы:</h3>
    ${stagesHtml}
    <h3>Добавить комментарий/фото к текущему этапу:</h3>
    <textarea id="comment-input" placeholder="Комментарий"></textarea><br>
    <input type="file" id="photo-input" accept="image/*" multiple /><br>
    <button onclick="addCommentToStage(${index}, ${order.currentStageIndex})">Сохранить</button>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function closeModal() {
  document.getElementById('modal').classList.add('hidden');
}

function approveStage(orderIndex, stageIndex) {
  const order = orders[orderIndex];
  order.stages[stageIndex].status = 'approved';
  order.stages[stageIndex].approvedAt = new Date().toISOString();
  
  if (stageIndex + 1 < order.stages.length) {
    order.currentStageIndex = stageIndex + 1;
  } else {
    order.status = 'completed';
  }
  
  saveData(orders);
  renderOrders();
  closeModal();
  alert('Этап подтверждён!');
}

function addCommentToStage(orderIndex, stageIndex) {
  const comment = document.getElementById('comment-input').value;
  const files = document.getElementById('photo-input').files;
  
  const photos = [];
  for (let file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      photos.push(e.target.result);
      if (photos.length === files.length) finalize();
    };
    reader.readAsDataURL(file);
  }
  
  if (files.length === 0) {
    finalize();
  }

  function finalize() {
    orders[orderIndex].stages[stageIndex].comment = comment;
    orders[orderIndex].stages[stageIndex].photos = 
      (orders[orderIndex].stages[stageIndex].photos || []).concat(photos);
    
    saveData(orders);
    alert('Комментарий сохранён');
    closeModal();
    renderOrders();
  }
}

function showCreateOrder() {
  document.getElementById('modal-body').innerHTML = `
    <h2>Новый заказ</h2>
    <input type="text" id="order-title" placeholder="Название заказа" /><br>
    <textarea id="custom-fields" placeholder='Доп. поля (JSON): {"артикул": "X1", "кол-во": 5}'></textarea><br>
    <h3>Этапы (по одному на строку):</h3>
    <textarea id="stages-input" placeholder="Сборка\nПокраска\nУпаковка"></textarea><br>
    <button onclick="createOrder()">Создать</button>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function createOrder() {
  const title = document.getElementById('order-title').value.trim();
  if (!title) return alert('Введите название');
  
  let customFields = {};
  try {
    const json = document.getElementById('custom-fields').value.trim();
    if (json) customFields = JSON.parse(json);
  } catch (e) {
    return alert('Неверный JSON в доп. полях');
  }

  const stagesInput = document.getElementById('stages-input').value.trim();
  const stageNames = stagesInput.split('\n').filter(s => s.trim());
  if (stageNames.length === 0) stageNames.push('Производство');

  const stages = stageNames.map(name => ({
    name: name.trim(),
    status: 'pending',
    comment: '',
    photos: []
  }));

  const order = {
    id: Date.now().toString(),
    title,
    customFields,
    stages,
    currentStageIndex: 0,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  orders.push(order);
  saveData(orders);
  renderOrders();
  closeModal();
  alert('Заказ создан!');
}

function deleteOrder(index) {
  if (confirm('Удалить заказ?')) {
    orders.splice(index, 1);
    saveData(orders);
    renderOrders();
  }
}

// === Экспорт / Импорт ===

function exportData() {
  const dataStr = JSON.stringify({ orders }, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'erp-data.json';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function importData() {
  document.getElementById('import-file').click();
}

function handleImportFile(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (data.orders && Array.isArray(data.orders)) {
        orders = data.orders;
        saveData(orders);
        renderOrders();
        alert('Данные импортированы!');
      } else {
        alert('Неверный формат файла');
      }
    } catch (err) {
      alert('Ошибка при импорте: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = ''; // сброс для повторного выбора
}

// === Запуск ===
renderOrders();
