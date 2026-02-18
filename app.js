// Модель данных для поездки
class Trip {
    constructor(route, startTime) {
        this.id = Date.now();
        this.route = route;
        this.startTime = startTime;
        this.endTime = '';
        this.rating = 0;
        this.receipt = null;
        this.distance = this.getRouteDistance(route); // Расстояние маршрута в км
    }
    
    getRouteDistance(routeId) {
        const routes = {
            '1': 12.5,  // Центральный вокзал - Парк Победы
            '5': 8.2,   // Автовокзал - Микрорайон Северный
            '10': 15.7, // Университет - ТЦ "Галерея"
            '15': 10.3, // Ж/д вокзал - Поселок Пригородный
            '22': 22.8  // Аэропорт - Центр
        };
        return routes[routeId] || 0;
    }
    
    getDuration() {
        if (!this.endTime) return 0;
        const start = new Date(this.startTime);
        const end = new Date(this.endTime);
        return end - start; // в миллисекундах
    }
    
    getAverageSpeed() {
        if (!this.endTime || this.distance <= 0) return 0;
        const durationHours = this.getDuration() / (1000 * 60 * 60); // в часах
        return durationHours > 0 ? (this.distance / durationHours).toFixed(1) : 0;
    }
    
    getRouteName() {
        const routes = {
            '1': '1 - Центральный вокзал - Парк Победы',
            '5': '5 - Автовокзал - Микрорайон Северный',
            '10': '10 - Университет - ТЦ "Галерея"',
            '15': '15 - Ж/д вокзал - Поселок Пригородный',
            '22': '22 - Аэропорт - Центр'
        };
        return routes[this.route] || 'Неизвестный маршрут';
    }
}

// Хранилище для работы с LocalStorage
class TripStorage {
    static STORAGE_KEY = 'bus_trips';
    
