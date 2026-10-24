require('dotenv').config();
const fetch = require('node-fetch');
const cheerio = require('cheerio');
const store = require('./lib/store');

const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

// Each source page is fetched once per article; cap it so a backlog doesn't make a run crawl
const MAX_PER_RUN = parseInt(process.env.MAX_IMAGE_FETCHES || '40');

/** Share cards with the publisher's logo and original headline printed on them, not photos. */
function isShareCard(url) {
    return /social-image/i.test(url);
}

function absolute(url, base) {
    try {
        const resolved = new URL(url.replace(/&amp;/g, '&'), base);
        return resolved.protocol === 'http:' || resolved.protocol === 'https:' ? resolved.href : null;
    } catch {
        return null;
    }
}

/** The JSON-LD thumbnail is the plain featured photo on WordPress sites like the Limerick Post. */
function jsonLdThumbnail($) {
    for (const el of $('script[type="application/ld+json"]').toArray()) {
        const match = $(el).html().match(/"thumbnailUrl"\s*:\s*"([^"]+)"/);
        if (match) return match[1].replace(/\\\//g, '/');
    }
    return null;
}

/** Find the article's lead photo: og:image unless it's a share card, then the JSON-LD thumbnail. */
async function findImage(pageUrl) {
    const response = await fetch(pageUrl, { headers: { 'User-Agent': USER_AGENT }, timeout: 15000 });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const $ = cheerio.load(await response.text());
    const candidates = [
        $('meta[property="og:image"]').attr('content'),
        $('meta[name="twitter:image"]').attr('content'),
        jsonLdThumbnail($)
    ];

    for (const candidate of candidates) {
        if (!candidate || isShareCard(candidate)) continue;
        const url = absolute(candidate, pageUrl);
        if (url) return url;
    }
    return null;
}

async function fetchImages() {
    console.log('🖼️  Fetching article images\n');
    console.log('='.repeat(50));

    // Published stories with no image that we haven't already looked for
    const pending = store.listRewritten()
        .filter(([, a]) => !a.skipped && a.originalLink && !a.imageUrl && !a.imageCheckedAt)
        .slice(0, MAX_PER_RUN);

    console.log(`\n${pending.length} articles to check\n`);

    let found = 0;
    for (const [id, article] of pending) {
        const checkedAt = new Date().toISOString();

        // The feed's own image (and credit) is better than anything scraped from the page
        const original = store.getArticle(id);
        if (original?.imageUrl) {
            store.setRewritten(id, { ...article, imageUrl: original.imageUrl, imageCredit: original.imageCredit, imageCheckedAt: checkedAt });
            found++;
            console.log(`   ✓ ${article.headline.substring(0, 60)} (from feed)`);
            continue;
        }

        try {
            const imageUrl = await findImage(article.originalLink);
            store.setRewritten(id, { ...article, imageUrl, imageCheckedAt: checkedAt });
            if (imageUrl) found++;
            console.log(`   ${imageUrl ? '✓' : '–'} ${article.headline.substring(0, 60)}`);
        } catch (error) {
            console.error(`   ✗ ${article.headline.substring(0, 60)}: ${error.message}`);
            // A blocked or missing page won't change tomorrow; anything else (timeouts, 5xx) is retried
            if (/HTTP (403|404|410)/.test(error.message)) {
                store.setRewritten(id, { ...article, imageCheckedAt: checkedAt });
            }
        }
    }

    store.save();

    console.log('\n' + '='.repeat(50));
    console.log(`📊 Images found: ${found} of ${pending.length}`);
    console.log('='.repeat(50));
    return { found, checked: pending.length };
}

if (require.main === module) {
    fetchImages()
        .then(() => process.exit(0))
        .catch((error) => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = { fetchImages, findImage };
