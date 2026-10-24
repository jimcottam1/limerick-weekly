require('dotenv').config();
const store = require('./lib/store');
const { generate } = require('./lib/gemini');

/**
 * Ask the AI whether an article reports the same story as any already-kept article.
 * One call per new article, rather than one per pair. Returns the matching kept article, or null.
 */
async function findDuplicate(article, keptArticles) {
    if (keptArticles.length === 0) return null;

    const list = keptArticles
        .map((kept, i) => `${i + 1}. ${kept.title} - ${kept.description.substring(0, 150)}`)
        .join('\n');

    const prompt = `Is the NEW ARTICLE about the SAME story/event as any article in the LIST?

NEW ARTICLE:
Title: ${article.title}
Source: ${article.source}
Description: ${article.description.substring(0, 300)}

LIST:
${list}

Consider them the SAME if they:
- Report the same specific event or incident
- Are about the same person doing the same thing
- Cover the same announcement or development

Consider them DIFFERENT if they:
- Are about different events (even in same category)
- Cover different aspects of a broader topic
- Are general news vs specific incidents

Respond with ONLY the number of the matching article in the LIST, or "NONE"`;

    try {
        const response = (await generate(prompt)).trim().toUpperCase();
        const match = response.match(/\d+/);
        if (response.includes('NONE') || !match) return null;
        return keptArticles[parseInt(match[0]) - 1] || null;
    } catch (error) {
        console.error(`   ✗ Error checking for duplicates: ${error.message}`);
        // Default to keeping the article; build-site still drops exact link/headline repeats
        return null;
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
            console.log(`   Checking: "${article.title.substring(0, 60)}..." against ${toKeep.length} kept`);

            const duplicateOf = await findDuplicate(article, toKeep);
            if (duplicateOf) {
                console.log(`   ✗ DUPLICATE of "${duplicateOf.title.substring(0, 60)}..." - Removing`);
                toRemove.push(article);
            } else {
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
