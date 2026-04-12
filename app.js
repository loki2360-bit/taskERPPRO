// === Хранилище (localStorage) ===
const DB_KEY = 'task_manager_v1';
const DAILY_FILES_KEY = 'task_manager_daily_files';

const uuid = () => crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substr(2, 9);

const Storage = {
  getAll: () => JSON.parse(localStorage.getItem(DB_KEY) || '[]'),
  saveAll: (tasks) => localStorage.setItem(DB_KEY, JSON.stringify(tasks)),
  getDailyFiles: () => {
    const today = new Date().toDateString();
    const data = JSON.parse(localStorage.getItem(DAILY_FILES_KEY) || '{}');
    if (data.date !== today) return { date: today, count: 0 };
    return data;
  },
  addDailyFile: () => {
    const d = Storage.getDailyFiles();
    d.count++;
    localStorage.setItem(DAILY_FILES_KEY, JSON.stringify(d));
  },
  resetDailyIfNewDay: () => {
    const d = Storage.getDailyFiles();
    if (d.date !== new Date().toDateString()) {
      localStorage.setItem(DAILY_FILES_KEY, JSON.stringify({ date: new Date().toDateString(), count: 0 }));
    }
  }
};

// === Состояние приложения ===
let tasks = Storage.getAll();
let editingId = null;
let currentView = 'list';

// === DOM ===
const els = {
  list: document.getElementById('taskList'),
  detail: document.getElementById('detailView'),
  detailContent: document.getElementById('detailContent'),
  modal: document.getElementById('taskModal'),
  form: document.getElementById('taskForm'),
  searchInput: document.getElementById('searchInput'),
  searchTag: document.getElementById('searchTag'),
  searchDate: document.getElementById('searchDate'),
  addBtn: document.getElementById('addBtn'),
  backBtn: document.getElementById('backBtn'),
  fileLimitMsg: document.getElementById('fileLimitMsg'),
  subtaskList: document.getElementById('subtaskList'),
  addSubtaskBtn: document.getElementById('addSubtaskBtn'),
  newSubtask: document.getElementById('newSubtask')
};

// === Инициализация ===
function init() {
  Storage.resetDailyIfNewDay();
  renderList();
  updateTagFilter();
  
  // События
  document.getElementById('addBtn').onclick = () => openModal();
  document.getElementById('backBtn').onclick = () => showList();
  document.getElementById('cancelBtn').onclick = () => els.modal.close();
  document.getElementById('form').onsubmit = saveTask;
  document.getElementById('addSubtaskBtn').onclick = addSubtaskToModal;
  document.getElementById('searchInput').oninput = debounce(renderList, 200);
  document.getElementById('searchTag').onchange = renderList;
  document.getElementById('searchDate').onchange = renderList;
  document.getElementById('inputFiles').onchange = checkFileLimits;
}

// === Рендер списка ===
function renderList() {
  const query = els.searchInput.value.toLowerCase();
  const tag = els.searchTag.value;
  const date = els.searchDate.value;

  let filtered = tasks.filter(t => {
    const matchTitle = t.title.toLowerCase().includes(query);
    const matchTag = tag ? t.tags.includes(tag) : true;
    const matchDate = date ? new Date(t.createdAt).toISOString().startsWith(date) : true;
    return matchTitle && matchTag && matchDate;
  });

  // Сортировка: закрепленные -> по дате (новые сверху)
  filtered.sort((a, b) => {
    if (a.isPinned && !b.isPinned) return -1;
    if (!a.isPinned && b.isPinned) return 1;
    return b.createdAt - a.createdAt;
  });

  els.list.innerHTML = filtered.map(t => `
    <li class="task-card ${t.isPinned ? 'pinned' : ''}" onclick="showDetail('${t.id}')">
      <h3>${t.isPinned ? '<span class="pin-icon">★</span>' : ''}${escHtml(t.title)}</h3>
      <div class="tags">${t.tags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join('')}</div>
      <div class="task-meta">${new Date(t.createdAt).toLocaleDateString('ru-RU')} • ${t.subtasks.filter(s=>s.done).length}/${t.subtasks.length}</div>
    </li>
  `).join('');
}

// === Детальный просмотр ===
function showDetail(id) {
  const t = tasks.find(x => x.id === id);
  if (!t) return;

  els.detailContent.innerHTML = `
    <div class="detail-card">
      <h2>${escHtml(t.title)}</h2>
      <div class="desc">${t.description ? escHtml(t.description) : 'Без описания'}</div>
      <div class="tags">${t.tags.map(tag => `<span class="tag">${escHtml(tag)}</span>`).join('')}</div>
      
      ${t.subtasks.length ? `
        <ul class="subtask-list">
          ${t.subtasks.map((s, i) => `
            <li class="subtask-item ${s.done ? 'done' : ''}">
              <input type="checkbox" ${s.done ? 'checked' : ''} onchange="toggleSubtask('${id}', ${i})">
              <span>${escHtml(s.text)}</span>
            </li>
          `).join('')}
        </ul>
      ` : ''}

      ${t.files.length ? `
        <div class="files-list">
          ${t.files.map(f => `<a href="${f.data}" download="${f.name}" class="file-link">📎 ${escHtml(f.name)} (${(f.size/1024).toFixed(1)}КБ)</a>`).join('')}
        </div>
      ` : ''}

      <div class="actions-row">
        <button class="btn-edit" onclick="openModal('${id}')">✏️ Редактировать</button>
        <button class="btn-del" onclick="deleteTask('${id}')">🗑️ Удалить</button>
      </div>
    </div>
  `;

  document.getElementById('listView').classList.add('hidden');
  els.detail.classList.remove('hidden');
  currentView = 'detail';
}

