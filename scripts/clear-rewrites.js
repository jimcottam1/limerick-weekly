require('dotenv').config();
const store = require('./lib/store');

/**
 * Clear all rewritten articles so the next run regenerates them.
 * Scraped source articles are kept.
 */
function clearRewrites() {
    console.log('🗑️  Clearing Rewritten Articles\n');
    const cleared = store.clearRewrites();
    store.save();
    console.log(`✓ Cleared ${cleared} rewritten articles`);
    console.log('\n💡 The next daily run (or "npm run rewrite") will regenerate them.');
    return { cleared };
}

if (require.main === module) {
    clearRewrites();
}

module.exports = { clearRewrites };
