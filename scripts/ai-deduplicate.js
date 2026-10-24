require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const store = require('./lib/store');

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Check if two articles are about the same story using AI
 */
async function areSimilarStories(article1, article2) {
    const model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash-lite' });

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
        console.log('\n📚 Loading articles from the store...');
        const articles = store.getRecentArticles(100);

        if (articles.length === 0) {
            console.log('\n⚠️  No articles available.');
            return null;
        }

        console.log(`✓ Found ${articles.length} articles`);

        // Articles that already have a rewrite were vetted on an earlier run, so they
        // form the baseline. Only new articles are compared against it.
        // Articles judged to have no Limerick connection are ignored entirely.
        const vetted = articles.filter(a => {
            const r = store.getRewritten(a.id);
            return r && !r.skipped;
        });
        const candidates = articles.filter(a => !store.getRewritten(a.id));

        const toKeep = [...vetted];
        const toRemove = [];

        console.log(`\n🔍 Checking ${candidates.length} new articles for semantic duplicates (${vetted.length} already vetted)...\n`);

        for (const article of candidates) {
            let isDuplicate = false;

            for (const keptArticle of toKeep) {
                console.log(`   Comparing: "${article.title.substring(0, 50)}..." vs "${keptArticle.title.substring(0, 50)}..."`);

                if (await areSimilarStories(article, keptArticle)) {
                    console.log(`   ✗ DUPLICATE DETECTED - Removing: "${article.title}"`);
                    isDuplicate = true;
                    toRemove.push(article);
                    break;
                }
                console.log(`   ✓ Different stories`);

                // Rate limiting - wait 500ms between AI calls
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            if (!isDuplicate) {
                toKeep.push(article);
            }
        }

        if (toRemove.length > 0) {
            console.log(`\n🗑️  Removing ${toRemove.length} duplicate articles...`);

            for (const article of toRemove) {
                store.removeArticle(article.id);
                console.log(`   ✓ Removed: ${article.title}`);
            }
            store.save();
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
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error:', error);
            process.exit(1);
        });
}

module.exports = { aiDeduplicate };
