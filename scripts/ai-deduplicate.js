require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Redis = require('ioredis');

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
                articles.push({ id, ...JSON.parse(data) });
            }
        }

        return articles;
    } catch (error) {
        console.error('Error fetching articles:', error.message);
        return [];
    }
}

/**
 * Check if two articles are about the same story using AI
 */
async function areSimilarStories(article1, article2) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `Are these two articles about the SAME story/event?

ARTICLE 1:
Title: ${article1.title}
Source: ${article1.source}
Description: ${article1.description.substring(0, 300)}

ARTICLE 2:
Title: ${article2.title}
Source: ${article2.source}
Description: ${article2.description.substring(0, 300)}

Consider them the SAME if they:
- Report the same specific event or incident
- Are about the same person doing the same thing
- Cover the same announcement or development

Consider them DIFFERENT if they:
- Are about different events (even in same category)
- Cover different aspects of a broader topic
- Are general news vs specific incidents

Respond with ONLY "SAME" or "DIFFERENT"`;

    try {
        const result = await model.generateContent(prompt);
        const response = result.response.text().trim().toUpperCase();
        return response.includes('SAME');
    } catch (error) {
        console.error(`   ✗ Error checking similarity: ${error.message}`);
        // Default to different to avoid false positives
        return false;
    }
}

/**
 * AI-powered deduplication of articles
 */
async function aiDeduplicate() {
    console.log('🤖 AI-Powered Deduplication\n');
    console.log('='.repeat(50));

    try {
        // Get all articles
        console.log('\n📚 Fetching articles from Redis...');
        const articles = await getRecentArticles(100);

        if (articles.length === 0) {
            console.log('\n⚠️  No articles available.');
            return null;
        }

        console.log(`✓ Found ${articles.length} articles`);

        const toKeep = [];
        const toRemove = [];
        const checked = new Set();

        console.log('\n🔍 Checking for semantic duplicates...\n');

        for (let i = 0; i < articles.length; i++) {
            const article1 = articles[i];

            // Skip if already marked for removal
            if (toRemove.some(a => a.id === article1.id)) {
                continue;
            }

            let isDuplicate = false;

            // Compare with articles we're keeping
            for (const keptArticle of toKeep) {
                const pairKey = [article1.id, keptArticle.id].sort().join('|');

                if (!checked.has(pairKey)) {
                    console.log(`   Comparing: "${article1.title.substring(0, 50)}..." vs "${keptArticle.title.substring(0, 50)}..."`);

                    const similar = await areSimilarStories(article1, keptArticle);
                    checked.add(pairKey);

                    if (similar) {
                        console.log(`   ✗ DUPLICATE DETECTED - Removing: "${article1.title}"`);
                        isDuplicate = true;
                        toRemove.push(article1);
                        break;
                    } else {
                        console.log(`   ✓ Different stories`);
                    }

                    // Rate limiting - wait 500ms between AI calls
                    await new Promise(resolve => setTimeout(resolve, 500));
                }
            }

            if (!isDuplicate) {
                toKeep.push(article1);
            }
        }

        // Remove duplicates from Redis
        if (toRemove.length > 0) {
            console.log(`\n🗑️  Removing ${toRemove.length} duplicate articles...`);

            for (const article of toRemove) {
                // Remove from Redis
                await redis.del(`article:${article.id}`);
                await redis.zrem('articles:by_date', article.id);

                // Also remove rewritten version if exists
                await redis.del(`article:rewritten:${article.id}`);

                console.log(`   ✓ Removed: ${article.title}`);
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Deduplication Summary:');
        console.log(`   Total articles checked: ${articles.length}`);
        console.log(`   Unique articles kept: ${toKeep.length}`);
        console.log(`   Duplicates removed: ${toRemove.length}`);
        console.log('='.repeat(50));

        return { kept: toKeep.length, removed: toRemove.length };
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    aiDeduplicate()
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

module.exports = { aiDeduplicate };
