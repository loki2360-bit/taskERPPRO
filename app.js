// КОНФИГУРАЦИЯ
const PASSWORD = "poet"; // ЗАМЕНИТЕ НА СВОЙ ПАРОЛЬ!
const STORAGE_KEY = "poetry_app_data";

let poems = [];
let currentPoemId = null;

// Инициализация
document.addEventListener('DOMContentLoaded', () => {
    loadPoems();
    // Проверка, был ли уже введен пароль в этой сессии (опционально)
});

// --- АВТОРИЗАЦИЯ ---
function checkPassword() {
    const input = document.getElementById('password-input').value;
    if (input === PASSWORD) {
        document.getElementById('auth-screen').classList.remove('active');
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('app-screen').classList.remove('hidden');
        document.getElementById('app-screen').classList.add('active');
        renderPoems();
    } else {
        document.getElementById('error-msg').style.display = 'block';
    }
}

// --- УПРАВЛЕНИЕ ДАННЫМИ ---
function loadPoems() {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
        poems = JSON.parse(stored);
    }
}

function savePoemsToStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(poems));
}

function createNewPoem() {
    currentPoemId = Date.now(); // Уникальный ID
    document.getElementById('poem-title').value = "";
    document.getElementById('poem-content').value = "";
    
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('app-screen').classList.add('hidden');
    document.getElementById('editor-screen').classList.remove('hidden');
    document.getElementById('editor-screen').classList.add('active');
}

function saveCurrentPoem() {
    const title = document.getElementById('poem-title').value || "Без названия";
    const content = document.getElementById('poem-content').value;
    
    const existingIndex = poems.findIndex(p => p.id === currentPoemId);
    
    if (existingIndex > -1) {
        poems[existingIndex] = { id: currentPoemId, title, content, date: new Date().toLocaleDateString() };
    } else {
        poems.push({ id: currentPoemId, title, content, date: new Date().toLocaleDateString() });
    }
    
    savePoemsToStorage();
    closeEditor();
}

function closeEditor() {
    document.getElementById('editor-screen').classList.remove('active');
    document.getElementById('editor-screen').classList.add('hidden');
    document.getElementById('app-screen').classList.remove('hidden');
    document.getElementById('app-screen').classList.add('active');
    renderPoems();
}

function deletePoem(e, id) {
    e.stopPropagation(); // Чтобы не открывался редактор
    if(confirm('Удалить это стихотворение?')) {
        poems = poems.filter(p => p.id !== id);
        savePoemsToStorage();
        renderPoems();
    }
}

function openPoem(id) {
    const poem = poems.find(p => p.id === id);
    if (poem) {
        currentPoemId = poem.id;
        document.getElementById('poem-title').value = poem.title;
        document.getElementById('poem-content').value = poem.content;
        
        document.getElementById('app-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('hidden');
        document.getElementById('editor-screen').classList.remove('hidden');
        document.getElementById('editor-screen').classList.add('active');
    }
}

// --- ОТОБРАЖЕНИЕ И ПОИСК ---
function renderPoems() {
    const list = document.getElementById('poems-list');
    const query = document.getElementById('search-input').value.toLowerCase();
    
    list.innerHTML = '';
    
    const filtered = poems.filter(p => 
        p.title.toLowerCase().includes(query) || 
        p.content.toLowerCase().includes(query)
    );

    // Сортировка: новые сверху
    filtered.sort((a, b) => b.id - a.id);

    filtered.forEach(poem => {
        const card = document.createElement('div');
        card.className = 'poem-card';
        card.onclick = () => openPoem(poem.id);
        
        // Обрезаем текст для превью
        const preview = poem.content.substring(0, 100) + (poem.content.length > 100 ? '...' : '');
        
        card.innerHTML = `
            <button class="delete-btn" onclick="deletePoem(event, ${poem.id})">✕</button>
            <h3>${poem.title}</h3>
            <p>${preview}</p>
            <small style="color:#999">${poem.date}</small>
        `;
        list.appendChild(card);
    });
}

// --- НАСТРОЙКИ И БЭКАП ---
function toggleSettings() {
    const modal = document.getElementById('settings-modal');
    modal.classList.toggle('hidden');
}

function exportData() {
    const dataStr = JSON.stringify(poems);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = `poetry_backup_${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
}

function importData(input) {
    const file = input.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                if(confirm('Это заменит текущие стихи. Продолжить?')) {
                    poems = imported;
                    savePoemsToStorage();
                    renderPoems();
                    toggleSettings();
                    alert('Данные успешно восстановлены!');
                }
            } else {
                alert('Неверный формат файла');
            }
        } catch (err) {
            alert('Ошибка при чтении файла');
        }
    };
    reader.readAsText(file);
}

// --- ЗАЩИТА ОТ КОНТЕКСТНОГО МЕНЮ ---
document.addEventListener('contextmenu', event => event.preventDefault());
document.addEventListener('keydown', event => {
    // Блокировка F12 и Ctrl+Shift+I (очень базовая)
    if (event.key === 'F12' || (event.ctrlKey && event.shiftKey && event.key === 'I')) {
        event.preventDefault();
    }
});
