require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

// Initialize Redis
let redis = null;
if (process.env.REDIS_URL) {
    redis = new Redis(process.env.REDIS_URL);
} else {
    redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined
    });
}

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Category configurations
const CATEGORIES = {
    sport: {
        title: 'Sport',
        icon: '⚽',
        color: '#28a745',
        description: 'Limerick sports news - GAA, rugby, soccer, and more',
        keywords: ['GAA', 'hurling', 'rugby', 'Munster', 'football', 'sport', 'match', 'final', 'championship']
    },
    business: {
        title: 'Business',
        icon: '💼',
        color: '#007bff',
        description: 'Business, economy, and development in Limerick',
        keywords: ['business', 'economy', 'jobs', 'development', 'investment', 'company', 'enterprise']
    },
    local: {
        title: 'Local News',
        icon: '🏘️',
        color: '#6f42c1',
        description: 'Community news and local stories from Limerick',
        keywords: ['Limerick', 'community', 'local', 'council', 'residents', 'neighbourhood']
    },
    events: {
        title: 'Events & Culture',
        icon: '🎭',
        color: '#fd7e14',
        description: 'Arts, culture, and events happening in Limerick',
        keywords: ['event', 'festival', 'concert', 'culture', 'arts', 'music', 'theatre', 'exhibition']
    },
    politics: {
        title: 'Politics',
        icon: '🏛️',
        color: '#dc3545',
        description: 'Political news affecting Limerick',
        keywords: ['politics', 'government', 'TD', 'council', 'election', 'policy', 'minister']
    }
};

/**
 * Get recent articles from Redis
 */
async function getRecentArticles(limit = 100) {
    try {
        const articleIds = await redis.zrevrange('articles:by_date', 0, limit - 1);

        if (articleIds.length === 0) {
            console.log('⚠️  No articles found in database');
            return [];
        }

        const articles = [];
        for (const id of articleIds) {
            const data = await redis.get(`article:${id}`);
            if (data) {
                articles.push(JSON.parse(data));
            }
        }

        return articles;
    } catch (error) {
        console.error('Error fetching articles:', error.message);
        return [];
    }
}

/**
 * Filter articles by category
 */
function filterArticlesByCategory(articles, category) {
    const config = CATEGORIES[category];
    if (!config) return [];

    return articles.filter(article => {
        const text = `${article.title} ${article.description}`.toLowerCase();
        return config.keywords.some(keyword => text.includes(keyword.toLowerCase()));
    });
}

/**
 * Analyze category articles with AI
 */
