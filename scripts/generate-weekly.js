require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Redis = require('ioredis');
const fs = require('fs').promises;
const path = require('path');

// Initialize Redis (using Redis URL like windfarm)
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

/**
 * Get recent articles from Redis - prioritize rewritten articles with full content
 */
async function getRecentArticles(limit = 50) {
    try {
        // Get article IDs sorted by date (most recent first)
        const articleIds = await redis.zrevrange('articles:by_date', 0, limit - 1);

        if (articleIds.length === 0) {
            console.log('⚠️  No articles found in database');
            return [];
        }

        // Fetch article data, preferring rewritten versions
        const articles = [];
        for (const id of articleIds) {
            // Try to get rewritten version first (has full content)
            let data = await redis.get(`article:rewritten:${id}`);

            if (data) {
                const rewritten = JSON.parse(data);
                // Convert rewritten format to analysis format
                articles.push({
                    id: id,
                    title: rewritten.headline,
                    description: rewritten.story,
                    link: rewritten.originalLink,
                    source: rewritten.originalSource,
                    pubDate: rewritten.publishedAt,
                    imageUrl: rewritten.imageUrl,
                    pullQuote: rewritten.pullQuote,
                    localAngle: rewritten.localAngle
                });
            } else {
                // Fallback to original article
                data = await redis.get(`article:${id}`);
                if (data) {
                    articles.push(JSON.parse(data));
                }
            }
        }

        // Filter for Limerick-related articles only (those with localAngle from rewriting)
        const limerickArticles = articles.filter(article => article.localAngle);

        console.log(`   ✓ Found ${articles.length} total articles, ${limerickArticles.length} Limerick-related`);

        return limerickArticles;
    } catch (error) {
        console.error('Error fetching articles:', error.message);
        return [];
    }
}

/**
 * Analyze articles with AI to identify top stories and trends
 */
