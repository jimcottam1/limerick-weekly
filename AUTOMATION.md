# The Limerick Weekly - Production Automation Guide

## Overview

This guide explains how to automate daily news updates while minimizing AI token costs.

## Token Usage Optimization

### How It Works

The system already has built-in optimizations:

1. **Pre-check Limerick Connection** - Uses AI to verify relevance BEFORE full rewrite
2. **Skip Already Rewritten** - Won't reprocess existing articles
3. **Daily Limit** - Controlled by `MAX_DAILY_REWRITES` (default: 20 articles/day)
4. **Rate Limiting** - 1 second delay between API calls
5. **Content Caching** - Stores in Redis for 30 days

### Estimated Token Usage

Per article rewrite:
- Connection check: ~500 tokens
- Full rewrite: ~2,000-3,000 tokens
- Total per article: ~3,000 tokens average

With `MAX_DAILY_REWRITES=20`:
- Daily usage: ~60,000 tokens
- Monthly usage: ~1.8 million tokens

Gemini 2.0 Flash pricing (as of Jan 2025):
- Input: $0.075 per 1M tokens
- Output: $0.30 per 1M tokens
- **Estimated monthly cost: $3-5**

## Production Deployment Options

### Option 1: Manual Updates (Recommended for Testing)

Run manually when you want to update:

```bash
# Update everything at once
npm run daily-update

# Or step-by-step
npm run scrape      # Get new articles
npm run rewrite     # AI rewrite (max 20/day)
npm run articles    # Generate HTML pages
npm run categories  # Update category pages
```

### Option 2: Automated Scheduler (Local/VPS)

For servers running 24/7:

```bash
# Start both web server AND automated scheduler
npm run prod
```

This runs:
- Web server on port 3000
- Scheduler that updates daily at 6 AM Irish time

**Customize schedule** in `.env`:
```env
# Examples:
UPDATE_SCHEDULE=0 6 * * *      # Daily at 6 AM
UPDATE_SCHEDULE=0 */12 * * *   # Every 12 hours
UPDATE_SCHEDULE=0 8 * * 1      # Mondays at 8 AM
```

### Option 3: Platform-Specific Automation

#### Heroku

Add to `Procfile`:
```
web: node server.js
worker: node scheduler.js
```

Enable worker dyno in Heroku dashboard.

#### Railway/Render

Add scheduled job in dashboard:
```bash
npm run daily-update
```

Set schedule: `0 6 * * *` (daily at 6 AM)

#### DigitalOcean/AWS/VPS

Use system cron:

```bash
# Edit crontab
crontab -e

# Add this line (runs daily at 6 AM)
0 6 * * * cd /path/to/limerick-weekly && npm run daily-update >> /var/log/limerick-weekly.log 2>&1
```

#### Windows Server

Use Task Scheduler:
1. Open Task Scheduler
2. Create Basic Task
3. Trigger: Daily at 6:00 AM
4. Action: Start a program
5. Program: `C:\Program Files\nodejs\node.exe`
6. Arguments: `C:\path\to\limerick-weekly\scripts\daily-update.js`

## Configuration Options

### .env Settings

```env
# Maximum articles to rewrite per day
# Lower = less cost, higher = more fresh content
MAX_DAILY_REWRITES=20

# Scheduler cron format: minute hour day month weekday
UPDATE_SCHEDULE=0 6 * * *
```

### Recommended Settings by Budget

**Tight budget** (1-2€/month):
```env
MAX_DAILY_REWRITES=10
UPDATE_SCHEDULE=0 6 * * 1,4  # Monday & Thursday only
```

**Moderate budget** (3-5€/month):
```env
MAX_DAILY_REWRITES=20
UPDATE_SCHEDULE=0 6 * * *  # Daily
```

**High freshness** (10-15€/month):
```env
MAX_DAILY_REWRITES=50
UPDATE_SCHEDULE=0 */8 * * *  # Every 8 hours
```

## Monitoring

### Check logs

```bash
# Manual update
npm run daily-update

# Watch output to see:
# - Articles scraped
# - Articles checked for Limerick connection
# - Articles rewritten
# - Token usage estimates
```

### Redis monitoring

```bash
# Check total articles in database
redis-cli -u $REDIS_URL
> ZCARD articles:by_date
> KEYS article:rewritten:*
```

## Troubleshooting

### High token usage?

1. Lower `MAX_DAILY_REWRITES` in `.env`
2. Check for duplicate processing (shouldn't happen, but verify)
3. Review logs for errors causing retries

### Not enough fresh content?

1. Increase `MAX_DAILY_REWRITES`
2. Add more RSS feeds in `RSS_FEEDS`
3. Run updates more frequently

### Scheduler not running?

```bash
# Test scheduler
npm run scheduler

# Should see: "✅ Scheduler is running..."
# Wait for next scheduled time or test with:
UPDATE_SCHEDULE="*/2 * * * *"  # Every 2 minutes for testing
```

## Production Checklist

- [ ] Set `NODE_ENV=production` in `.env`
- [ ] Configure `MAX_DAILY_REWRITES` based on budget
- [ ] Set appropriate `UPDATE_SCHEDULE`
- [ ] Ensure Redis URL is production Redis (not local)
- [ ] Test `npm run daily-update` manually first
- [ ] Set up monitoring/alerting
- [ ] Configure process manager (PM2, systemd, etc.)

## Best Practices

1. **Start conservative** - Begin with 10-15 articles/day
2. **Monitor costs** - Check Gemini API usage in Google Cloud Console
3. **Use Redis TTL** - Articles expire after 30 days automatically
4. **Regular backups** - JSON files saved to `/articles` folder
5. **Graceful failures** - System continues even if some articles fail

## Questions?

- Check logs: `npm run daily-update` shows detailed output
- Monitor Redis: See what's stored and when
- Test locally: Run scheduler with short intervals for testing
