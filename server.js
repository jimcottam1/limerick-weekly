require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const Redis = require('ioredis');

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Redis (using Redis URL like windfarm)
let redis = null;
if (process.env.REDIS_URL) {
    try {
        redis = new Redis(process.env.REDIS_URL, {
            retryStrategy: (times) => {
                if (times > 3) return null;
                return Math.min(times * 100, 2000);
            },
            maxRetriesPerRequest: 3
        });
        console.log('✓ Redis connected via REDIS_URL');
    } catch (error) {
        console.warn('⚠️  Redis connection failed:', error.message);
    }
} else {
    // Fallback to local Redis
    redis = new Redis({
        host: process.env.REDIS_HOST || 'localhost',
        port: process.env.REDIS_PORT || 6379,
        password: process.env.REDIS_PASSWORD || undefined,
        retryStrategy: () => null
    });
    console.log('ℹ Using local Redis (no REDIS_URL provided)');
}

redis.on('error', (err) => {
    console.warn('⚠️  Redis connection error:', err.message);
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));
app.use('/output', express.static('output'));
app.use('/articles', express.static('articles-html'));

// Routes
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get latest digest
app.get('/api/digest/latest', async (req, res) => {
    try {
        const digestData = await redis.get('digest:latest');

        if (!digestData) {
            return res.status(404).json({
                error: 'No digest available',
                message: 'Run "npm run generate" to create the first weekly digest'
            });
        }

        const digest = JSON.parse(digestData);
        res.json(digest);
    } catch (error) {
        console.error('Error fetching digest:', error);
        res.status(500).json({ error: 'Failed to fetch digest' });
    }
});

// Get recent articles (rewritten versions with Limerick connections)
app.get('/api/articles/recent', async (req, res) => {
    try {
        console.log('📡 API request: /api/articles/recent');

        const limit = parseInt(req.query.limit) || 50;

        // Check Redis connection
        if (!redis || redis.status !== 'ready') {
            console.error('⚠️  Redis not connected (status: ' + (redis?.status || 'null') + ')');
            return res.status(503).json({
                error: 'Database not available',
                count: 0,
                articles: []
            });
        }

        const articleIds = await redis.zrevrange('articles:by_date', 0, limit - 1);
        console.log(`   Found ${articleIds.length} article IDs in sorted set`);

        if (articleIds.length === 0) {
            console.log(`   No article IDs found`);
            return res.json({ count: 0, articles: [] });
        }

        // Use Redis pipeline for bulk fetch (much faster than individual GETs)
        const pipeline = redis.pipeline();
        articleIds.forEach(id => {
            pipeline.get(`article:rewritten:${id}`);
        });

        const results = await pipeline.exec();
        console.log(`   Pipeline fetch completed`);

        const articles = [];
        const seenUrls = new Set();
        const seenHeadlines = new Set();

        results.forEach((result, index) => {
            const [err, rewrittenData] = result;
            if (!err && rewrittenData) {
                try {
                    const article = JSON.parse(rewrittenData);
                    // Only include articles with Limerick connection
                    if (article.localAngle) {
                        const normalizedUrl = article.originalLink?.toLowerCase().trim();
                        const normalizedHeadline = article.headline?.toLowerCase().trim();

                        // Check for duplicate URL
                        if (seenUrls.has(normalizedUrl)) {
                            console.log(`   Skipping duplicate URL: ${article.headline}`);
                            return;
                        }

                        // Check for duplicate or very similar headline
                        if (seenHeadlines.has(normalizedHeadline)) {
                            console.log(`   Skipping duplicate headline: ${article.headline}`);
                            return;
                        }

                        seenUrls.add(normalizedUrl);
                        seenHeadlines.add(normalizedHeadline);

                        articles.push({
                            id: articleIds[index],
                            ...article
                        });
                    }
                } catch (parseError) {
                    console.error(`   Error parsing article ${articleIds[index]}:`, parseError.message);
                }
            }
        });

        console.log(`   Returning ${articles.length} unique articles with local angles`);

        res.json({
            count: articles.length,
            articles
        });
    } catch (error) {
        console.error('❌ Error fetching articles:', error);
        res.status(500).json({
            error: 'Failed to fetch articles',
            message: error.message,
            count: 0,
            articles: []
        });
    }
});

