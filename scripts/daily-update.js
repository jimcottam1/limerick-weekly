require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const execPromise = util.promisify(exec);

const MAX_ARTICLES_PER_DAY = parseInt(process.env.MAX_DAILY_REWRITES) || 20;

async function runCommand(command, description) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 ${description}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        const { stdout, stderr } = await execPromise(command);
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        return true;
    } catch (error) {
        console.error(`❌ Error in ${description}:`, error.message);
        return false;
    }
}

async function dailyUpdate() {
    console.log(`\n🗞️  THE LIMERICK WEEKLY - DAILY UPDATE`);
    console.log(`📅 ${new Date().toLocaleString('en-IE')}`);
    console.log(`🎯 Max articles to rewrite: ${MAX_ARTICLES_PER_DAY}`);

    // Step 1: Scrape new articles
    await runCommand('npm run scrape', 'Scraping new articles');

    // Step 2: AI deduplication (remove similar stories)
    await runCommand('npm run dedupe', 'AI-powered deduplication');

    // Step 3: AI rewrite (with limit to control token usage)
    await runCommand(
        `node scripts/rewrite-articles.js ${MAX_ARTICLES_PER_DAY}`,
        `AI rewriting (max ${MAX_ARTICLES_PER_DAY} articles)`
    );

    // Note: Articles are now served dynamically from Redis, no static HTML generation needed

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Daily update complete!`);
    console.log(`🌐 Your news is now up to date`);
    console.log(`${'='.repeat(60)}\n`);
}

// Run immediately if called directly
if (require.main === module) {
    dailyUpdate()
        .then(() => process.exit(0))
        .catch(error => {
            console.error('Fatal error:', error);
            process.exit(1);
        });
}

module.exports = { dailyUpdate };
