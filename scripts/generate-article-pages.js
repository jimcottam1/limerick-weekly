require('dotenv').config();
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

/**
 * Generate HTML page for a single article
 */
function generateArticleHTML(article, articleId) {
    const dateStr = new Date(article.publishedAt).toLocaleDateString('en-IE', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${article.headline} - The Limerick Weekly</title>
    <meta name="description" content="${article.subheadline || article.headline}">
    <style>
        * { box-sizing: border-box; }
        body {
            font-family: Georgia, serif;
            line-height: 1.8;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: #f9f9f9;
            color: #1a1a1a;
        }
        .article-container {
            background: white;
            padding: 40px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            border-radius: 8px;
        }
        .site-header {
            text-align: center;
            margin-bottom: 30px;
            padding-bottom: 20px;
            border-bottom: 3px double #c41e3a;
        }
        .site-title {
            font-size: 2em;
            color: #c41e3a;
            margin: 0;
            font-weight: 700;
        }
        .back-link {
            display: inline-block;
            margin-bottom: 20px;
            color: #666;
            text-decoration: none;
            font-size: 0.9em;
        }
        .back-link:hover {
            color: #c41e3a;
        }
        .article-headline {
            font-size: 2.5em;
            line-height: 1.2;
            margin: 20px 0;
            font-weight: 700;
        }
        .article-subheadline {
            font-size: 1.3em;
            color: #666;
            margin: 15px 0;
            font-style: italic;
        }
        .article-meta {
            color: #999;
            font-size: 0.9em;
            margin: 20px 0;
            padding: 15px 0;
            border-top: 1px solid #e0e0e0;
            border-bottom: 1px solid #e0e0e0;
        }
        .article-image {
            width: 100%;
            height: auto;
            margin: 30px 0;
            border-radius: 4px;
        }
        .pull-quote {
            background: #fffbea;
            border-left: 4px solid #f0c419;
            padding: 20px 30px;
            margin: 30px 0;
            font-size: 1.3em;
            font-style: italic;
            color: #333;
        }
        .article-story {
            font-size: 1.1em;
            line-height: 1.9;
        }
        .article-story p {
            margin: 20px 0;
        }
        .local-angle {
            background: #e7f3ff;
            border-left: 4px solid #2196f3;
            padding: 20px;
            margin: 30px 0;
            border-radius: 4px;
        }
        .local-angle h3 {
            margin-top: 0;
            color: #2196f3;
        }
        .source-attribution {
            background: #f5f5f5;
            padding: 20px;
            margin: 40px 0;
            border-radius: 4px;
            font-size: 0.9em;
        }
        .source-attribution h4 {
            margin-top: 0;
            color: #666;
        }
        .original-link {
            display: inline-block;
            margin-top: 10px;
            color: #c41e3a;
            text-decoration: none;
            font-weight: 600;
        }
        .original-link:hover {
            text-decoration: underline;
        }
        .ai-badge {
            display: inline-block;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            padding: 5px 12px;
            border-radius: 4px;
            font-size: 0.8em;
            margin-bottom: 10px;
        }
        .footer {
            text-align: center;
            margin-top: 50px;
            padding-top: 30px;
            border-top: 2px solid #e0e0e0;
            color: #999;
            font-size: 0.9em;
        }
        @media (max-width: 600px) {
            .article-container { padding: 20px; }
            .article-headline { font-size: 1.8em; }
        }
    </style>
</head>
<body>
    <div class="article-container">
        <div class="site-header">
            <h1 class="site-title">THE LIMERICK WEEKLY</h1>
        </div>

        <a href="/" class="back-link">← Back to Home</a>

        <div class="ai-badge">✨ AI-Generated Article</div>

        <h1 class="article-headline">${article.headline}</h1>

        ${article.subheadline ? `<p class="article-subheadline">${article.subheadline}</p>` : ''}

        <div class="article-meta">
            Published: ${dateStr}
        </div>

        ${article.imageUrl ? `<img src="${article.imageUrl}" alt="${article.headline}" class="article-image">` : ''}

        ${article.pullQuote ? `
            <div class="pull-quote">
                ${article.pullQuote}
            </div>
        ` : ''}

        <div class="article-story">
            ${article.story.split('\n\n').map(p => `<p>${p}</p>`).join('')}
        </div>

        ${article.localAngle ? `
            <div class="local-angle">
                <h3>🏘️ Limerick Connection</h3>
                <p>${article.localAngle}</p>
            </div>
        ` : ''}

        <div class="source-attribution">
            <h4>📰 Source Information</h4>
            <p><strong>Original Source:</strong> ${article.originalSource}</p>
            <p><strong>Original Title:</strong> ${article.originalTitle}</p>
            <p>
                <a href="${article.originalLink}" class="original-link" target="_blank" rel="noopener">
                    Read Original Article →
                </a>
            </p>
            <p style="margin-top: 15px; font-size: 0.85em; color: #666;">
                This story was rewritten by AI for The Limerick Weekly, focusing on local angles and context.
                The original reporting was done by ${article.originalSource}.
            </p>
        </div>

        <div class="footer">
            <p><strong>The Limerick Weekly</strong></p>
            <p>AI-powered local news with a Limerick focus</p>
        </div>
    </div>
</body>
</html>`;
}

/**
 * Generate article pages for all rewritten articles
 */
async function generateArticlePages() {
    console.log('📄 Generating Article Pages...\n');

    try {
        // Get all rewritten article keys from Redis
        const keys = await redis.keys('article:rewritten:*');

        if (keys.length === 0) {
            console.log('⚠️  No rewritten articles found. Run "npm run rewrite" first.');
            return;
        }

        console.log(`✓ Found ${keys.length} rewritten articles\n`);

        const outputDir = path.join(__dirname, '..', 'articles-html');
        await fs.mkdir(outputDir, { recursive: true });

        for (const key of keys) {
            const articleData = await redis.get(key);
            if (!articleData) continue;

            const article = JSON.parse(articleData);
            const articleId = key.replace('article:rewritten:', '');
            const safeId = articleId.replace(/[^a-z0-9]/gi, '-');

            const html = generateArticleHTML(article, articleId);
            const filename = `${safeId}.html`;
            const filepath = path.join(outputDir, filename);

            await fs.writeFile(filepath, html);
            console.log(`✓ Generated: ${filename}`);
        }

        console.log(`\n✅ Generated ${keys.length} article pages in articles-html/`);

    } catch (error) {
        console.error('❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    generateArticlePages()
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

module.exports = { generateArticlePages };
