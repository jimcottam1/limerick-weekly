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

    // Load stats and data
    loadStats();
    loadDigest();
});

/**
 * Fetch and display stats
 */
async function loadStats() {
    try {
        const response = await fetch('/api/stats');
        const stats = await response.json();

        // Animate stats
        animateValue('totalArticles', 0, stats.totalArticles || 0, 1000);
        animateValue('totalSources', 0, stats.totalSources || 0, 1000);
        animateValue('totalStories', 0, stats.hasDigest ? 10 : 0, 1000);

        // Update last scrape time if available
        if (stats.lastScrape) {
            console.log('Last scrape:', new Date(stats.lastScrape).toLocaleString());
        }
    } catch (error) {
        console.error('Error loading stats:', error);
        // Show zeros on error
        animateValue('totalArticles', 0, 0, 500);
        animateValue('totalSources', 0, 0, 500);
        animateValue('totalStories', 0, 0, 500);
    }
}

/**
 * Fetch and display latest digest
 */
async function loadDigest() {
    try {
        const response = await fetch('/api/digest/latest');

        if (!response.ok) {
            if (response.status === 404) {
                console.log('No digest available yet');
                return;
            }
            throw new Error(`HTTP ${response.status}`);
        }

        const digestData = await response.json();
        displayDigest(digestData);
    } catch (error) {
        console.error('Error loading digest:', error);
    }
}

/**
 * Display digest content on the page
 */
function displayDigest(digestData) {
    const storiesContainer = document.getElementById('storiesContainer');

    if (digestData.analysis && digestData.analysis.topStories && storiesContainer) {
        // Display top 6 stories
        const storiesHTML = digestData.analysis.topStories.slice(0, 6).map(story => `
            <article class="story-card">
                <div class="story-rank">#${story.rank}</div>
                <h3>${story.headline}</h3>
                <p class="story-summary">${story.summary}</p>
                <div class="story-significance">
                    <strong>Why it matters:</strong> ${story.significance}
                </div>
            </article>
        `).join('');

        storiesContainer.innerHTML = storiesHTML;
    }
}

/**
 * Animate number values
 */
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