async function analyzeArticles(articles) {
    console.log(`\n🤖 Analyzing ${articles.length} articles with AI...`);

    // Use the newer, faster Gemini Flash Lite model (same as windfarm)
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    // Prepare article summaries for AI - now with full content
    const articleSummaries = articles.map((article, index) => {
        const content = article.description || '';
        // Use full content if available (rewritten articles), otherwise use first 1000 chars
        const summary = content.length > 1000 ? content.substring(0, 1000) + '...' : content;
        return `[${index + 1}] ${article.title}\n   Source: ${article.source}\n   Content: ${summary}\n`;
    }).join('\n');

    const prompt = `You are an AI editor for "The Limerick Weekly", a premium local news digest for Limerick, Ireland.

Your mission: Create an engaging, insightful weekly digest that helps Limerick residents stay informed about what matters most in their community.

ARTICLES TO ANALYZE (${articles.length} from the past week):
${articleSummaries}

EDITORIAL GUIDELINES:
- Write like a professional local journalist who knows Limerick well
- Focus on stories that directly impact Limerick residents
- Prioritize local angles over national/international news
- Be objective but engaging - make people want to read
- Highlight community impact and human interest
- Connect stories to broader trends when relevant

Please provide your analysis in the following JSON format:
{
  "topStories": [
    {
      "rank": 1,
      "articleIndex": <index number from list>,
      "headline": "<compelling headline>",
      "summary": "<2-3 sentence summary>",
      "significance": "<why this story matters to Limerick>"
    }
  ],
  "weeklyOverview": "<3-4 paragraph overview of the week's news in Limerick>",
  "trends": [
    "<trend 1: what's happening in Limerick>",
    "<trend 2>",
    "<trend 3>"
  ],
  "quoteOfTheWeek": {
    "quote": "<the actual quote>",
    "speaker": "<name and title>",
    "context": "<brief context about the quote>"
  },
  "lookingAhead": "<paragraph about what's coming next week>",
  "categories": {
    "local": [<article indices>],
    "business": [<article indices>],
    "sports": [<article indices>],
    "events": [<article indices>],
    "politics": [<article indices>],
    "other": [<article indices>]
  }
}

Instructions:
1. **Top Stories (10)**: Select the most newsworthy stories for Limerick residents
   - Prioritize: Local impact, community interest, human stories
   - Write compelling headlines (not just article titles)
   - 2-3 sentence summaries that tell the story
   - Explain "why it matters" from a Limerick perspective

2. **Weekly Overview (3-4 paragraphs)**: Paint the big picture
   - What defined this week in Limerick?
   - Connect different stories into a narrative
   - Highlight wins, challenges, and what's next
   - Write in an engaging, accessible style

3. **Trends (3-5)**: Identify emerging patterns
   - What themes emerged this week?
   - What should residents pay attention to?
   - Connect local and broader developments

4. **Quote of the Week**: Find the most impactful quote from any article
   - Must be from a Limerick person/context
   - Include speaker name and context

5. **Looking Ahead**: What's coming next week?
   - Upcoming events, decisions, or developments
   - What should residents watch for?

6. **Categories**: Sort ALL articles appropriately
   - Local: Pure Limerick news
   - Business: Economic, development, jobs
   - Sports: GAA, rugby, local teams
   - Events: Cultural, community, entertainment
   - Politics: Local and national politics affecting Limerick
   - Other: Everything else

QUALITY STANDARDS:
- Make it readable and engaging, not dry
- Focus on Limerick - skip stories with weak local connection
- Write for busy people who want the essentials
- Be informative but not boring

Return ONLY valid JSON, no additional text.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        // Extract JSON from response
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
 * Generate weekly digest HTML
 */
function generateDigestHTML(analysis, articles) {
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
    <title>The Limerick Weekly - ${formatDate(weekStart)} to ${formatDate(now)}</title>
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.7;
            max-width: 900px;
            margin: 0 auto;
            padding: 20px;
            background: #fafafa;
            color: #1a1a1a;
        }
        .container {
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.05);
            border-radius: 8px;
        }
        .masthead {
            text-align: center;
            border-bottom: 4px double #c41e3a;
            padding-bottom: 30px;
            margin-bottom: 40px;
        }
        .masthead h1 {
            font-family: Georgia, serif;
            font-size: 3.5em;
            margin: 0;
            letter-spacing: 0.03em;
            color: #c41e3a;
            font-weight: 700;
        }
        .issue-date {
            color: #666;
            font-size: 1.1em;
            margin: 10px 0;
        }
        .tagline {
            color: #999;
            font-size: 0.9em;
            font-style: italic;
        }
        .overview {
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 30px;
            margin: 40px 0;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(102, 126, 234, 0.3);
        }
        .overview h2 {
            color: white;
            margin-top: 0;
            font-size: 1.8em;
        }
        .overview p {
            font-size: 1.05em;
            line-height: 1.8;
        }
        .quote-of-week {
            background: #fffbea;
            border-left: 4px solid #f0c419;
            padding: 25px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .quote-of-week blockquote {
            margin: 0;
            font-size: 1.3em;
            font-style: italic;
            color: #333;
            line-height: 1.6;
        }
        .quote-of-week .speaker {
            margin-top: 15px;
            font-weight: 600;
            color: #666;
        }
        .quote-of-week .context {
            margin-top: 5px;
            font-size: 0.9em;
            color: #888;
        }
        .section-header {
            border-bottom: 3px solid #c41e3a;
            padding-bottom: 10px;
            margin: 50px 0 30px 0;
            font-size: 2em;
            font-weight: 700;
            color: #1a1a1a;
        }
        .story {
            margin: 35px 0;
            padding: 25px 0;
            border-bottom: 1px solid #e0e0e0;
        }
        .story:last-child {
            border-bottom: none;
        }
        .story-rank {
            display: inline-block;
            background: #c41e3a;
            color: white;
            padding: 5px 12px;
            border-radius: 4px;
            font-weight: bold;
            font-size: 0.9em;
            margin-bottom: 10px;
        }
        .story-headline {
            font-size: 1.7em;
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
        .story-significance strong {
            color: #2196f3;
        }
        .trends {
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            padding: 30px;
            margin: 40px 0;
            border-radius: 8px;
            box-shadow: 0 4px 15px rgba(17, 153, 142, 0.3);
        }
        .trends h2 {
            margin-top: 0;
            color: white;
            font-size: 1.8em;
        }
        .trends ul {
            list-style: none;
            padding: 0;
        }
        .trends li {
            padding: 15px 0;
            border-bottom: 1px solid rgba(255,255,255,0.2);
            font-size: 1.05em;
            line-height: 1.6;
        }
        .trends li:last-child {
            border-bottom: none;
        }
        .trends li:before {
            content: "📈 ";
            font-size: 1.2em;
        }
        .looking-ahead {
            background: #fff3e0;
            border-left: 4px solid #ff9800;
            padding: 25px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .looking-ahead h3 {
            margin-top: 0;
            color: #ff9800;
            font-size: 1.4em;
        }
        .looking-ahead p {
            color: #666;
            line-height: 1.7;
        }
        .read-more {
            display: inline-block;
            margin-top: 15px;
            padding: 10px 20px;
            background: #c41e3a;
            color: white;
            text-decoration: none;
            font-weight: 600;
            border-radius: 4px;
            transition: background 0.3s;
        }
        .read-more:hover {
            background: #a01528;
        }
        .footer {
            text-align: center;
            margin-top: 60px;
            padding-top: 30px;
            border-top: 2px solid #e0e0e0;
            color: #999;
        }
        .footer a {
            color: #c41e3a;
            text-decoration: none;
        }
        .nav-bar {
            display: flex;
            gap: 15px;
            justify-content: center;
            flex-wrap: wrap;
            margin: 30px 0;
            padding: 20px 0;
            border-top: 2px solid #e0e0e0;
            border-bottom: 2px solid #e0e0e0;
        }
        .nav-link {
            text-decoration: none;
            color: #666;
            padding: 10px 20px;
            border-radius: 6px;
            transition: all 0.3s;
            font-weight: 600;
            background: #f5f5f5;
        }
        .nav-link:hover {
            background: #c41e3a;
            color: white;
            transform: translateY(-2px);
        }
        @media (max-width: 600px) {
            .container { padding: 20px; }
            .masthead h1 { font-size: 2.5em; }
            .story-headline { font-size: 1.4em; }
            .nav-bar { gap: 8px; }
            .nav-link { padding: 8px 12px; font-size: 0.9em; }
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="masthead">
            <h1>THE LIMERICK WEEKLY</h1>
            <p class="issue-date">${formatDate(weekStart)} - ${formatDate(now)}</p>
            <p class="tagline">Your AI-Curated Local News Digest</p>
        </div>

        <nav class="nav-bar">
            <a href="sport-${now.toISOString().split('T')[0]}.html" class="nav-link">⚽ Sport</a>
            <a href="business-${now.toISOString().split('T')[0]}.html" class="nav-link">💼 Business</a>
            <a href="local-${now.toISOString().split('T')[0]}.html" class="nav-link">🏘️ Local</a>
            <a href="events-${now.toISOString().split('T')[0]}.html" class="nav-link">🎭 Events</a>
            <a href="politics-${now.toISOString().split('T')[0]}.html" class="nav-link">🏛️ Politics</a>
        </nav>

        <div class="overview">
            <h2>This Week in Limerick</h2>
            ${analysis.weeklyOverview.split('\n\n').map(p => `<p>${p.trim()}</p>`).join('')}
        </div>

        ${analysis.quoteOfTheWeek ? `
        <div class="quote-of-week">
            <blockquote>"${analysis.quoteOfTheWeek.quote}"</blockquote>
            <div class="speaker">— ${analysis.quoteOfTheWeek.speaker}</div>
            <div class="context">${analysis.quoteOfTheWeek.context}</div>
        </div>
        ` : ''}

        <h2 class="section-header">🔥 Top Stories</h2>
`;

    // Add top stories
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

    // Add trends section
    if (analysis.trends && analysis.trends.length > 0) {
        html += `
        <div class="trends">
            <h2>📊 Weekly Trends & Insights</h2>
            <ul>
${analysis.trends.map(trend => `                <li>${trend}</li>`).join('\n')}
            </ul>
        </div>
`;
    }

    // Add looking ahead section
    if (analysis.lookingAhead) {
        html += `
        <div class="looking-ahead">
            <h3>🔮 Looking Ahead</h3>
            <p>${analysis.lookingAhead}</p>
        </div>
`;
    }

    html += `
        <div class="footer">
            <p><strong>The Limerick Weekly</strong></p>
            <p>AI-powered local news aggregation powered by <a href="https://gemini.google.com" target="_blank">Google Gemini AI</a></p>
            <p><small>Sources: NewsAPI, Irish Times, RTÉ, Journal.ie, and more</small></p>
            <p style="margin-top: 20px; font-size: 0.85em;">
                Generated on ${new Date().toLocaleDateString('en-IE', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                })}
            </p>
        </div>
    </div>
</body>
</html>`;

    return html;
}