window.toggleSubtask = (id, idx) => {
  const t = tasks.find(x => x.id === id);
  if (t) {
    t.subtasks[idx].done = !t.subtasks[idx].done;
    t.updatedAt = Date.now();
    Storage.saveAll(tasks);
    showDetail(id);
    renderList();
  }
};

window.deleteTask = (id) => {
  if (confirm('Удалить задачу?')) {
    tasks = tasks.filter(x => x.id !== id);
    Storage.saveAll(tasks);
    showList();
    renderList();
  }
};

function showList() {
  document.getElementById('listView').classList.remove('hidden');
  els.detail.classList.add('hidden');
  currentView = 'list';
}

// === Модальное окно (Создание/Редактирование) ===
function openModal(id = null) {
  editingId = id;
  els.form.reset();
  els.subtaskList.innerHTML = '';
  
  if (id) {
    const t = tasks.find(x => x.id === id);
    document.getElementById('inputTitle').value = t.title;
    document.getElementById('inputText').value = t.description || '';
    document.getElementById('inputTags').value = t.tags.join(', ');
    document.getElementById('inputPin').checked = t.isPinned;
    t.subtasks.forEach(s => addSubtaskToModal(null, s.text));
  } else {
    document.getElementById('modalTitle').textContent = 'Новая задача';
    const daily = Storage.getDailyFiles();
    els.fileLimitMsg.textContent = `Файлов сегодня: ${daily.count}/5`;
  }
  els.modal.showModal();
}

window.addSubtaskToModal = (_, text) => {
  const val = text || els.newSubtask.value.trim();
  if (!val) return;
  const li = document.createElement('div');
  li.className = 'subtask-item-modal';
  li.innerHTML = `<span>${escHtml(val)}</span><button type="button" onclick="this.parentElement.remove()">✕</button>`;
  els.subtaskList.appendChild(li);
  els.newSubtask.value = '';
};

function checkFileLimits() {
  const files = document.getElementById('inputFiles').files;
  const daily = Storage.getDailyFiles();
  let msg = `Файлов сегодня: ${daily.count}/5`;
  
  if (daily.count >= 5) {
    msg += ' ❌ Лимит исчерпан';
    els.fileLimitMsg.textContent = msg;
    document.getElementById('inputFiles').value = '';
    return;
  }

  for (let f of files) {
    if (f.size > 200 * 1024) {
      msg += ` ❌ ${f.name} > 200КБ`;
      els.fileLimitMsg.textContent = msg;
      document.getElementById('inputFiles').value = '';
      return;
    }
  }
  els.fileLimitMsg.textContent = msg + ' ✅';
}

function saveTask(e) {
  e.preventDefault();
  
  const title = document.getElementById('inputTitle').value.trim();
  const desc = document.getElementById('inputText').value.trim();
  const tagsRaw = document.getElementById('inputTags').value.split(',').map(t=>t.trim()).filter(Boolean);
  const isPinned = document.getElementById('inputPin').checked;
  const subtasks = [...els.subtaskList.querySelectorAll('span')].map(s => ({ id: uuid(), text: s.textContent, done: false }));

  // Лимит пинов
  if (isPinned && !editingId) {
    const pinnedCount = tasks.filter(t => t.isPinned).length;
    if (pinnedCount >= 5) {
      alert('Максимум 5 закреплённых задач');
      return;
    }
  }

  // Файлы
  const newFiles = [];
  const filesInput = document.getElementById('inputFiles');
  if (filesInput.files.length) {
    const daily = Storage.getDailyFiles();
    if (daily.count + filesInput.files.length > 5) {
      alert('Превышен лимит файлов на день (5)');
      return;
    }
  }

  const processFile = (i) => {
    if (i >= filesInput.files.length) {
      const now = Date.now();
      const task = {
        id: editingId || uuid(),
        title, description: desc, tags: tagsRaw, isPinned, subtasks,
        files: editingId ? tasks.find(t=>t.id===editingId).files.concat(newFiles) : newFiles,
        createdAt: editingId ? tasks.find(t=>t.id===editingId).createdAt : now,
        updatedAt: now
      };

      if (editingId) {
        tasks = tasks.map(t => t.id === editingId ? task : t);
      } else {
        tasks.unshift(task);
      }
      Storage.saveAll(tasks);
      
      // Обновляем счетчик файлов
      if (newFiles.length) {
        const d = Storage.getDailyFiles();
        d.count += newFiles.length;
        localStorage.setItem(DAILY_FILES_KEY, JSON.stringify(d));
      }

      els.modal.close();
      renderList();
      updateTagFilter();
      if (currentView === 'detail' && editingId) showDetail(editingId);
      return;
    }

    const file = filesInput.files[i];
    const reader = new FileReader();
    reader.onload = () => {
      newFiles.push({ name: file.name, size: file.size, type: file.type, data: reader.result });
      processFile(i + 1);
    };
    reader.readAsDataURL(file);
  };

  if (filesInput.files.length) processFile(0);
  else processFile(0); // сразу сохраняем
}

// === Утилиты ===
function escHtml(str) { return str.replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }
function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }
function updateTagFilter() {
  const tags = new Set();
  tasks.forEach(t => t.tags.forEach(tag => tags.add(tag)));
  const sel = els.searchTag;
  sel.innerHTML = '<option value="">Все теги</option>' + [...tags].sort().map(t => `<option value="${t}">${t}</option>`).join('');
}

init();
