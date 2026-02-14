// === Хранилище ===
const DB = {
  orders: [],
  workflowTemplates: [
    { id: 'default', name: 'Стандартный', stages: ['Производство', 'Контроль', 'Упаковка'] }
  ],
  nextOrderId: 1
};

function saveToStorage() {
  localStorage.setItem('erp_data_v2', JSON.stringify(DB));
}

function loadFromStorage() {
  const data = localStorage.getItem('erp_data_v2');
  if (data) {
    const parsed = JSON.parse(data);
    Object.assign(DB, parsed);
  }
}

// === Инициализация ===
loadFromStorage();
renderOrders();

// === Основные функции ===

function renderOrders() {
  const container = document.getElementById('orders-list');
  container.innerHTML = '<h2>Заказы</h2>';
  
  if (DB.orders.length === 0) {
    container.innerHTML += '<p>Нет заказов. Создайте первый!</p>';
    return;
  }

  DB.orders.forEach((order, idx) => {
    const currentStage = order.stages[order.currentStageIndex] || {};
    const statusText = order.status === 'completed' ? '✅ Завершён' : 
                      currentStage.status === 'approved' ? '➡️ Следующий этап' : 
                      '⏳ ' + currentStage.name;

    const el = document.createElement('div');
    el.className = 'order-card';
    el.innerHTML = `
      <h3>${order.title}</h3>
      <p><strong>Статус:</strong> ${statusText}</p>
      <p><strong>Исполнитель:</strong> ${order.assignee || '—'}</p>
      <p><strong>Наблюдатели:</strong> ${order.observers?.join(', ') || '—'}</p>
      <button onclick="openOrder(${idx})">Открыть</button>
      <button onclick="deleteOrder(${idx})" style="color:#d00;">Удалить</button>
    `;
    container.appendChild(el);
  });
}

