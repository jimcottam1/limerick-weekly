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

        articles.push({
            ...article,
            id,
            slug: slugFor(id),
            section: sectionFor(article),
            originalSource: SOURCE_NAMES[article.originalSource] || article.originalSource,
            sourceHome: SOURCE_HOMEPAGES[article.originalSource]
        });
        if (articles.length >= MAX_ARTICLES) break;
    }

    return articles;
}

const FONTS = `<link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Libre+Franklin:wght@400;700&family=Playfair+Display:ital,wght@0,700;0,900;1,400&family=Source+Serif+4:opsz,wght@8..60,400;8..60,600&display=swap">`;

/** Feed names come from the feed hostname; show them the way the papers write them. */
const SOURCE_NAMES = {
    limerickpost: 'Limerick Post',
    limerickleader: 'Limerick Leader',
    ilovelimerick: 'I Love Limerick',
    limerickvoice: 'Limerick Voice'
};

/** Publishers' homepages, for the sources list in the front page footer. */
const SOURCE_HOMEPAGES = {
    limerickpost: 'https://www.limerickpost.ie/',
    limerickleader: 'https://www.limerickleader.ie/',
    ilovelimerick: 'https://www.ilovelimerick.ie/',
    limerickvoice: 'https://limerickvoice.com/'
};

/** Rough newspaper section from keywords; the headline decides if it can, then the story. "News" otherwise. */
const SECTIONS = [
    ['Sport', /\b(munster|gaa|hurl\w*|camogie|rugby|soccer|football\w*|treaty united|match|fixture|league|championship|kick-?off|squad|cup)\b/i],
    ['Council', /\b(council\w*|councillors?|planning|housing|elected members|local authority)\b/i],
    ['Business', /\b(business\w*|property|house prices|jobs?|employ\w*|company|companies|investment|economy|retail\w*|chamber)\b/i],
    ['Arts & Culture', /\b(festival|film|cinema|exhibition|gallery|artists?|music|theatre|concert|curators?|book)\b/i],
    ['Courts', /\b(court|garda\w*|judge|charged|sentenced)\b/i]
];

function sectionFor(article) {
    for (const text of [`${article.headline} ${article.subheadline || ''}`, article.story]) {
        const match = SECTIONS.find(([, pattern]) => pattern.test(text));
        if (match) return match[0];
    }
    return 'News';
}

function paragraphsOf(story) {
    return story.split('\n\n').map(p => p.trim()).filter(Boolean);
}

/** "Photo: Adrian Butler / Limerick Leader", or just the source when the feed gives no usable credit. */
function photoCredit(article) {
    const credit = (article.imageCredit || '').trim();
    const useful = credit.length > 2 && credit.toLowerCase() !== article.originalSource.toLowerCase();
    return `Photo: ${useful ? `${credit} / ` : ''}${article.originalSource}`;
}

function articleHtml(article) {
    const published = new Date(article.publishedAt);
    const dateStr = Number.isNaN(published.getTime())
        ? ''
        : published.toLocaleDateString('en-IE', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const image = safeUrl(article.imageUrl);
    const original = safeUrl(article.originalLink);
    const paragraphs = paragraphsOf(article.story).map(p => `<p>${escapeHtml(p)}</p>`).join('\n');

    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${escapeHtml(article.headline)} - The 061</title>
    <meta name="description" content="${escapeHtml(article.subheadline || article.headline)}">
    ${FONTS}
    <link rel="stylesheet" href="../styles.css">
</head>
<body>
    <div class="paper">
        <header class="masthead-compact">
            <div class="masthead">
                <p class="masthead-title"><a href="../index.html"><span class="mast-the">The</span>061</a></p>
            </div>
            <div class="dateline">
                <a href="../index.html">&larr; Front page</a>
                <span class="motto">All the news of the Treaty City</span>
                <span>${escapeHtml(article.section)}</span>
            </div>
        </header>

        <main class="article">
            <span class="kicker">${escapeHtml(article.section)}</span>
            <h1 class="headline">${escapeHtml(article.headline)}</h1>
            ${article.subheadline ? `<p class="deck">${escapeHtml(article.subheadline)}</p>` : ''}
            <p class="byline">The 061 &middot; from reporting by ${escapeHtml(article.originalSource)}${dateStr ? ` &middot; ${escapeHtml(dateStr)}` : ''}</p>

            ${image ? `<figure class="photo photo-article">
                <img src="${escapeHtml(image)}" alt="" referrerpolicy="no-referrer" onerror="this.parentNode.remove()">
                <figcaption>${escapeHtml(photoCredit(article))}</figcaption>
            </figure>` : ''}
            ${article.pullQuote ? `<p class="pull-quote">${escapeHtml(article.pullQuote)}</p>` : ''}

            <div class="body-text drop-cap">
${paragraphs}
            </div>

            <section class="boxed">
                <h2>The Limerick connection</h2>
                <p>${escapeHtml(article.localAngle)}</p>
            </section>

            <section class="source-note">
                <p>This story was rewritten by AI for The 061 from original reporting by <strong>${escapeHtml(article.originalSource)}</strong>${article.originalTitle ? `, &ldquo;${escapeHtml(article.originalTitle)}&rdquo;` : ''}.</p>
                ${original ? `<p><a href="${escapeHtml(original)}" target="_blank" rel="noopener noreferrer">Read the original article &rarr;</a></p>` : ''}
            </section>
        </main>

        <footer class="colophon">
            <span class="masthead-small"><span class="mast-the">The</span>061</span>
            Stories are AI rewrites of local reporting &middot; each links to its original source
        </footer>
    </div>
</body>
</html>
`;
}

const NOT_FOUND_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Not found - The 061</title>
    ${FONTS}
    <link rel="stylesheet" id="styles" href="styles.css">
</head>
<body>
    <div class="paper">
        <header class="masthead-compact">
            <div class="masthead"><p class="masthead-title"><a class="home" href="./"><span class="mast-the">The</span>061</a></p></div>
            <div class="dateline"><span>Stop press</span><span class="motto">All the news of the Treaty City</span><span>Page not found</span></div>
        </header>
        <p class="notice">This story may have expired or been removed.<br><br><a class="home continued" href="./">Back to the front page &rarr;</a></p>
    </div>
<script>
// Works for both a project site (/the-061/...) and a root site
var m = location.pathname.match(/^(.*\\/)articles\\//) || location.pathname.match(/^(\\/[^/]+\\/)/);
var base = m ? m[1] : '/';
document.getElementById('styles').href = base + 'styles.css';
document.querySelectorAll('.home').forEach(function (a) { a.href = base; });
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

    // The front page only needs list fields, plus the opening paragraphs for whichever story leads.
    const listing = articles.map(article => {
        const { slug, section, headline, subheadline, story, pullQuote, originalSource, publishedAt } = article;
        const paragraphs = paragraphsOf(story);
        const first = paragraphs[0] || '';
        const imageUrl = safeUrl(article.imageUrl);
        return {
            slug, section, headline, subheadline, pullQuote, originalSource, publishedAt,
            originalLink: safeUrl(article.originalLink),
            sourceHome: safeUrl(article.sourceHome),
            ...(imageUrl && { imageUrl, photoCredit: photoCredit(article) }),
            summary: first.length > 200 ? first.substring(0, 200) + '...' : first,
            lead: paragraphs.slice(0, 6)
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