// Serve individual article HTML page (dynamic from Redis)
app.get('/articles/:id.html', async (req, res) => {
    try {
        const articleId = req.params.id;

        // Try to find the article in Redis by matching the sanitized ID
        const keys = await redis.keys('article:rewritten:*');

        let articleData = null;
        let matchedKey = null;

        for (const key of keys) {
            const id = key.replace('article:rewritten:', '');
            const sanitizedId = id.replace(/[^a-z0-9]/gi, '-');

            if (sanitizedId === articleId) {
                articleData = await redis.get(key);
                matchedKey = id;
                break;
            }
        }

        if (!articleData) {
            return res.status(404).send('<h1>Article Not Found</h1><p>This article may have expired or been removed.</p>');
        }

        const article = JSON.parse(articleData);

        // Generate HTML on-the-fly
        const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.headline} - The Limerick Weekly</title>
    <style>
        body {
            font-family: 'Georgia', 'Times New Roman', serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #fafafa;
        }
        .article {
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #c41e3a;
            text-decoration: none;
            font-weight: bold;
        }
        .back-link:hover {
            text-decoration: underline;
        }
        h1 {
            font-size: 2.5rem;
            line-height: 1.2;
            margin-bottom: 0.5rem;
            color: #1a1a1a;
        }
        .subheadline {
            font-size: 1.3rem;
            color: #666;
            font-style: italic;
            margin-bottom: 1rem;
        }
        .meta {
            color: #999;
            font-size: 0.9rem;
            margin: 1rem 0;
            padding-bottom: 1rem;
            border-bottom: 2px solid #eee;
        }
        .local-angle {
            background: #f0f8ff;
            border-left: 4px solid #c41e3a;
            padding: 1rem;
            margin: 1.5rem 0;
            font-style: italic;
        }
        .story {
            font-size: 1.1rem;
            line-height: 1.8;
        }
        .story p {
            margin-bottom: 1.5rem;
        }
        .pull-quote {
            font-size: 1.4rem;
            font-style: italic;
            color: #c41e3a;
            border-left: 4px solid #c41e3a;
            padding-left: 1.5rem;
            margin: 2rem 0;
        }
        .source {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            color: #666;
            font-size: 0.9rem;
        }
    </style>
</head>
<body>
    <div class="article">
        <a href="/" class="back-link">← Back to The Limerick Weekly</a>

        <h1>${article.headline}</h1>
        ${article.subheadline ? `<div class="subheadline">${article.subheadline}</div>` : ''}

        <div class="meta">
            ${article.originalSource} • ${new Date(article.publishedAt).toLocaleDateString('en-IE', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
            })}
        </div>

        ${article.localAngle ? `<div class="local-angle"><strong>Limerick Connection:</strong> ${article.localAngle}</div>` : ''}

        <div class="story">
            ${article.story.split('\n\n').map(p => `<p>${p}</p>`).join('\n')}
        </div>

        ${article.pullQuote ? `<div class="pull-quote">"${article.pullQuote}"</div>` : ''}

        <div class="source">
            <strong>Original Source:</strong> ${article.originalSource}<br>
            <strong>Published:</strong> ${new Date(article.publishedAt).toLocaleDateString('en-IE')}
        </div>
    </div>
</body>
</html>`;

        res.send(html);
    } catch (error) {
        console.error('Error serving article:', error);
        res.status(500).send('<h1>Error</h1><p>Failed to load article.</p>');
    }
});

// Get single rewritten article (JSON API)
app.get('/api/article/rewritten/:id', async (req, res) => {
    try {
        const data = await redis.get(`article:rewritten:${req.params.id}`);
        if (!data) {
            return res.status(404).json({ error: 'Article not found' });
        }
        res.json(JSON.parse(data));
    } catch (error) {
        console.error('Error fetching article:', error);
        res.status(500).json({ error: 'Failed to fetch article' });
    }
});

// Get stats
app.get('/api/stats', async (req, res) => {
    try {
        const totalArticles = await redis.zcard('articles:by_date') || 0;
        const lastScrape = await redis.get('scrape:last_run');
        const digestData = await redis.get('digest:latest');

        const stats = {
            totalArticles,
            lastScrape,
            hasDigest: !!digestData,
            digestGenerated: digestData ? JSON.parse(digestData).timestamp : null
        };

        // Count sources
        const articleIds = await redis.zrevrange('articles:by_date', 0, 99);
        const sources = new Set();
        for (const id of articleIds) {
            const data = await redis.get(`article:${id}`);
            if (data) {
                const article = JSON.parse(data);
                sources.add(article.source);
            }
        }
        stats.totalSources = sources.size;

        res.json(stats);
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Failed to fetch stats' });
    }
});

// Clear rewritten articles (for regeneration with improved prompts)
app.post('/api/clear-rewrites', async (req, res) => {
    try {
        // Verify authorization token
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        const expectedToken = process.env.UPDATE_TOKEN || 'default-secret-token';

        if (authToken !== expectedToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const clearFiles = req.body?.clearFiles || false;
        console.log(`🗑️  Clear rewrites triggered via API (clearFiles: ${clearFiles})`);

        // Import the clear function
        const { clearRewrites } = require('./scripts/clear-rewrites');

        // Run clear in background (don't wait for completion)
        clearRewrites(clearFiles)
            .then(({ cleared }) => console.log(`✅ Cleared ${cleared} rewritten articles`))
            .catch(err => console.error('❌ Clear rewrites failed:', err));

        // Return immediately
        res.json({
            status: 'started',
            message: 'Clear rewrites triggered successfully',
            clearFiles,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error clearing rewrites:', error);
        res.status(500).json({ error: 'Failed to clear rewrites' });
    }
});

// Trigger daily update (for GitHub Actions)
app.post('/api/trigger-update', async (req, res) => {
    try {
        // Verify authorization token
        const authToken = req.headers.authorization?.replace('Bearer ', '');
        const expectedToken = process.env.UPDATE_TOKEN || 'default-secret-token';

        if (authToken !== expectedToken) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        console.log('🔄 Manual update triggered via API');

        // Import the daily update function
        const { dailyUpdate } = require('./scripts/daily-update');

        // Run update in background (don't wait for completion)
        dailyUpdate()
            .then(() => console.log('✅ Scheduled update completed'))
            .catch(err => console.error('❌ Scheduled update failed:', err));

        // Return immediately
        res.json({
            status: 'started',
            message: 'Daily update triggered successfully',
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error triggering update:', error);
        res.status(500).json({ error: 'Failed to trigger update' });
    }
});

// Start server
app.listen(PORT, () => {
    console.log(`🗞️  The Limerick Weekly server running on http://localhost:${PORT}`);
    console.log(`📰 Ready to aggregate local news!`);
});

module.exports = app;

