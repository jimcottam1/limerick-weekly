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
    const comingSoonSection = document.querySelector('.coming-soon');

    if (digestData.analysis && digestData.analysis.topStories) {
        const dateStr = new Date().toISOString().split('T')[0];

        // Replace coming soon with actual digest
        const digestHTML = `
            <section class="digest-content">
                <div class="container">
                    <!-- Category Navigation -->
                    <div class="category-nav">
                        <h3>Browse by Section</h3>
                        <div class="category-buttons">
                            <a href="output/sport-${dateStr}.html" class="category-btn sport">
                                <span class="icon">⚽</span>
                                <span class="label">Sport</span>
                            </a>
                            <a href="output/business-${dateStr}.html" class="category-btn business">
                                <span class="icon">💼</span>
                                <span class="label">Business</span>
                            </a>
                            <a href="output/local-${dateStr}.html" class="category-btn local">
                                <span class="icon">🏘️</span>
                                <span class="label">Local</span>
                            </a>
                            <a href="output/events-${dateStr}.html" class="category-btn events">
                                <span class="icon">🎭</span>
                                <span class="label">Events</span>
                            </a>
                            <a href="output/politics-${dateStr}.html" class="category-btn politics">
                                <span class="icon">🏛️</span>
                                <span class="label">Politics</span>
                            </a>
                        </div>
                    </div>

                    <!-- Weekly Overview -->
                    ${digestData.analysis.weeklyOverview ? `
                        <div class="weekly-overview">
                            <h2>This Week in Limerick</h2>
                            <p>${digestData.analysis.weeklyOverview}</p>
                        </div>
                    ` : ''}

                    <!-- Quote of the Week -->
                    ${digestData.analysis.quoteOfTheWeek ? `
                        <div class="quote-highlight">
                            <h3>💬 Quote of the Week</h3>
                            <blockquote>"${digestData.analysis.quoteOfTheWeek.quote}"</blockquote>
                            <p class="quote-author">— ${digestData.analysis.quoteOfTheWeek.speaker}</p>
                            <p class="quote-context">${digestData.analysis.quoteOfTheWeek.context}</p>
                        </div>
                    ` : ''}

                    <!-- Top Stories -->
                    <h2 id="top-stories">🔥 This Week's Top Stories</h2>
                    <div class="top-stories">
                        ${digestData.analysis.topStories.map(story => `
                            <article class="story-card">
                                <div class="story-rank">#${story.rank}</div>
                                <h3>${story.headline}</h3>
                                <p class="story-summary">${story.summary}</p>
                                <div class="story-significance">
                                    <strong>Why it matters:</strong> ${story.significance}
                                </div>
                            </article>
                        `).join('')}
                    </div>

                    <!-- Trends -->
                    ${digestData.analysis.trends ? `
                        <div class="trends-section">
                            <h2>📊 Weekly Trends</h2>
                            <ul class="trends-list">
                                ${digestData.analysis.trends.map(trend => `<li>${trend}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}

                    <!-- Download Full Digest -->
                    <div class="download-section">
                        <h3>📰 Full Weekly Digest</h3>
                        <p>Get the complete newspaper-style digest with all stories and sections.</p>
                        <a href="output/limerick-weekly-${dateStr}.html" class="download-btn" target="_blank">
                            View Full Digest →
                        </a>
                    </div>

                    <div class="view-full">
                        <p>Generated on ${new Date(digestData.timestamp).toLocaleDateString('en-US', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                        })}</p>
                    </div>
                </div>
            </section>
        `;

        comingSoonSection.innerHTML = digestHTML;
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
