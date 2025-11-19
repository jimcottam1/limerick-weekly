require('dotenv').config();
const { exec } = require('child_process');
const util = require('util');
const fs = require('fs').promises;
const path = require('path');
const execPromise = util.promisify(exec);

/**
 * Post-deployment script for Render
 * Ensures directories exist and generates initial content
 */

async function ensureDirectories() {
    const dirs = [
        path.join(__dirname, '..', 'articles'),
        path.join(__dirname, '..', 'articles-html'),
        path.join(__dirname, '..', 'output')
    ];

    for (const dir of dirs) {
        try {
            await fs.mkdir(dir, { recursive: true });
            console.log(`✓ Directory created/verified: ${dir}`);
        } catch (error) {
            console.error(`Error creating directory ${dir}:`, error.message);
        }
    }
}

async function runCommand(command, description) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔄 ${description}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        const { stdout, stderr } = await execPromise(command, { timeout: 300000 }); // 5 min timeout
        if (stdout) console.log(stdout);
        if (stderr) console.error(stderr);
        return true;
    } catch (error) {
        console.error(`❌ Error in ${description}:`, error.message);
        // Don't fail deployment if content generation fails
        return false;
    }
}

async function postDeploy() {
    console.log(`\n🚀 POST-DEPLOYMENT SETUP`);
    console.log(`📅 ${new Date().toLocaleString('en-IE')}`);
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);

    // Step 1: Ensure directories exist
    console.log('\n📁 Creating required directories...');
    await ensureDirectories();

    // Step 2: Try to generate initial content (non-blocking)
    console.log('\n📰 Attempting to generate initial content...');
    console.log('Note: This may take a few minutes. If it fails, the scheduler will regenerate content at 6 AM daily.');

    const success = await runCommand('npm run weekly', 'Full content generation (scrape + rewrite + generate)');

    if (success) {
        console.log('\n✅ Initial content generated successfully!');
    } else {
        console.log('\n⚠️  Initial content generation failed or timed out.');
        console.log('📅 The daily scheduler will generate content at 6 AM Irish time.');
        console.log('💡 You can also manually trigger: npm run weekly');
    }

    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ Post-deployment setup complete!`);
    console.log(`🌐 Server is ready to start`);
    console.log(`${'='.repeat(60)}\n`);
}

// Run if called directly
if (require.main === module) {
    postDeploy()
        .then(() => {
            console.log('Post-deploy script completed');
            process.exit(0);
        })
        .catch(error => {
            console.error('Post-deploy script failed:', error);
            // Exit with 0 so deployment doesn't fail
            process.exit(0);
        });
}

module.exports = { postDeploy };
