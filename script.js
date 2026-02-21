document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const dropZone = document.getElementById('dropZone');
    const fileInput = document.getElementById('fileInput');
    const summaryCards = document.getElementById('summaryCards');
    const chartsContainer = document.getElementById('chartsContainer');
    const historySection = document.getElementById('historySection');
    const dataTable = document.getElementById('dataTable');
    
    // Summary elements
    const totalRevenue = document.getElementById('totalRevenue');
    const totalOrders = document.getElementById('totalOrders');
    const avgCheck = document.getElementById('avgCheck');
    const lastUpdate = document.getElementById('lastUpdate');
    
    // Charts
    let typeChart, ordersChart, topOrdersChart;
    
    // Data storage
    let allOrders = [];
    let history = JSON.parse(localStorage.getItem('ordersHistory')) || [];
    
    // Initialize the app
    initApp();
    
    function initApp() {
        // Setup event listeners
        dropZone.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('dragover', handleDragOver);
        dropZone.addEventListener('drop', handleDrop);
        fileInput.addEventListener('change', handleFileSelect);
        
        // Load history if exists
        renderHistory();
        
        // If there's data in localStorage, load it
        const savedData = localStorage.getItem('dashboardData');
        if (savedData) {
            allOrders = JSON.parse(savedData);
            updateDashboard();
        }
    }
    
    function handleDragOver(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#4361ee';
        dropZone.style.backgroundColor = '#f0f5ff';
    }
    
    function handleDrop(e) {
        e.preventDefault();
        e.stopPropagation();
        dropZone.style.borderColor = '#ccc';
        dropZone.style.backgroundColor = 'white';
        
        if (e.dataTransfer.files && e.dataTransfer.files[0]) {
            handleFile(e.dataTransfer.files[0]);
        }
    }
    
    function handleFileSelect(e) {
        if (e.target.files && e.target.files[0]) {
            handleFile(e.target.files[0]);
        }
    }
    
    function handleFile(file) {
        if (!file.name.endsWith('.txt')) {
            alert('Пожалуйста, загрузите текстовый файл (.txt)');
            return;
        }
        
        const reader = new FileReader();
        
        reader.onload = function(e) {
            const content = e.target.result;
            const parsedData = parseOrderFile(content);
            
            if (parsedData && parsedData.orders.length > 0) {
                // Add date to the orders
                parsedData.orders.forEach(order => {
                    order.date = parsedData.date;
                });
                
                // Add to all orders
                allOrders = [...allOrders, ...parsedData.orders];
                
                // Save to localStorage
                localStorage.setItem('dashboardData', JSON.stringify(allOrders));
                
                // Add to history
                addToHistory(file.name, parsedData.date);
                
                // Update dashboard
                updateDashboard();
            } else {
                alert('Не удалось распознать данные в файле. Проверьте формат.');
            }
        };
        
        reader.readAsText(file);
    }
    
    function parseOrderFile(content) {
        try {
            // Extract date from header
            const dateMatch = content.match(/ЗАКАЗЫ ЗА (\d{2}\.\d{2}\.\d{4})/);
            const exportDateMatch = content.match(/Экспорт: (\d{2}\.\d{2}\.\d{4})/);
            const date = dateMatch ? dateMatch[1] : (exportDateMatch ? exportDateMatch[1] : 'Неизвестно');
            
            // Split content into order sections
            const sections = content.split('---');
            const orders = [];
            let total = 0;
            
            // Process each section
            for (const section of sections) {
                if (section.trim() === '') continue;
                
                // Extract order number and code
                const numMatch = section.match(/№(\d+)\.\s*([^\n]+)/);
                if (!numMatch) continue;
                
                const order = {
                    number: numMatch[1],
                    code: numMatch[2].trim(),
                    description: '',
                    type: '',
                    amount: 0,
                    date: date
                };
                
                // Extract description and type
                const descMatch = section.match(/([^\n]+)\s+\(([^\)]+)\)/);
                if (descMatch) {
                    order.description = descMatch[1].trim();
                    order.type = descMatch[2].trim();
                }
                
                // Extract amount
                const sumMatch = section.match(/Сумма:\s*([\d.,]+)\s*₽/);
                if (sumMatch) {
                    const amountStr = sumMatch[1].replace(',', '.');
                    order.amount = parseFloat(amountStr);
                    total += order.amount;
                }
                
                orders.push(order);
            }
            
            // Extract total from footer if available
            const totalMatch = content.match(/ИТОГО:\s*([\d.,]+)\s*₽/);
            if (totalMatch) {
                total = parseFloat(totalMatch[1].replace(',', '.'));
            }
            
            return {
                orders,
                total,
                date
            };
        } catch (error) {
            console.error('Error parsing file:', error);
            return null;
        }
    }
    
    function updateDashboard() {
        // Update summary cards
        const total = allOrders.reduce((sum, order) => sum + order.amount, 0);
        totalRevenue.textContent = formatCurrency(total);
        totalOrders.textContent = allOrders.length;
        avgCheck.textContent = formatCurrency(total / allOrders.length || 0);
        lastUpdate.textContent = new Date().toLocaleString('ru-RU');
        
        // Show elements
        summaryCards.style.display = 'grid';
        chartsContainer.style.display = 'grid';
        dataTable.style.display = 'block';
        
        // Update charts
        updateCharts();
        
        // Update data table
        updateDataTable();
    }
    
    function updateCharts() {
        // Update type chart (Выручка по типам работ)
        updateTypeChart();
        
        // Update orders chart (Распределение заказов)
        updateOrdersChart();
        
        // Update top orders chart (Топ-5 самых дорогих заказов)
        updateTopOrdersChart();
        
        // Update progress bars
        updateProgressBars();
    }
    
    function updateTypeChart() {
        // Group orders by type and sum amounts
        const typeData = {};
        allOrders.forEach(order => {
            if (!typeData[order.type]) {
                typeData[order.type] = 0;
            }
            typeData[order.type] += order.amount;
        });
        
        const labels = Object.keys(typeData);
        const data = Object.values(typeData);
        
        const ctx = document.getElementById('typeChart').getContext('2d');
        
        if (typeChart) {
            typeChart.data.labels = labels;
            typeChart.data.datasets[0].data = data;
            typeChart.update();
            return;
        }
        
        typeChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Выручка (₽)',
                    data: data,
                    backgroundColor: [
                        '#4cc9f0', '#72efdd', '#f368e0', '#ff9f43', '#54a0ff', '#00d2d3'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' ₽';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${formatCurrency(context.parsed.y)} ₽`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function updateOrdersChart() {
        // Group orders by type
        const typeCount = {};
        allOrders.forEach(order => {
            if (!typeCount[order.type]) {
                typeCount[order.type] = 0;
            }
            typeCount[order.type]++;
        });
        
        const labels = Object.keys(typeCount);
        const data = Object.values(typeCount);
        
        const ctx = document.getElementById('ordersChart').getContext('2d');
        
        if (ordersChart) {
            ordersChart.data.labels = labels;
            ordersChart.data.datasets[0].data = data;
            ordersChart.update();
            return;
        }
        
        ordersChart = new Chart(ctx, {
            type: 'doughnut',
            data: {
                labels: labels,
                datasets: [{
                    data: data,
                    backgroundColor: [
                        '#4cc9f0', '#72efdd', '#f368e0', '#ff9f43', '#54a0ff', '#00d2d3'
                    ]
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: 'right',
                    },
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                const label = context.label || '';
                                const value = context.parsed || 0;
                                const total = context.dataset.data.reduce((a, b) => a + b, 0);
                                const percentage = Math.round((value / total) * 100);
                                return ` ${label}: ${value} заказов (${percentage}%)`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function updateTopOrdersChart() {
        // Get top 5 orders by amount
        const topOrders = [...allOrders]
            .sort((a, b) => b.amount - a.amount)
            .slice(0, 5);
        
        const labels = topOrders.map(order => order.description.substring(0, 20) + (order.description.length > 20 ? '...' : ''));
        const data = topOrders.map(order => order.amount);
        
        const ctx = document.getElementById('topOrdersChart').getContext('2d');
        
        if (topOrdersChart) {
            topOrdersChart.data.labels = labels;
            topOrdersChart.data.datasets[0].data = data;
            topOrdersChart.update();
            return;
        }
        
        topOrdersChart = new Chart(ctx, {
            type: 'horizontalBar',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Сумма (₽)',
                    data: data,
                    backgroundColor: '#54a0ff'
                }]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    x: {
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value + ' ₽';
                            }
                        }
                    }
                },
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function(context) {
                                return ` ${formatCurrency(context.parsed.x)} ₽`;
                            }
                        }
                    }
                }
            }
        });
    }
    
    function updateProgressBars() {
        const progressContainer = document.getElementById('progressBars');
        progressContainer.innerHTML = '';
        
        // Group orders by type for progress
        const typeData = {};
        allOrders.forEach(order => {
            if (!typeData[order.type]) {
                typeData[order.type] = 0;
            }
            typeData[order.type] += order.amount;
        });
        
        // Define target values for each type (you could make this configurable)
        const targets = {
            'Распил': 5000,
            'Лин. распил': 3000,
            'Склейка +': 2000,
            'Время': 1000
        };
        
        // Create progress bars for main types
        Object.keys(typeData).forEach(type => {
            if (!targets[type]) return;
            
            const amount = typeData[type];
            const target = targets[type];
            const percentage = Math.min(100, Math.round((amount / target) * 100));
            
            const progressItem = document.createElement('div');
            progressItem.className = 'progress-item';
            
            progressItem.innerHTML = `
                <h3>
                    <span>${type}</span>
                    <span>${percentage}%</span>
                </h3>
                <div class="progress-bar">
                    <div class="progress progress-${type.toLowerCase().replace(' ', '')}" style="width: ${percentage}%"></div>
                </div>
                <p class="progress-stats">${formatCurrency(amount)} из ${formatCurrency(target)}</p>
            `;
            
            progressContainer.appendChild(progressItem);
        });
    }
    
    function updateDataTable() {
        const tableBody = document.getElementById('tableBody');
        tableBody.innerHTML = '';
        
        // Sort orders by date (newest first)
        const sortedOrders = [...allOrders].sort((a, b) => 
            new Date(b.date.split('.').reverse().join('-')) - 
            new Date(a.date.split('.').reverse().join('-'))
        );
        
        // Populate table
        sortedOrders.forEach(order => {
            const row = document.createElement('tr');
            row.innerHTML = `
                <td>${order.number}</td>
                <td>${order.code}</td>
                <td title="${order.description}">${order.description.substring(0, 30)}${order.description.length > 30 ? '...' : ''}</td>
                <td>${order.type}</td>
                <td>${order.date}</td>
                <td>${formatCurrency(order.amount)}</td>
            `;
            tableBody.appendChild(row);
        });
        
        // Setup filters
        setupTableFilters();
    }
    
    function setupTableFilters() {
        const tableBody = document.getElementById('tableBody');
        const searchInput = document.getElementById('searchInput');
        const typeFilter = document.getElementById('typeFilter');
        const dateFilter = document.getElementById('dateFilter');
        
        // Populate type filter options
        const types = [...new Set(allOrders.map(o => o.type))];
        typeFilter.innerHTML = '<option value="">Все типы</option>';
        types.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type;
            typeFilter.appendChild(option);
        });
        
        // Populate date filter options
        const dates = [...new Set(allOrders.map(o => o.date))];
        dateFilter.innerHTML = '<option value="">Все даты</option>';
        dates.forEach(date => {
            const option = document.createElement('option');
            option.value = date;
            option.textContent = date;
            dateFilter.appendChild(option);
        });
        
        // Filter function
        function filterTable() {
            const searchTerm = searchInput.value.toLowerCase();
            const selectedType = typeFilter.value;
            const selectedDate = dateFilter.value;
            
            const rows = tableBody.querySelectorAll('tr');
            
            rows.forEach(row => {
                const code = row.cells[1].textContent.toLowerCase();
                const description = row.cells[2].textContent.toLowerCase();
                const type = row.cells[3].textContent;
                const date = row.cells[4].textContent;
                
                const matchesSearch = code.includes(searchTerm) || description.includes(searchTerm);
                const matchesType = !selectedType || type === selectedType;
                const matchesDate = !selectedDate || date === selectedDate;
                
                row.style.display = matchesSearch && matchesType && matchesDate ? '' : 'none';
            });
        }
        
        // Add event listeners
        searchInput.addEventListener('input', filterTable);
        typeFilter.addEventListener('change', filterTable);
        dateFilter.addEventListener('change', filterTable);
    }
    
    function addToHistory(fileName, date) {
        // Check if this file is already in history
        const existingIndex = history.findIndex(item => item.name === fileName);
        if (existingIndex !== -1) {
            history.splice(existingIndex, 1);
        }
        
        // Add to beginning of history
        history.unshift({
            name: fileName,
            date: date,
            timestamp: new Date().toISOString()
        });
        
        // Keep only last 10 items
        if (history.length > 10) {
            history.pop();
        }
        
        // Save to localStorage
        localStorage.setItem('ordersHistory', JSON.stringify(history));
        
        // Update history display
        renderHistory();
    }
    
    function renderHistory() {
        const historyList = document.getElementById('historyList');
        historyList.innerHTML = '';
        
        if (history.length === 0) {
            historySection.style.display = 'none';
            return;
        }
        
        historySection.style.display = 'block';
        
        history.forEach((item, index) => {
            const historyItem = document.createElement('div');
            historyItem.className = 'history-item';
            
            const dateObj = new Date(item.timestamp);
            const formattedTime = dateObj.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
            
            historyItem.innerHTML = `
                <i class="fas fa-file-alt"></i>
                <span>${item.name} (${item.date})</span>
                <span class="time"> • ${formattedTime}</span>
                <span class="remove-btn" data-index="${index}"><i class="fas fa-times"></i></span>
            `;
            
            historyList.appendChild(historyItem);
        });
        
        // Add event listeners to remove buttons
        document.querySelectorAll('.remove-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                const index = parseInt(this.getAttribute('data-index'));
                removeHistoryItem(index);
            });
        });
    }
    
    function removeHistoryItem(index) {
        // Get orders from the file to be removed
        const fileToRemove = history[index];
        const ordersToRemove = allOrders.filter(order => 
            order.date === fileToRemove.date && 
            // This is a simplification - in a real app you'd need a better way to identify
            // But since we don't have unique IDs, we'll assume same date means same file
            true
        );
        
        // Remove these orders from allOrders
        allOrders = allOrders.filter(order => 
            !(order.date === fileToRemove.date)
        );
        
        // Update localStorage
        localStorage.setItem('dashboardData', JSON.stringify(allOrders));
        
        // Remove from history
        history.splice(index, 1);
        localStorage.setItem('ordersHistory', JSON.stringify(history));
        
        // Update UI
        if (allOrders.length === 0) {
            summaryCards.style.display = 'none';
            chartsContainer.style.display = 'none';
            dataTable.style.display = 'none';
        } else {
            updateDashboard();
        }
        
        renderHistory();
    }
    
    function formatCurrency(amount) {
        return new Intl.NumberFormat('ru-RU', {
            style: 'currency',
            currency: 'RUB',
            minimumFractionDigits: 2
        }).format(amount).replace('RUB', '₽');
    }
});
