// Calendar functionality
const today = new Date();
let currentMonth = today.getMonth(); // Aktueller Monat (0-indexed)
let currentYear = today.getFullYear(); // Aktuelles Jahr

function changeMonth(direction) {
    currentMonth += direction;
    if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
    } else if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
    }
    updateCalendar();
}

function updateCalendar() {
    const monthNames = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 
                       'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
    document.getElementById('currentMonth').textContent = `${monthNames[currentMonth]} ${currentYear}`;
    
    // Regenerate calendar grid
    generateCalendarGrid();
}

function generateCalendarGrid() {
    const calendarGrid = document.querySelector('.calendar-grid');
    if (!calendarGrid) return;
    
    // Keep headers, remove old days
    const headers = calendarGrid.querySelectorAll('.calendar-day-header');
    calendarGrid.innerHTML = '';
    headers.forEach(header => calendarGrid.appendChild(header));
    
    // Get first day of month and number of days
    const firstDay = new Date(currentYear, currentMonth, 1);
    const lastDay = new Date(currentYear, currentMonth + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay(); // 0 = Sunday
    
    // Adjust for Monday start (0 = Monday, 6 = Sunday)
    const adjustedStart = startingDayOfWeek === 0 ? 6 : startingDayOfWeek - 1;
    
    // Add empty cells for days before month starts
    for (let i = 0; i < adjustedStart; i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Add days of month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        dayElement.className = 'calendar-day';
        
        const currentDate = new Date(currentYear, currentMonth, day);
        const dayOfWeek = currentDate.getDay();
        
        // Check if it's Sunday (0) - Honigwabe LIVE day
        if (dayOfWeek === 0) {
            dayElement.classList.add('event-day');
            dayElement.textContent = `${day} 🐝`;
        } else {
            dayElement.textContent = day;
        }
        
        // Highlight today
        if (currentYear === today.getFullYear() && 
            currentMonth === today.getMonth() && 
            day === today.getDate()) {
            dayElement.classList.add('today');
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

// Initialize calendar on page load
document.addEventListener('DOMContentLoaded', () => {
    updateCalendar();
});

// ICS Calendar Download
function downloadICS(eventId) {
    const events = {
        'feroz-event': {
            title: 'Feroz – Change My Mind Stand',
            description: 'Live-Event mit Publikum, Interaktion & Debatte',
            location: 'Berlin',
            start: '20240413T140000',
            end: '20240413T180000'
        },
        'weekly-stream': {
            title: 'Honigwabe LIVE Stream',
            description: 'Wöchentlicher Livestream mit Shlomo und Kasper - Jeden Sonntag um 18:00 Uhr',
            location: 'Online - Twitch, YouTube, Rumble',
            start: '20240414T180000',
            end: '20240414T210000'
        }
    };
    
    const event = events[eventId];
    if (!event) return;
    
    const icsContent = `BEGIN:VCALENDAR
VERSION:2.0
PRODID:-//Honigwabe LIVE//Events//DE
BEGIN:VEVENT
UID:${eventId}@honigwabe.live
DTSTAMP:${new Date().toISOString().replace(/[-:]/g, '').split('.')[0]}Z
DTSTART:${event.start}
DTEND:${event.end}
SUMMARY:${event.title}
DESCRIPTION:${event.description}
LOCATION:${event.location}
STATUS:CONFIRMED
END:VEVENT
END:VCALENDAR`;
    
    const blob = new Blob([icsContent], { type: 'text/calendar;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${eventId}.ics`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}
