require('dotenv').config();
const store = require('./lib/store');
const xml2js = require('xml2js');
const NewsAPI = require('newsapi');
const fetch = require('node-fetch');

// Initialize NewsAPI (recommended)
let newsapi = null;
if (process.env.NEWSAPI_KEY) {
    newsapi = new NewsAPI(process.env.NEWSAPI_KEY);
    console.log('✓ NewsAPI initialized');
} else {
    console.log('ℹ NewsAPI key not provided - using RSS feeds only');
}

// RSS Feed sources (fallback)
const RSS_FEEDS = (process.env.RSS_FEEDS || '').split(',').filter(Boolean);

// Limerick search keywords
const LIMERICK_KEYWORDS = (process.env.LIMERICK_KEYWORDS || 'Limerick').split(',').map(k => k.trim());

/**
 * Fetch articles from NewsAPI for Limerick
 */
async function fetchFromNewsAPI() {
    if (!newsapi) return [];

    const articles = [];

    try {
        console.log(`📰 Fetching from NewsAPI for Limerick keywords...`);

        // Search for Limerick-related news
        for (const keyword of LIMERICK_KEYWORDS) {
            try {
                const response = await newsapi.v2.everything({
                    q: keyword,
                    language: 'en',
                    sortBy: 'publishedAt',
                    pageSize: 20,
                    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString() // Last 7 days
                });

                if (response.articles && response.articles.length > 0) {
                    console.log(`   ✓ Found ${response.articles.length} articles for "${keyword}"`);

                    for (const article of response.articles) {
                        // Convert NewsAPI format to our format
                        articles.push({
                            id: article.url || `newsapi-${Date.now()}-${Math.random()}`,
                            title: article.title || 'Untitled',
                            link: article.url || '',
                            description: article.description || article.content || '',
                            pubDate: article.publishedAt || new Date().toISOString(),
                            author: article.author || article.source?.name || 'Unknown',
                            source: article.source?.name || 'NewsAPI',
                            scrapedAt: new Date().toISOString(),
                            imageUrl: article.urlToImage || null
                        });
                    }
                }
            } catch (error) {
                console.error(`   ⚠️  Error fetching for "${keyword}":`, error.message);
            }
        }

        return articles;
    } catch (error) {
        console.error('❌ Error with NewsAPI:', error.message);
        return [];
    }
}

/**
 * Fetch and parse RSS feed
 */
async function fetchRSSFeed(url) {
    try {
        // Some feeds (e.g. I Love Limerick) return 403 to the default node-fetch user agent
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'application/rss+xml, application/xml;q=0.9, */*;q=0.8'
            },
            timeout: 15000
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const xmlData = await response.text();
        const parser = new xml2js.Parser();
        const result = await parser.parseStringPromise(xmlData);

        return result;
    } catch (error) {
        console.error(`❌ Error fetching ${url}:`, error.message);
        return null;
    }
}

/**
 * Extract articles from parsed RSS feed
 */
function extractArticles(feedData, sourceName) {
    if (!feedData) return [];

    const articles = [];
    const items = feedData.rss?.channel?.[0]?.item || feedData.feed?.entry || [];

    for (const item of items) {
        try {
            // Handle both RSS and Atom formats
            const article = {
                id: item.guid?.[0]?._ || item.guid?.[0] || item.id?.[0] || item.link?.[0],
                title: item.title?.[0]?._ || item.title?.[0] || 'Untitled',
                link: item.link?.[0]?._ || item.link?.[0]?.$?.href || item.link?.[0] || '',
                description: item.description?.[0] || item.summary?.[0] || item.content?.[0] || '',
                pubDate: item.pubDate?.[0] || item.published?.[0] || new Date().toISOString(),
                author: item.author?.[0]?.name?.[0] || item['dc:creator']?.[0] || 'Unknown',
                source: sourceName,
                scrapedAt: new Date().toISOString()
            };

            // Clean HTML from description
            article.description = article.description.replace(/<[^>]*>/g, '').trim();

            // Skip articles that are too short
            const minLength = parseInt(process.env.MIN_ARTICLE_LENGTH || '100');
            if (article.description.length < minLength) {
                continue;
            }

            articles.push(article);
        } catch (error) {
            console.error('Error parsing article:', error.message);
        }
    }

    return articles;
}