    static saveTrip(trip) {
        let trips = this.getAllTrips();
        trips.push(trip);
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(trips));
        return trip;
    }
    
    static getAllTrips() {
        const data = localStorage.getItem(this.STORAGE_KEY);
        return data ? JSON.parse(data) : [];
    }
    
    static getTripsByRoute(routeId) {
        if (routeId === 'all') return this.getAllTrips();
        return this.getAllTrips().filter(trip => trip.route === routeId);
    }
    
    static calculateStatistics(trips) {
        if (trips.length === 0) {
            return {
                totalTrips: 0,
                avgRating: 0,
                avgDuration: 0,
                avgSpeed: 0
            };
        }
        
        let totalRating = 0;
        let totalDuration = 0;
        let totalSpeed = 0;
        let validSpeedCount = 0;
        
        trips.forEach(trip => {
            totalRating += trip.rating;
            
            const duration = trip.getDuration();
            if (duration > 0) {
                totalDuration += duration;
            }
            
            const speed = parseFloat(trip.getAverageSpeed());
            if (speed > 0) {
                totalSpeed += speed;
                validSpeedCount++;
            }
        });
        
        return {
            totalTrips: trips.length,
            avgRating: (totalRating / trips.length).toFixed(1),
            avgDuration: this.formatDuration(totalDuration / trips.length),
            avgSpeed: validSpeedCount > 0 ? (totalSpeed / validSpeedCount).toFixed(1) : 0
        };
    }
    
    static formatDuration(ms) {
        if (ms <= 0) return '00:00';
        
        const totalSeconds = Math.floor(ms / 1000);
        const hours = Math.floor(totalSeconds / 3600);
        const minutes = Math.floor((totalSeconds % 3600) / 60);
        const seconds = totalSeconds % 60;
        
        if (hours > 0) {
            return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        }
        
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

// Основной класс приложения
class BusStatisticsApp {
    constructor() {
        // Элементы DOM
        this.elements = {
            activeTrip: document.getElementById('active-trip'),
            currentRoute: document.getElementById('current-route'),
            tripTimer: document.getElementById('trip-timer'),
            endTripBtn: document.getElementById('end-trip'),
            
            newTrip: document.getElementById('new-trip'),
            tripForm: document.getElementById('trip-form'),
            routeSelect: document.getElementById('route-select'),
            
            completeTrip: document.getElementById('complete-trip'),
            summaryRoute: document.getElementById('summary-route'),
            summaryDuration: document.getElementById('summary-duration'),
            summarySpeed: document.getElementById('summary-speed'),
            rating: document.getElementById('rating'),
            receiptScan: document.getElementById('receipt-scan'),
            receiptPreview: document.getElementById('receipt-preview'),
            saveTripBtn: document.getElementById('save-trip'),
            
            statistics: document.getElementById('statistics'),
            statsRouteFilter: document.getElementById('stats-route-filter'),
            totalTrips: document.getElementById('total-trips'),
            avgRating: document.getElementById('avg-rating'),
            avgDuration: document.getElementById('avg-duration'),
            tripsTable: document.getElementById('trips-table').querySelector('tbody')
        };
        
        // Состояние приложения
        this.currentTrip = null;
        this.tripTimerInterval = null;
        
        // Инициализация
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadStatistics();
        this.checkForActiveTrip();
    }
    
    setupEventListeners() {
        // Начало новой поездки
        this.elements.tripForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.startTrip();
        });
        
        // Завершение поездки
        this.elements.endTripBtn.addEventListener('click', () => {
            this.endTrip();
        });
        
        // Сохранение поездки
        this.elements.saveTripBtn.addEventListener('click', () => {
            this.saveTrip();
        });
        
        // Оценка поездки
        this.elements.rating.querySelectorAll('span').forEach(star => {
            star.addEventListener('click', () => {
                const rating = parseInt(star.getAttribute('data-value'));
                this.setRating(rating);
            });
            
            star.addEventListener('mouseenter', () => {
                this.highlightStars(parseInt(star.getAttribute('data-value')));
            });
            
            star.addEventListener('mouseleave', () => {
                this.resetStars();
            });
        });
        
        // Предпросмотр чека
        this.elements.receiptScan.addEventListener('change', (e) => {
            this.handleReceiptScan(e);
        });
        
        // Фильтрация статистики
        this.elements.statsRouteFilter.addEventListener('change', () => {
            this.loadStatistics();
        });
    }
    
    checkForActiveTrip() {
        const activeTripData = sessionStorage.getItem('activeTrip');
        if (activeTripData) {
            this.currentTrip = JSON.parse(activeTripData);
            this.startTripTimer();
        }
    }
    
    startTrip() {
        const routeId = this.elements.routeSelect.value;
        if (!routeId) return;
        
        this.currentTrip = new Trip(routeId, new Date().toISOString());
        sessionStorage.setItem('activeTrip', JSON.stringify(this.currentTrip));
        
        this.showSection('active-trip');
        this.elements.currentRoute.textContent = this.currentTrip.getRouteName();
        
        this.startTripTimer();
    }
    
    startTripTimer() {
        this.updateTimerDisplay();
        
        if (this.tripTimerInterval) {
            clearInterval(this.tripTimerInterval);
        }
        
        this.tripTimerInterval = setInterval(() => {
            this.updateTimerDisplay();
        }, 1000);
    }
    
    updateTimerDisplay() {
        if (!this.currentTrip) return;
        
        const startTime = new Date(this.currentTrip.startTime);
        const now = new Date();
        const diff = now - startTime;
        
        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);
        
        this.elements.tripTimer.textContent = 
            `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
    
    endTrip() {
        if (!this.currentTrip) return;
        
        this.currentTrip.endTime = new Date().toISOString();
        
        this.elements.summaryRoute.textContent = this.currentTrip.getRouteName();
        this.elements.summaryDuration.textContent = TripStorage.formatDuration(this.currentTrip.getDuration());
        this.elements.summarySpeed.textContent = this.currentTrip.getAverageSpeed();
        
        this.showSection('complete-trip');
        clearInterval(this.tripTimerInterval);
    }
    
    setRating(rating) {
        this.currentTrip.rating = rating;
        
        this.elements.rating.querySelectorAll('span').forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
    
    highlightStars(rating) {
        this.elements.rating.querySelectorAll('span').forEach((star, index) => {
            if (index < rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
    
    resetStars() {
        this.elements.rating.querySelectorAll('span').forEach((star, index) => {
            if (index < this.currentTrip.rating) {
                star.classList.add('active');
            } else {
                star.classList.remove('active');
            }
        });
    }
    
    handleReceiptScan(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        
        reader.onload = (e) => {
            this.currentTrip.receipt = e.target.result;
            this.elements.receiptPreview.style.backgroundImage = `url('${e.target.result}')`;
            this.elements.receiptPreview.textContent = '';
        };
        
        reader.readAsDataURL(file);
    }
    
    saveTrip() {
        if (!this.currentTrip) return;
        
        // Сохраняем поездку
        TripStorage.saveTrip(this.currentTrip);
        
        // Очищаем состояние
        sessionStorage.removeItem('activeTrip');
        this.currentTrip = null;
        
        // Сбрасываем интерфейс
        this.elements.tripForm.reset();
        this.elements.receiptPreview.style.backgroundImage = '';
        this.elements.receiptPreview.textContent = 'Предпросмотр чека';
        
        // Обновляем статистику
        this.loadStatistics();
        
        // Возвращаемся к начальному состоянию
        this.showSection('new-trip');
    }
    
    loadStatistics() {
        const routeFilter = this.elements.statsRouteFilter.value;
        const trips = TripStorage.getTripsByRoute(routeFilter);
        const stats = TripStorage.calculateStatistics(trips);
        
        // Обновляем статистику
        this.elements.totalTrips.textContent = stats.totalTrips;
        this.elements.avgRating.textContent = stats.avgRating;
        this.elements.avgDuration.textContent = stats.avgDuration;
        
        // Обновляем историю поездок
        this.updateTripsHistory(trips);
    }
    
    updateTripsHistory(trips) {
        // Очищаем таблицу
        this.elements.tripsTable.innerHTML = '';
        
        if (trips.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = `<td colspan="5" style="text-align: center;">Нет данных о поездках</td>`;
            this.elements.tripsTable.appendChild(row);
            return;
        }
        
        // Сортируем поездки по времени (новые сверху)
        const sortedTrips = [...trips].sort((a, b) => 
            new Date(b.startTime) - new Date(a.startTime)
        );
        
        // Добавляем поездки в таблицу
        sortedTrips.forEach(trip => {
            const row = document.createElement('tr');
            
            const date = new Date(trip.startTime);
            const formattedDate = `${date.getDate().toString().padStart(2, '0')}.${(date.getMonth() + 1).toString().padStart(2, '0')}.${date.getFullYear()}`;
            
            row.innerHTML = `
                <td>${formattedDate}</td>
                <td>${trip.getRouteName()}</td>
                <td>${TripStorage.formatDuration(trip.getDuration())}</td>
                <td>${trip.getAverageSpeed()} км/ч</td>
                <td>${'★'.repeat(trip.rating).padEnd(5, '☆')}</td>
            `;
            
            this.elements.tripsTable.appendChild(row);
        });
    }
    
    showSection(sectionId) {
        // Скрываем все секции
        document.querySelectorAll('.card').forEach(card => {
            card.classList.add('hidden');
        });
        
        // Показываем нужную секцию
        document.getElementById(sectionId).classList.remove('hidden');
    }
}

// Инициализация приложения при загрузке страницы
document.addEventListener('DOMContentLoaded', () => {
    new BusStatisticsApp();
});
