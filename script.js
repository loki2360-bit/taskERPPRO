document.addEventListener('DOMContentLoaded', function() {
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const chartsContainer = document.getElementById('chartsContainer');
    const summaryCards = document.getElementById('summaryCards');
    const historySection = document.getElementById('historySection');
    const dataTable = document.getElementById('dataTable');
    
    // Глобальные переменные для хранения данных
    let allOrders = [];
    let currentFileData = null;
    let typeChart = null;
    let ordersChart = null;
    let topOrdersChart = null;
    
    // История загрузок
    const uploadHistory = [];
    
    // Обработчики событий для зоны загрузки
    dropZone.addEventListener('click', () => {
        fileInput.click();
    });
    
    dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
    });
    
    dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
    });
    
    dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        
        if (e.dataTransfer.files.length) {
            handleFile(e.dataTransfer.files[0]);
        }
    });
    
    fileInput.addEventListener('change', (e) => {
        if (e.target.files.length) {
            handleFile(e.target.files[0]);
        }
    });
    
    // Обработчик поиска и фильтров
    document.getElementById('searchInput').addEventListener('input', filterTable);
    document.getElementById('typeFilter').addEventListener('change', filterTable);
    document.getElementById('dateFilter').addEventListener('change', filterTable);
    
    // Обработка загруженного файла
    function handleFile(file) {
        if (!file.name.endsWith('.txt')) {
            alert('Пожалуйста, загрузите текстовый файл (.txt)');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            try {
                currentFileData = parseOrderFile(e.target.result, file.name);
                allOrders = [...allOrders, ...currentFileData.orders];
                
                // Добавляем в историю
                addToHistory(file);
                
                // Обновляем интерфейс
                updateSummaryCards(currentFileData);
                renderCharts(currentFileData);
                renderProgressBars(currentFileData);
                renderDataTable(currentFileData.orders);
                
                // Показываем скрытые элементы
                chartsContainer.style.display = 'grid';
                summaryCards.style.display = 'flex';
                historySection.style.display = 'block';
                dataTable.style.display = 'block';
                
                // Сбрасываем выбор файла для возможности загрузки того же файла
                fileInput.value = '';
            } catch (error) {
                console.error('Ошибка обработки файла:', error);
                alert('Не удалось обработать файл. Проверьте формат данных.');
            }
        };
        
        reader.readAsText(file, 'utf-8');
    }
    
    // Парсинг файла с заказами
    function parseOrderFile(content, fileName) {
        // Извлекаем дату из названия файла или содержимого
        let dateMatch = fileName.match(/(\d{2}\.\d{2}\.\d{4})/);
        let date = dateMatch ? dateMatch[1] : 'Неизвестно';
        
        // Пытаемся найти дату в содержимом файла
        const contentDateMatch = content.match(/ЗАКЗАКИ ЗА (\d{2}\.\d{2}\.\d{4})/);
        if (contentDateMatch) {
            date = contentDateMatch[1];
        }
        
        // Извлекаем экспортную дату и время
        let exportDateTime = 'Неизвестно';
        const exportMatch = content.match(/Экспорт: (\d{2}\.\d{2}\.\d{4}, \d{2}:\d{2}:\d{2})/);
        if (exportMatch) {
            exportDateTime = exportMatch[1];
        }
        
        // Разделяем заказы
        const orderSections = content.split('---');
        const orders = [];
        
        // Обрабатываем каждый заказ
        for (const section of orderSections) {
            const lines = section.trim().split('\n');
            
            // Ищем номер и код заказа
            const numMatch = lines[0].match(/№(\d+)\.\s*(.+)/);
            if (!numMatch) continue;
            
            const order = {
                number: numMatch[1],
                code: numMatch[2].trim(),
                description: '',
                type: '',
                amount: 0,
                date: date,
                parameters: {}
            };
            
            // Ищем описание и тип
            if (lines.length > 1) {
                const descMatch = lines[1].trim().match(/([^\(]+)\s*\(([^\)]+)\)/);
                if (descMatch) {
                    order.description = descMatch[1].trim();
                    order.type = descMatch[2].trim();
                } else {
                    order.description = lines[1].trim();
                }
            }
            
            // Обрабатываем параметры
            for (let i = 2; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Парсим параметры (Длина, Ширина и т.д.)
                const paramMatch = line.match(/([^:]+):\s*([^\s]+)/);
                if (paramMatch) {
                    const paramName = paramMatch[1].trim();
                    let paramValue = paramMatch[2].trim();
                    
                    // Сохраняем параметр
                    order.parameters[paramName] = paramValue;
                    
                    // Если это сумма, извлекаем значение
                    if (paramName === 'Сумма' || line.includes('Сумма')) {
                        const sumMatch = line.match(/Сумма:\s*([\d.,]+)/);
                        if (sumMatch) {
                            order.amount = parseFloat(sumMatch[1].replace(',', '.'));
                        }
                    }
                }
            }
            
            orders.push(order);
        }
        
        // Извлекаем итоговую сумму
        let total = 0;
        const totalMatch = content.match(/ИТОГО:\s*([\d.,]+)/);
        if (totalMatch) {
            total = parseFloat(totalMatch[1].replace(',', '.'));
        }
        
        return {
            orders: orders,
            total: total,
            date: date,
            exportDateTime: exportDateTime,
            fileName: fileName
        };
    }
    
    // Обновление сводных карточек
    function updateSummaryCards(data) {
        document.getElementById('totalRevenue').textContent = formatCurrency(data.total);
        document.getElementById('totalOrders').textContent = data.orders.length;
        
        const avgCheck = data.total / data.orders.length;
        document.getElementById('avgCheck').textContent = formatCurrency(avgCheck);
        
        document.getElementById('lastUpdate').textContent = data.exportDateTime;
    }
    
    // Построение графиков
    function renderCharts(data) {
        // 1. Выручка по типам работ
        renderTypeChart(data);
        
        // 2. Распределение заказов
        renderOrdersChart(data);
        
        // 3. Топ-5 самых дорогих заказов (ИСПРАВЛЕНО)
        renderTopOrdersChart(data);
    }
    
    // Выручка по типам работ
    function renderTypeChart(data) {
        const typeRevenue = {};
        let totalRevenue = 0;
        
        // Собираем данные по типам
        data.orders.forEach(order => {
            if (!typeRevenue[order.type]) {
                typeRevenue[order.type] = 0;
            }
            typeRevenue[order.type] += order.amount;
            totalRevenue += order.amount;
        });
        
        // Подготовка данных для Chart.js
        const labels = Object.keys(typeRevenue);
        const values = Object.values(typeRevenue);
        
        // Создаем или обновляем график
        const ctx = document.getElementById('typeChart').getContext('2d');
        
        if (typeChart) {
            typeChart.destroy();
        }
        
        typeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Выручка (₽)',
                    data: values,
                    backgroundColor: labels.map(() => getRandomColor(0.7)),
                    borderColor: labels.map(() => getRandomColor(1)),
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed.y;
                                const percentage = ((value / totalRevenue) * 100).toFixed(1);
                                return `${formatCurrency(value)} (${percentage}%)`;
                            }
                        }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Распределение заказов
    function renderOrdersChart(data) {
        const typeCount = {};
        
        // Собираем количество заказов по типам
        data.orders.forEach(order => {
            if (!typeCount[order.type]) {
                typeCount[order.type] = 0;
            }
            typeCount[order.type]++;
        });
        
        // Подготовка данных для Chart.js
        const labels = Object.keys(typeCount);
        const values = Object.values(typeCount);
        
        // Создаем или обновляем график
        const ctx = document.getElementById('ordersChart').getContext('2d');
        
        if (ordersChart) {
            ordersChart.destroy();
        }
        
        ordersChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: values,
                    backgroundColor: labels.map(() => getRandomColor(0.7)),
                    borderColor: '#fff',
                    borderWidth: 1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right'
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const value = context.parsed;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = ((value / total) * 100).toFixed(1);
                                return `${context.label}: ${value} заказов (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
        
        // Обновляем фильтр типов в таблице
        const typeFilter = document.getElementById('typeFilter');
        typeFilter.innerHTML = '<option value="">Все типы</option>';
        
        labels.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        });
    }
    
    // Топ-5 самых дорогих заказов (ИСПРАВЛЕНО)
    function renderTopOrdersChart(data) {
        // Сортируем заказы по сумме в убывающем порядке и берем первые 5
        const topOrders = [...data.orders]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
        
        const labels = topOrders.map(order => order.description.substring(0, 20) + (order.description.length > 20 ? '...' : ''));
        const values = topOrders.map(order => order.amount);
        const codes = topOrders.map(order => order.code);
        
        // Создаем или обновляем график
        const ctx = document.getElementById('topOrdersChart').getContext('2d');
        
        if (topOrdersChart) {
            topOrdersChart.destroy();
        }
        
        topOrdersChart = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Сумма (₽)',
                    data: values,
                    backgroundColor: labels.map(() => getRandomColor(0.7)),
                    borderColor: labels.map(() => getRandomColor(1)),
                    borderWidth: 1
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false
                    },
                    tooltip: {
                        callbacks: {
                            title: function(tooltipItems) {
                                return tooltipItems[0].label;
                            },
                            label: function(context) {
                                const orderIndex = context.dataIndex;
                                return [
                                    `Код: ${codes[orderIndex]}`,
                                    `Сумма: ${formatCurrency(context.parsed.x)}`
                                ];
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return formatCurrency(value);
                            }
                        }
                    }
                }
            }
        });
    }
    
    // Прогресс выполнения (ИСПРАВЛЕНО)
    function renderProgressBars(data) {
        const progressBarContainer = document.getElementById('progressBars');
        progressBarContainer.innerHTML = '';
        
        // Определяем целевые значения для прогресса
        // Например, можно установить цели на день/неделю
        const dailyTarget = 3000; // Целевая выручка за день
        const ordersTarget = 15;  // Целевое количество заказов за день
        
        // Прогресс по выручке
        createProgressBar(
            progressBarContainer,
            'Выручка за день',
            data.total,
            dailyTarget,
            '₽',
            '#4e73df'
        );
        
        // Прогресс по количеству заказов
        createProgressBar(
            progressBarContainer,
            'Количество заказов',
            data.orders.length,
            ordersTarget,
            '',
            '#1cc88a'
        );
        
        // Прогресс по типам работ (берем самый популярный тип)
        const typeCount = {};
        data.orders.forEach(order => {
            typeCount[order.type] = (typeCount[order.type] || 0) + 1;
        });
        
        const mostCommonType = Object.keys(typeCount).reduce((a, b) => 
            typeCount[a] > typeCount[b] ? a : b
        );
        
        createProgressBar(
            progressBarContainer,
            `Заказы типа "${mostCommonType}"`,
            typeCount[mostCommonType],
            Math.max(ordersTarget * 0.6, typeCount[mostCommonType] + 2),
            '',
            '#36b9cc'
        );
    }
    
    // Создание одного прогресс-бара
    function createProgressBar(container, title, currentValue, targetValue, unit, color) {
        const progressGroup = document.createElement('div');
        progressGroup.className = 'progress-group';
        
        const header = document.createElement('div');
        header.className = 'progress-header';
        header.innerHTML = `
            <span class="progress-title">${title}</span>
            <span class="progress-value">${formatNumber(currentValue)}${unit} / ${formatNumber(targetValue)}${unit}</span>
        `;
        
        const progressBar = document.createElement('div');
        progressBar.className = 'progress';
        
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-fill';
        progressFill.style.width = `${Math.min((currentValue / targetValue) * 100, 100)}%`;
        progressFill.style.backgroundColor = color;
        
        progressBar.appendChild(progressFill);
        
        progressGroup.appendChild(header);
        progressGroup.appendChild(progressBar);
        
        container.appendChild(progressGroup);
    }
    
    // Детализация заказов (ИСПРАВЛЕНО)
    function renderDataTable(orders) {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';
        
        // Заполняем таблицу
        orders.forEach(order => {
            const row = document.createElement('tr');
            
            row.innerHTML = `
                <td>${order.number}</td>
                <td>${order.code}</td>
                <td title="${order.description}">${order.description.substring(0, 30)}${order.description.length > 30 ? '...' : ''}</td>
                <td>${order.type}</td>
                <td>${order.date}</td>
                <td class="amount-cell">${formatCurrency(order.amount)}</td>
            `;
            
            tableBody.appendChild(row);
        });
    }
    
    // Фильтрация таблицы
    function filterTable() {
        const searchText = document.getElementById('searchInput').value.toLowerCase();
        const typeFilter = document.getElementById('typeFilter').value;
        const dateFilter = document.getElementById('dateFilter').value;
        const rows = document.querySelectorAll('#tableBody tr');
        
        rows.forEach(row => {
            const description = row.cells[2].textContent.toLowerCase();
            const type = row.cells[3].textContent;
            const date = row.cells[4].textContent;
            
            const matchesSearch = searchText === '' || description.includes(searchText);
            const matchesType = typeFilter === '' || type === typeFilter;
            const matchesDate = dateFilter === '' || date === dateFilter;
            
            row.style.display = (matchesSearch && matchesType && matchesDate) ? '' : 'none';
        });
    }
    
    // Добавление в историю загрузок
    function addToHistory(file) {
        const historyItem = {
            id: Date.now(),
            name: file.name,
            date: new Date().toLocaleString(),
            size: formatFileSize(file.size)
        };
        
        uploadHistory.unshift(historyItem);
        
        // Обновляем отображение истории
        updateHistoryList();
    }
    
    // Обновление списка истории
    function updateHistoryList() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        
        uploadHistory.forEach(item => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            historyItem.innerHTML = `
                <div class="history-item-icon">
                    <i class="fas fa-file-alt"></i>
                </div>
                <div class="history-item-details">
                    <h4>${item.name}</h4>
                    <p><i class="far fa-clock"></i> ${item.date} &bull; <i class="far fa-file"></i> ${item.size}</p>
                </div>
                <div class="history-item-actions">
                    <button class="btn-remove" data-id="${item.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            `;
            
            historyList.appendChild(historyItem);
        });
        
        // Добавляем обработчики удаления
        document.querySelectorAll('.btn-remove').forEach(button => {
            button.addEventListener('click', function() {
                const id = this.getAttribute('data-id');
                removeFromHistory(id);
            });
        });
    }
    
    // Удаление из истории
    function removeFromHistory(id) {
        const index = uploadHistory.findIndex(item => item.id == id);
        if (index !== -1) {
            uploadHistory.splice(index, 1);
            updateHistoryList();
            
            // Если удаляем текущие данные, скрываем график
            if (uploadHistory.length === 0) {
                chartsContainer.style.display = 'none';
                summaryCards.style.display = 'none';
                historySection.style.display = 'none';
                dataTable.style.display = 'none';
            }
        }
    }
    
    // Вспомогательные функции
    function formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2
        }).format(amount).replace('RUB', '₽');
    }
    
    function formatNumber(number) {
        return new Intl.NumberFormat('ru-RU').format(number);
    }
    
    function formatFileSize(bytes) {
        if (bytes === 0) return '0 Б';
        
        const k = 1024;
        const sizes = ['Б', 'КБ', 'МБ', 'ГБ'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    function getRandomColor(opacity = 1) {
        const r = Math.floor(Math.random() * 256);
        const g = Math.floor(Math.random() * 256);
        const b = Math.floor(Math.random() * 256);
        return `rgba(${r}, ${g}, ${b}, ${opacity})`;
    }
});