/**
 * Save digest to Redis and file
 */
async function saveDigest(digest, articles, analysis) {
    const timestamp = new Date().toISOString();
    const digestData = {
        timestamp,
        articles: articles.length,
        digest,
        analysis,
        generatedAt: timestamp
    };

    // Save to Redis
    await redis.set('digest:latest', JSON.stringify(digestData));
    await redis.zadd('digest:history', Date.now(), timestamp);

    // Save HTML to file
    const outputDir = path.join(__dirname, '..', 'output');
    try {
        await fs.mkdir(outputDir, { recursive: true });
    } catch (error) {
        // Directory might already exist
    }

    const filename = `limerick-weekly-${new Date().toISOString().split('T')[0]}.html`;
    const filepath = path.join(outputDir, filename);
    await fs.writeFile(filepath, digest);

    console.log(`\n✓ Digest saved to: ${filepath}`);
    console.log(`✓ Digest cached in Redis`);

    return { filepath, digestData };
}

/**
 * Main generation function
 */
async function generateWeekly() {
    console.log('📰 The Limerick Weekly - AI Generation\n');
    console.log('='.repeat(50));

    try {
        // Step 1: Fetch recent articles
        const limit = parseInt(process.env.ARTICLES_TO_ANALYZE || '50');
        console.log(`\n📚 Fetching up to ${limit} recent articles...`);
        const articles = await getRecentArticles(limit);

        if (articles.length === 0) {
            console.log('\n⚠️  No articles available. Run "npm run scrape" first.');
            return null;
        }

        console.log(`✓ Found ${articles.length} articles to analyze`);

        // Group by source
        const sources = {};
        articles.forEach(article => {
            sources[article.source] = (sources[article.source] || 0) + 1;
        });
        console.log('\n📊 Articles by source:');
        Object.entries(sources).forEach(([source, count]) => {
            console.log(`   ${source}: ${count} articles`);
        });

        // Step 2: Analyze with AI
        const analysis = await analyzeArticles(articles);

        // Step 3: Generate HTML digest
        console.log('\n📝 Generating weekly digest...');
        const digestHTML = generateDigestHTML(analysis, articles);

        // Step 4: Save digest
        const result = await saveDigest(digestHTML, articles, analysis);

        console.log('\n' + '='.repeat(50));
        console.log('✅ Weekly digest generated successfully!');
        console.log(`   Top stories: ${analysis.topStories.length}`);
        console.log(`   Trends identified: ${analysis.trends.length}`);
        console.log(`   Articles analyzed: ${articles.length}`);
        console.log('='.repeat(50));

        return result;
    } catch (error) {
        console.error('\n❌ Generation failed:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    generateWeekly()
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

module.exports = { generateWeekly, getRecentArticles, analyzeArticles };