/**
 * Save new articles to the store
 */
function saveArticles(articles) {
    const saved = [];
    const skipped = [];

    for (const article of articles) {
        if (store.hasArticle(article.id)) {
            skipped.push(article);
        } else {
            store.addArticle(article);
            saved.push(article);
        }
    }

    return { saved, skipped };
}

/**
 * Get source name from URL
 */
function getSourceName(url) {
    try {
        const domain = new URL(url).hostname;
        return domain.replace('www.', '').split('.')[0];
    } catch {
        return 'unknown';
    }
}

/**
 * Main scraping function
 */
async function scrapeNews() {
    console.log('🗞️  Starting news scraping...\n');

    let totalArticles = 0;
    let totalSaved = 0;
    let totalSkipped = 0;
    let allArticles = [];

    // Step 1: Fetch from NewsAPI (preferred method)
    if (newsapi) {
        console.log('📡 Fetching from NewsAPI...');
        const newsApiArticles = await fetchFromNewsAPI();
        if (newsApiArticles.length > 0) {
            allArticles.push(...newsApiArticles);
            console.log(`   ✓ Total from NewsAPI: ${newsApiArticles.length} articles\n`);
        }
    }

    // Step 2: Fetch from RSS feeds (fallback/supplement)
    if (RSS_FEEDS.length > 0) {
        console.log(`📡 Fetching from ${RSS_FEEDS.length} RSS feeds...`);

        for (const feedUrl of RSS_FEEDS) {
            const sourceName = getSourceName(feedUrl);
            console.log(`\n📰 Fetching from ${sourceName}...`);

            const feedData = await fetchRSSFeed(feedUrl);
            if (!feedData) {
                console.log(`   ⚠️  Failed to fetch feed`);
                continue;
            }

            const articles = extractArticles(feedData, sourceName);
            console.log(`   ✓ Found ${articles.length} articles`);

            if (articles.length > 0) {
                allArticles.push(...articles);
            }
        }
    }

    // Step 3: Remove duplicates (by URL/ID and title similarity)
    const uniqueArticles = [];
    const seenIds = new Set();
    const seenUrls = new Set();
    const seenTitles = new Set();

    for (const article of allArticles) {
        const normalizedId = article.id?.toLowerCase().trim();
        const normalizedUrl = article.link?.toLowerCase().trim();
        const normalizedTitle = article.title?.toLowerCase().trim();

        // Skip if we've seen this ID, URL, or exact title
        if (seenIds.has(normalizedId)) {
            continue;
        }
        if (seenUrls.has(normalizedUrl)) {
            continue;
        }
        if (seenTitles.has(normalizedTitle)) {
            console.log(`   Skipping duplicate title: "${article.title}"`);
            continue;
        }

        seenIds.add(normalizedId);
        seenUrls.add(normalizedUrl);
        seenTitles.add(normalizedTitle);
        uniqueArticles.push(article);
    }

    console.log(`\n📊 Deduplication: ${allArticles.length} → ${uniqueArticles.length} unique articles`);

    // Step 4: Save to the store
    if (uniqueArticles.length > 0) {
        const { saved, skipped } = saveArticles(uniqueArticles);
        console.log(`   ✓ Saved ${saved.length} new articles`);
        console.log(`   ⊘ Skipped ${skipped.length} existing articles`);

        totalArticles = uniqueArticles.length;
        totalSaved = saved.length;
        totalSkipped = skipped.length;
    }

    // Store scraping metadata
    store.setMeta('lastScrape', new Date().toISOString());
    store.setMeta('totalArticles', totalArticles);
    store.save();

    console.log('\n' + '='.repeat(50));
    console.log('📊 Scraping Summary:');
    console.log(`   Total articles found: ${totalArticles}`);
    console.log(`   New articles saved: ${totalSaved}`);
    console.log(`   Existing articles: ${totalSkipped}`);
    console.log('='.repeat(50));

    return { totalArticles, totalSaved, totalSkipped };
}

// Run if called directly
if (require.main === module) {
    scrapeNews()
        .then(() => {
            console.log('\n✅ Scraping complete!');
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Scraping failed:', error);
            process.exit(1);
        });
}

module.exports = { scrapeNews };
