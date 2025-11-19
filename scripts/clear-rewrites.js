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
 * Clear all rewritten articles from Redis and optionally from disk
 */
async function clearRewrites(clearFiles = false) {
    console.log('🗑️  Clearing Rewritten Articles\n');
    console.log('='.repeat(50));

    try {
        // Step 1: Clear from Redis
        console.log('\n📦 Clearing from Redis...');

        // Find all rewritten article keys
        const keys = await redis.keys('article:rewritten:*');

        if (keys.length === 0) {
            console.log('   ℹ️  No rewritten articles found in Redis');
        } else {
            console.log(`   Found ${keys.length} rewritten articles`);

            // Delete all keys
            if (keys.length > 0) {
                await redis.del(...keys);
                console.log(`   ✓ Deleted ${keys.length} articles from Redis`);
            }
        }

        // Step 2: Clear from disk (optional)
        if (clearFiles) {
            console.log('\n📁 Clearing from disk...');
            const articlesDir = path.join(__dirname, '..', 'articles');

            try {
                const files = await fs.readdir(articlesDir);
                const jsonFiles = files.filter(f => f.endsWith('.json'));

                if (jsonFiles.length === 0) {
                    console.log('   ℹ️  No article files found on disk');
                } else {
                    console.log(`   Found ${jsonFiles.length} article files`);

                    let deleted = 0;
                    for (const file of jsonFiles) {
                        await fs.unlink(path.join(articlesDir, file));
                        deleted++;
                    }

                    console.log(`   ✓ Deleted ${deleted} files from disk`);
                }
            } catch (error) {
                if (error.code === 'ENOENT') {
                    console.log('   ℹ️  Articles directory does not exist');
                } else {
                    throw error;
                }
            }
        }

        console.log('\n' + '='.repeat(50));
        console.log('✅ Clearing Complete!');
        console.log('\n💡 Next Steps:');
        console.log('   1. Run "npm run rewrite" to regenerate articles');
        console.log('   2. Or wait for the daily update to regenerate automatically');
        console.log('='.repeat(50) + '\n');

        return { cleared: keys.length };
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    // Check for --files flag
    const clearFiles = process.argv.includes('--files');

    if (clearFiles) {
        console.log('⚠️  Will also clear files from disk (--files flag detected)\n');
    }

    clearRewrites(clearFiles)
        .then(({ cleared }) => {
            console.log(`\n✨ Cleared ${cleared} rewritten articles`);
            redis.disconnect();
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error:', error);
            redis.disconnect();
            process.exit(1);
        });
}

module.exports = { clearRewrites };
