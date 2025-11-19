require('dotenv').config();
const cron = require('node-cron');
const { dailyUpdate } = require('./scripts/daily-update');

// Schedule daily update at 6 AM Irish time
// Format: minute hour day month weekday
// '0 6 * * *' = Every day at 6:00 AM
const SCHEDULE = process.env.UPDATE_SCHEDULE || '0 6 * * *';

console.log('📅 The Limerick Weekly - Automated Scheduler');
console.log(`⏰ Scheduled to run: ${SCHEDULE}`);
console.log('🔄 Press Ctrl+C to stop\n');

// Schedule the task
cron.schedule(SCHEDULE, async () => {
    console.log('\n⏰ Scheduled update triggered!');
    try {
        await dailyUpdate();
    } catch (error) {
        console.error('❌ Scheduled update failed:', error);
    }
}, {
    timezone: "Europe/Dublin"
});

console.log('✅ Scheduler is running...');
console.log('💡 The server will update news automatically\n');

// Keep the process alive
process.on('SIGINT', () => {
    console.log('\n👋 Scheduler stopped');
    process.exit(0);
});
