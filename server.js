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
    res.sendFile(path.join(__dirname, 'public', 'limerick-news.html'));
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
        const limit = parseInt(req.query.limit) || 50;
        const articleIds = await redis.zrevrange('articles:by_date', 0, limit - 1);

        const articles = [];
        for (const id of articleIds) {
            // Try to get rewritten version first
            const rewrittenData = await redis.get(`article:rewritten:${id}`);
            if (rewrittenData) {
                const article = JSON.parse(rewrittenData);
                // Only include articles with Limerick connection
                if (article.localAngle) {
                    articles.push({
                        id: id,
                        ...article
                    });
                }
            }
        }

        res.json({
            count: articles.length,
            articles
        });
    } catch (error) {
        console.error('Error fetching articles:', error);
        res.status(500).json({ error: 'Failed to fetch articles' });
    }
});

// Get single rewritten article
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