function openOrder(index) {
  const order = DB.orders[index];
  let stagesHtml = '';

  order.stages.forEach((stage, i) => {
    const isCurrent = i === order.currentStageIndex;
    const canApprove = isCurrent && stage.status === 'pending';
    
    stagesHtml += `
      <div class="stage ${stage.status}">
        <strong>${stage.name}</strong> — ${stage.status === 'approved' ? '✅ Подтверждено' : '⏳ Ожидает'}
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
    <p><strong>Исполнитель:</strong> ${order.assignee}</p>
    <p><strong>Наблюдатели:</strong> ${order.observers?.join(', ')}</p>
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
  const order = DB.orders[orderIndex];
  order.stages[stageIndex].status = 'approved';
  order.stages[stageIndex].approvedAt = new Date().toISOString();
  
  if (stageIndex + 1 < order.stages.length) {
    order.currentStageIndex = stageIndex + 1;
  } else {
    order.status = 'completed';
  }
  
  saveToStorage();
  renderOrders();
  closeModal();
  alert('Этап подтверждён!');
}

function addCommentToStage(orderIndex, stageIndex) {
  const comment = document.getElementById('comment-input').value;
  const files = document.getElementById('photo-input').files;
  const photos = [];
  
  if (files.length === 0) {
    finalize([]);
    return;
  }

  let loaded = 0;
  for (let file of files) {
    const reader = new FileReader();
    reader.onload = (e) => {
      photos.push(e.target.result);
      loaded++;
      if (loaded === files.length) finalize(photos);
    };
    reader.readAsDataURL(file);
  }

  function finalize(photoUrls) {
    const stage = DB.orders[orderIndex].stages[stageIndex];
    stage.comment = comment;
    stage.photos = (stage.photos || []).concat(photoUrls);
    saveToStorage();
    alert('Сохранено');
    closeModal();
    renderOrders();
  }
}

function showCreateOrder() {
  // Получаем шаблоны
  let templateOptions = '';
  DB.workflowTemplates.forEach(t => {
    templateOptions += `<option value="${t.id}">${t.name}</option>`;
  });

  document.getElementById('modal-body').innerHTML = `
    <h2>Новый заказ</h2>
    <input type="text" id="order-title" placeholder="Название заказа" style="width:100%" /><br><br>
    
    <label>Шаблон этапов:</label>
    <select id="template-select">${templateOptions}</select><br><br>
    
    <label>Исполнитель:</label>
    <input type="text" id="assignee" placeholder="Имя исполнителя" style="width:100%" /><br><br>
    
    <label>Наблюдатели (через запятую):</label>
    <input type="text" id="observers" placeholder="Иван, Мария" style="width:100%" /><br><br>
    
    <label>Доп. поля (JSON):</label>
    <textarea id="custom-fields" placeholder='{"Артикул": "X1", "Кол-во": 10}' style="width:100%;height:60px;"></textarea><br><br>
    
    <button onclick="createOrder()">Создать заказ</button>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function createOrder() {
  const title = document.getElementById('order-title').value.trim();
  if (!title) return alert('Введите название');

  const templateId = document.getElementById('template-select').value;
  const template = DB.workflowTemplates.find(t => t.id === templateId);
  if (!template) return alert('Ошибка шаблона');

  const assignee = document.getElementById('assignee').value.trim();
  const observers = document.getElementById('observers').value
    .split(',').map(s => s.trim()).filter(s => s);

  let customFields = {};
  try {
    const json = document.getElementById('custom-fields').value.trim();
    if (json) customFields = JSON.parse(json);
  } catch (e) {
    return alert('Неверный JSON в доп. полях');
  }

  const stages = template.stages.map(name => ({
    name,
    status: 'pending',
    comment: '',
    photos: []
  }));

  const order = {
    id: 'order_' + DB.nextOrderId++,
    title,
    customFields,
    assignee,
    observers,
    stages,
    currentStageIndex: 0,
    status: 'active',
    createdAt: new Date().toISOString()
  };

  DB.orders.push(order);
  saveToStorage();
  renderOrders();
  closeModal();
  alert('Заказ создан!');
}

function deleteOrder(index) {
  if (confirm('Удалить заказ?')) {
    DB.orders.splice(index, 1);
    saveToStorage();
    renderOrders();
  }
}

// === Редактор workflow ===
function showWorkflowEditor() {
  let listHtml = '';
  DB.workflowTemplates.forEach((t, idx) => {
    listHtml += `
      <div style="margin:10px 0;">
        <strong>${t.name}</strong><br>
        Этапы: ${t.stages.join(' → ')}
        <button onclick="editTemplate(${idx})">✏️</button>
        ${DB.workflowTemplates.length > 1 ? `<button onclick="deleteTemplate(${idx})" style="color:red;">🗑️</button>` : ''}
      </div>
    `;
  });

  document.getElementById('modal-body').innerHTML = `
    <h2>Шаблоны этапов</h2>
    ${listHtml}
    <hr>
    <h3>Создать новый шаблон</h3>
    <input type="text" id="new-template-name" placeholder="Название шаблона" style="width:100%" /><br><br>
    <textarea id="new-stages" placeholder="Этап 1\nЭтап 2\nЭтап 3" style="width:100%;height:80px;"></textarea><br><br>
    <button onclick="createTemplate()">Создать</button>
  `;
  document.getElementById('modal').classList.remove('hidden');
}

function createTemplate() {
  const name = document.getElementById('new-template-name').value.trim();
  const stages = document.getElementById('new-stages').value
    .split('\n').map(s => s.trim()).filter(s => s);
  
  if (!name || stages.length === 0) return alert('Заполните все поля');
  
  DB.workflowTemplates.push({
    id: 'tmpl_' + Date.now(),
    name,
    stages
  });
  saveToStorage();
  showWorkflowEditor();
}

function editTemplate(idx) {
  const t = DB.workflowTemplates[idx];
  document.getElementById('modal-body').innerHTML = `
    <h2>Редактировать "${t.name}"</h2>
    <input type="text" id="edit-name" value="${t.name}" style="width:100%" /><br><br>
    <textarea id="edit-stages" style="width:100%;height:100px;">${t.stages.join('\n')}</textarea><br><br>
    <button onclick="saveTemplate(${idx})">Сохранить</button>
  `;
}

function saveTemplate(idx) {
  const name = document.getElementById('edit-name').value.trim();
  const stages = document.getElementById('edit-stages').value
    .split('\n').map(s => s.trim()).filter(s => s);
  
  if (!name || stages.length === 0) return alert('Заполните поля');
  
  DB.workflowTemplates[idx].name = name;
  DB.workflowTemplates[idx].stages = stages;
  saveToStorage();
  showWorkflowEditor();
}

function deleteTemplate(idx) {
  if (DB.workflowTemplates.length <= 1) return alert('Нужен хотя бы один шаблон');
  if (confirm('Удалить шаблон?')) {
    DB.workflowTemplates.splice(idx, 1);
    saveToStorage();
    showWorkflowEditor();
  }
}

// === Экспорт / Импорт ===
function exportData() {
  const dataStr = JSON.stringify(DB, null, 2);
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
      if (data.orders !== undefined) {
        Object.assign(DB, data);
        saveToStorage();
        renderOrders();
        alert('Данные импортированы!');
      } else {
        alert('Неверный формат');
      }
    } catch (err) {
      alert('Ошибка: ' + err.message);
    }
  };
  reader.readAsText(file);
  event.target.value = '';
}
