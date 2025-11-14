/* The Limerick Weekly - Frontend */

document.addEventListener('DOMContentLoaded', function() {
    // Set current date range
    const dateElement = document.getElementById('currentDate');
    if (dateElement) {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(today.getDate() - 7);

        const options = { month: 'long', day: 'numeric', year: 'numeric' };
        const dateRange = `${weekAgo.toLocaleDateString('en-US', options)} - ${today.toLocaleDateString('en-US', options)}`;
        dateElement.textContent = dateRange;
    }

    // Animate stats
    animateValue('totalArticles', 0, 0, 1000);
    animateValue('totalSources', 0, 0, 1000);
    animateValue('totalStories', 0, 0, 1000);
});

function animateValue(id, start, end, duration) {
    const element = document.getElementById(id);
    if (!element) return;

    const range = end - start;
    const increment = range / (duration / 16);
    let current = start;

    const timer = setInterval(() => {
        current += increment;
        if (current >= end) {
            current = end;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 16);
}
