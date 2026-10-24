require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const store = require('./lib/store');

const ROOT = path.join(__dirname, '..');
const PUBLIC_DIR = path.join(ROOT, 'public');
const SITE_DIR = process.env.SITE_DIR || path.join(ROOT, 'site');
const MAX_ARTICLES = 50;

function escapeHtml(value) {
    return String(value ?? '').replace(/[&<>"']/g, c => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
}

/** Only allow http(s) URLs into href/src attributes. */
function safeUrl(value) {
    try {
        const url = new URL(value);
        return url.protocol === 'http:' || url.protocol === 'https:' ? url.href : null;
    } catch {
        return null;
    }
}

/** Filesystem/URL safe name: readable prefix + hash, so long or similar IDs never collide or overflow. */
function slugFor(id) {
    const readable = id.replace(/^https?:\/\//i, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').slice(0, 80);
    const hash = crypto.createHash('sha1').update(id).digest('hex').slice(0, 8);
    return `${readable}-${hash}`;
}

/** Publishable articles: rewritten, with a Limerick angle, de-duplicated by link and headline. */
function collectArticles() {
    const seenLinks = new Set();
    const seenHeadlines = new Set();
    const articles = [];

    for (const [id, article] of store.listRewritten()) {
        if (article.skipped || !article.localAngle || !article.story || !article.headline) continue;

        const link = article.originalLink?.toLowerCase().trim();
        const headline = article.headline.toLowerCase().trim();
        if (seenLinks.has(link) || seenHeadlines.has(headline)) continue;
        seenLinks.add(link);
        seenHeadlines.add(headline);

        articles.push({ ...article, id, slug: slugFor(id) });
        if (articles.length >= MAX_ARTICLES) break;
    }

    return articles;
}

const ARTICLE_CSS = `
* { box-sizing: border-box; }
body { font-family: Georgia, serif; line-height: 1.8; max-width: 800px; margin: 0 auto; padding: 20px; background: #f9f9f9; color: #1a1a1a; }
.article-container { background: white; padding: 40px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); border-radius: 8px; }
.site-header { text-align: center; margin-bottom: 30px; padding-bottom: 20px; border-bottom: 3px double #c41e3a; }
.site-title { font-size: 2em; color: #c41e3a; margin: 0; font-weight: 700; }
.back-link { display: inline-block; margin-bottom: 20px; color: #666; text-decoration: none; font-size: 0.9em; }
.back-link:hover { color: #c41e3a; }
.article-headline { font-size: 2.5em; line-height: 1.2; margin: 20px 0; font-weight: 700; }
.article-subheadline { font-size: 1.3em; color: #666; margin: 15px 0; font-style: italic; }
.article-meta { color: #999; font-size: 0.9em; margin: 20px 0; padding: 15px 0; border-top: 1px solid #e0e0e0; border-bottom: 1px solid #e0e0e0; }
.article-image { width: 100%; height: auto; margin: 30px 0; border-radius: 4px; }
.pull-quote { background: #fffbea; border-left: 4px solid #f0c419; padding: 20px 30px; margin: 30px 0; font-size: 1.3em; font-style: italic; color: #333; }
.article-story { font-size: 1.1em; line-height: 1.9; }
.article-story p { margin: 20px 0; }
.local-angle { background: #e7f3ff; border-left: 4px solid #2196f3; padding: 20px; margin: 30px 0; border-radius: 4px; }
.local-angle h3 { margin-top: 0; color: #2196f3; }
.source-attribution { background: #f5f5f5; padding: 20px; margin: 40px 0; border-radius: 4px; font-size: 0.9em; }
.source-attribution h4 { margin-top: 0; color: #666; }
.original-link { display: inline-block; margin-top: 10px; color: #c41e3a; text-decoration: none; font-weight: 600; }
.original-link:hover { text-decoration: underline; }
.ai-badge { display: inline-block; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 5px 12px; border-radius: 4px; font-size: 0.8em; margin-bottom: 10px; }
.footer { text-align: center; margin-top: 50px; padding-top: 30px; border-top: 2px solid #e0e0e0; color: #999; font-size: 0.9em; }
@media (max-width: 600px) { .article-container { padding: 20px; } .article-headline { font-size: 1.8em; } }
`;

function articleHtml(article) {
    const published = new Date(article.publishedAt);
    const dateStr = Number.isNaN(published.getTime())
        ? ''
        : published.toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const image = safeUrl(article.imageUrl);
    const original = safeUrl(article.originalLink);
    const paragraphs = article.story.split('\n\n').filter(p => p.trim()).map(p => `<p>${escapeHtml(p)}</p>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(article.headline)} - The Limerick Weekly</title>
    <meta name="description" content="${escapeHtml(article.subheadline || article.headline)}">
    <style>${ARTICLE_CSS}</style>
</head>
<body>
    <div class="article-container">
        <div class="site-header">
            <h1 class="site-title">THE LIMERICK WEEKLY</h1>
        </div>

        <a href="../index.html" class="back-link">← Back to Home</a>

        <div class="ai-badge">✨ AI-Generated Article</div>

        <h1 class="article-headline">${escapeHtml(article.headline)}</h1>
        ${article.subheadline ? `<p class="article-subheadline">${escapeHtml(article.subheadline)}</p>` : ''}

        <div class="article-meta">Published: ${escapeHtml(dateStr)}</div>

        ${image ? `<img src="${escapeHtml(image)}" alt="${escapeHtml(article.headline)}" class="article-image" referrerpolicy="no-referrer">` : ''}
        ${article.pullQuote ? `<div class="pull-quote">${escapeHtml(article.pullQuote)}</div>` : ''}

        <div class="article-story">
${paragraphs}
        </div>

        <div class="local-angle">
            <h3>🏘️ Limerick Connection</h3>
            <p>${escapeHtml(article.localAngle)}</p>
        </div>

        <div class="source-attribution">
            <h4>📰 Source Information</h4>
            <p><strong>Original Source:</strong> ${escapeHtml(article.originalSource)}</p>
            <p><strong>Original Title:</strong> ${escapeHtml(article.originalTitle)}</p>
            ${original ? `<p><a href="${escapeHtml(original)}" class="original-link" target="_blank" rel="noopener noreferrer">Read Original Article →</a></p>` : ''}
            <p style="margin-top: 15px; font-size: 0.85em; color: #666;">
                This story was rewritten by AI for The Limerick Weekly, focusing on local angles and context.
                The original reporting was done by ${escapeHtml(article.originalSource)}.
            </p>
        </div>

        <div class="footer">
            <p><strong>The Limerick Weekly</strong></p>
            <p>AI-powered local news with a Limerick focus</p>
        </div>
    </div>
</body>
</html>
`;
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Not found - The Limerick Weekly</title></head>
<body style="font-family: Georgia, serif; max-width: 600px; margin: 80px auto; padding: 0 20px; text-align: center;">
<h1>Article not found</h1>
<p>This article may have expired or been removed.</p>
<p><a id="home" href="./">Back to The Limerick Weekly</a></p>
<script>
// Works for both a project site (/limerick-weekly/...) and a root site
var m = location.pathname.match(/^(.*\\/)articles\\//);
document.getElementById('home').href = m ? m[1] : './';
</script>
</body></html>
`;

function buildSite() {
    console.log('🏗️  Building static site...\n');

    fs.rmSync(SITE_DIR, { recursive: true, force: true });
    fs.mkdirSync(path.join(SITE_DIR, 'articles'), { recursive: true });
    fs.mkdirSync(path.join(SITE_DIR, 'data'), { recursive: true });

    fs.cpSync(PUBLIC_DIR, SITE_DIR, { recursive: true });

    const articles = collectArticles();

    for (const article of articles) {
        fs.writeFileSync(path.join(SITE_DIR, 'articles', `${article.slug}.html`), articleHtml(article));
    }

    // The index only needs list fields; the full text lives in the article pages.
    const listing = articles.map(({ slug, headline, subheadline, story, originalSource, publishedAt }) => {
        const first = story.split('\n\n')[0];
        return {
            slug, headline, subheadline, originalSource, publishedAt,
            summary: first.length > 200 ? first.substring(0, 200) + '...' : first
        };
    });
    fs.writeFileSync(
        path.join(SITE_DIR, 'data', 'articles.json'),
        JSON.stringify({ generatedAt: new Date().toISOString(), count: listing.length, articles: listing })
    );

    fs.writeFileSync(path.join(SITE_DIR, '404.html'), NOT_FOUND_HTML);
    fs.writeFileSync(path.join(SITE_DIR, '.nojekyll'), '');

    console.log(`✅ Built ${articles.length} article pages into ${SITE_DIR}`);
    return { count: articles.length };
}

if (require.main === module) {
    buildSite();
}

module.exports = { buildSite, escapeHtml, safeUrl, slugFor };