async function analyzeCategoryArticles(articles, category) {
    const config = CATEGORIES[category];
    console.log(`\n🤖 Analyzing ${articles.length} ${config.title} articles with AI...`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const articleSummaries = articles.map((article, index) => {
        return `[${index + 1}] ${article.title}\n   Source: ${article.source}\n   Summary: ${article.description.substring(0, 200)}...\n`;
    }).join('\n');

    const prompt = `You are an AI editor for "The Limerick Weekly" ${config.title} section.

Analyze these ${articles.length} ${config.title.toLowerCase()} articles from Limerick and create an engaging section page.

ARTICLES:
${articleSummaries}

Create a JSON response with:
{
  "topStories": [
    {
      "rank": 1,
      "articleIndex": <index>,
      "headline": "<compelling headline>",
      "summary": "<2-3 sentences>",
      "significance": "<why it matters>"
    }
  ],
  "sectionOverview": "<2-3 paragraph overview of ${config.title.toLowerCase()} news this week>",
  "highlights": [
    "<key highlight 1>",
    "<key highlight 2>",
    "<key highlight 3>"
  ],
  "quoteOfSection": {
    "quote": "<quote>",
    "speaker": "<name>",
    "context": "<context>"
  }
}

Select up to 8 most interesting stories for this section.
Focus on Limerick-specific ${config.title.toLowerCase()} news.
Return ONLY valid JSON, no additional text.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in AI response');
        }

        const analysis = JSON.parse(jsonMatch[0]);
        console.log('✓ AI analysis complete');

        return analysis;
    } catch (error) {
        console.error('Error analyzing with AI:', error.message);
        throw error;
    }
}

/**
 * Generate category page HTML
 */
function generateCategoryHTML(category, analysis, articles) {
    const config = CATEGORIES[category];
    const now = new Date();
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 7);

    const formatDate = (date) => {
        return date.toLocaleDateString('en-IE', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const getArticle = (index) => articles[index - 1];

    let html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>The Limerick Weekly - ${config.title}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            margin: 0;
            padding: 20px;
            background: #fafafa;
            color: #1a1a1a;
        }
        .container {
            max-width: 900px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            border-radius: 8px;
        }
        .header {
            text-align: center;
            margin-bottom: 40px;
        }
        .site-title {
            font-family: Georgia, serif;
            font-size: 2em;
            color: #c41e3a;
            margin: 0;
        }
        .nav-bar {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            margin: 20px 0;
            padding: 15px 0;
            border-top: 1px solid #e0e0e0;
            border-bottom: 1px solid #e0e0e0;
        }
        .nav-link {
            text-decoration: none;
            color: #666;
            padding: 8px 15px;
            border-radius: 4px;
            transition: all 0.3s;
            font-weight: 500;
        }
        .nav-link:hover {
            background: #f0f0f0;
            color: #333;
        }
        .nav-link.active {
            background: ${config.color};
            color: white;
        }
        .category-header {
            text-align: center;
            padding: 40px 20px;
            background: linear-gradient(135deg, ${config.color} 0%, ${config.color}dd 100%);
            color: white;
            border-radius: 8px;
            margin-bottom: 40px;
        }
        .category-icon {
            font-size: 4em;
            margin-bottom: 10px;
        }
        .category-title {
            font-size: 3em;
            margin: 10px 0;
            font-weight: 700;
        }
        .category-description {
            font-size: 1.1em;
            opacity: 0.95;
        }
        .date-range {
            margin-top: 15px;
            font-size: 0.95em;
            opacity: 0.9;
        }
        .overview {
            background: #f8f9fa;
            padding: 30px;
            margin: 30px 0;
            border-left: 4px solid ${config.color};
            border-radius: 4px;
        }
        .overview h2 {
            margin-top: 0;
            color: ${config.color};
        }
        .highlights {
            background: #fff3cd;
            padding: 25px;
            margin: 30px 0;
            border-radius: 4px;
            border-left: 4px solid #ffc107;
        }
        .highlights h3 {
            margin-top: 0;
            color: #856404;
        }
        .highlights ul {
            margin: 15px 0;
            padding-left: 25px;
        }
        .highlights li {
            margin: 10px 0;
            line-height: 1.6;
        }
        .quote-section {
            background: #e7f3ff;
            padding: 25px;
            margin: 30px 0;
            border-radius: 4px;
            border-left: 4px solid #2196f3;
        }
        .quote-section blockquote {
            margin: 0;
            font-size: 1.2em;
            font-style: italic;
            color: #333;
        }
        .quote-section .speaker {
            margin-top: 10px;
            font-weight: 600;
            color: #555;
        }
        .section-header {
            border-bottom: 3px solid ${config.color};
            padding-bottom: 10px;
            margin: 40px 0 30px 0;
            font-size: 1.8em;
            font-weight: 700;
            color: #1a1a1a;
        }
        .story {
            margin: 30px 0;
            padding: 25px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .story:last-child {
            border-bottom: none;
        }
        .story-rank {
            display: inline-block;
            background: ${config.color};
            color: white;
            padding: 5px 12px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        .story-headline {
            font-size: 1.6em;
            margin: 15px 0;
            font-weight: 700;
            line-height: 1.3;
            color: #1a1a1a;
        }
        .story-source {
            color: #999;
            font-size: 0.85em;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 15px;
        }
        .story-summary {
            margin: 20px 0;
            font-size: 1.05em;
            color: #444;
            line-height: 1.7;
        }
        .story-significance {
            background: #f0f7ff;
            padding: 15px 20px;
            border-left: 3px solid #2196f3;
            border-radius: 4px;
            margin: 15px 0;
        }
        .read-more {
            display: inline-block;
            margin-top: 15px;
            padding: 10px 20px;
            background: ${config.color};
            color: white;
            text-decoration: none;
            font-weight: 600;
            border-radius: 4px;
            transition: background 0.3s;
        }
        .read-more:hover {
            opacity: 0.9;
        }
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #e0e0e0;
            color: #999;
        }
        @media (max-width: 600px) {
            .container { padding: 20px; }
            .category-title { font-size: 2em; }
            .story-headline { font-size: 1.3em; }
            .nav-bar { gap: 8px; }
            .nav-link { padding: 6px 10px; font-size: 0.9em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1 class="site-title">THE LIMERICK WEEKLY</h1>

            <nav class="nav-bar">
                <a href="limerick-weekly-${now.toISOString().split('T')[0]}.html" class="nav-link">Home</a>
                <a href="sport-${now.toISOString().split('T')[0]}.html" class="nav-link ${category === 'sport' ? 'active' : ''}">⚽ Sport</a>
                <a href="business-${now.toISOString().split('T')[0]}.html" class="nav-link ${category === 'business' ? 'active' : ''}">💼 Business</a>
                <a href="local-${now.toISOString().split('T')[0]}.html" class="nav-link ${category === 'local' ? 'active' : ''}">🏘️ Local</a>
                <a href="events-${now.toISOString().split('T')[0]}.html" class="nav-link ${category === 'events' ? 'active' : ''}">🎭 Events</a>
                <a href="politics-${now.toISOString().split('T')[0]}.html" class="nav-link ${category === 'politics' ? 'active' : ''}">🏛️ Politics</a>
            </nav>
        </div>

        <div class="category-header">
            <div class="category-icon">${config.icon}</div>
            <h1 class="category-title">${config.title}</h1>
            <p class="category-description">${config.description}</p>
            <p class="date-range">${formatDate(weekStart)} - ${formatDate(now)}</p>
        </div>

        <div class="overview">
            <h2>This Week in ${config.title}</h2>
            ${analysis.sectionOverview.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('')}
        </div>

        ${analysis.highlights && analysis.highlights.length > 0 ? `
        <div class="highlights">
            <h3>📌 Key Highlights</h3>
            <ul>
${analysis.highlights.map(h => `                <li>${h}</li>`).join('\n')}
            </ul>
        </div>
        ` : ''}

        ${analysis.quoteOfSection ? `
        <div class="quote-section">
            <blockquote>"${analysis.quoteOfSection.quote}"</blockquote>
            <div class="speaker">— ${analysis.quoteOfSection.speaker}</div>
            ${analysis.quoteOfSection.context ? `<div style="margin-top: 5px; font-size: 0.9em; color: #666;">${analysis.quoteOfSection.context}</div>` : ''}
        </div>
        ` : ''}

        <h2 class="section-header">Top Stories</h2>
`;

    // Add stories
    for (const story of analysis.topStories) {
        const article = getArticle(story.articleIndex);
        if (!article) continue;

        html += `
        <div class="story">
            <div class="story-rank">#${story.rank}</div>
            <h3 class="story-headline">${story.headline}</h3>
            <div class="story-source">Source: ${article.source} • ${new Date(article.pubDate).toLocaleDateString('en-IE')}</div>
            <p class="story-summary">${story.summary}</p>
            <div class="story-significance">
                <strong>Why it matters:</strong> ${story.significance}
            </div>
            <a href="${article.link}" class="read-more" target="_blank">Read full article →</a>
        </div>
`;
    }

    html += `
        <div class="footer">
            <p><strong>The Limerick Weekly - ${config.title}</strong></p>
            <p>Part of your AI-curated local news digest</p>
            <p><small>Generated on ${new Date().toLocaleDateString('en-IE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
            })}</small></p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

/**
 * Generate all category pages
 */
async function generateAllCategories() {
    console.log('📰 Generating Category Pages...\n');
    console.log('='.repeat(50));

    try {
        // Get all recent articles
        console.log('\n📚 Fetching articles from Redis...');
        const allArticles = await getRecentArticles(100);

        if (allArticles.length === 0) {
            console.log('\n⚠️  No articles available. Run "npm run scrape" first.');
            return null;
        }

        console.log(`✓ Found ${allArticles.length} total articles`);

        const outputDir = path.join(__dirname, '..', 'output');
        const dateStr = new Date().toISOString().split('T')[0];

        // Generate each category page
        for (const [categoryKey, config] of Object.entries(CATEGORIES)) {
            console.log(`\n${config.icon} Processing ${config.title}...`);

            // Filter articles for this category
            const categoryArticles = filterArticlesByCategory(allArticles, categoryKey);
            console.log(`   ✓ Found ${categoryArticles.length} ${config.title.toLowerCase()} articles`);

            if (categoryArticles.length === 0) {
                console.log(`   ⊘ Skipping ${config.title} - no articles found`);
                continue;
            }

            // Analyze with AI
            const analysis = await analyzeCategoryArticles(categoryArticles, categoryKey);

            // Generate HTML
            const html = generateCategoryHTML(categoryKey, analysis, categoryArticles);

            // Save to file
            const filename = `${categoryKey}-${dateStr}.html`;
            const filepath = path.join(outputDir, filename);
            await fs.writeFile(filepath, html);

            console.log(`   ✓ Generated: ${filename}`);
            console.log(`   ✓ Stories: ${analysis.topStories.length}`);
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ All category pages generated successfully!');
        console.log('='.repeat(50));

    } catch (error) {
        console.error('\n❌ Generation failed:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    generateAllCategories()
        .then(() => {
            console.log('\n🎉 Done!');
            redis.disconnect();
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error:', error);
            redis.disconnect();
            process.exit(1);
        });
}

module.exports = { generateAllCategories };
