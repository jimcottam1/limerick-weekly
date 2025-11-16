# The Limerick Weekly - AI-Generated News Digest

## Overview

The Limerick Weekly is an **AI-powered weekly news digest** that automatically:
1. Scrapes news from multiple sources (NewsAPI + RSS feeds)
2. Analyzes articles using Google Gemini AI
3. Generates a beautiful, professional HTML newsletter
4. Delivers top local stories, trends, and insights

---

## How It Works

### 1. **News Collection** (Scraping)
```bash
npm run scrape
```

**What it does:**
- Fetches Limerick-related news from NewsAPI
- Searches for keywords: Limerick, Munster, Shannon, Treaty City
- Falls back to local RSS feeds (Limerick Post, Leader, Live95)
- Deduplicates articles
- Stores in Redis Cloud (72 articles from last run)

**Sources:**
- NewsAPI (100+ news outlets)
- Irish Times
- RTÉ News
- TheJournal.ie
- BBC News
- Independent.ie
- And 30+ more

---

### 2. **AI Analysis** (Generation)
```bash
npm run generate
```

**What it does:**
- Pulls most recent 50 articles from Redis
- Sends to Google Gemini 2.0 Flash Lite AI
- AI editor analyzes and creates:
  - **Top 10 Stories** - Most newsworthy for Limerick residents
  - **Weekly Overview** - 3-4 paragraph narrative of the week
  - **Trends & Insights** - Emerging patterns and themes
  - **Quote of the Week** - Most impactful quote from articles
  - **Looking Ahead** - What's coming next week
  - **Categories** - Local, Business, Sports, Events, Politics

**AI Instructions:**
- Write like a professional local journalist
- Focus on stories that matter to Limerick
- Be engaging but objective
- Highlight community impact
- Connect stories to broader trends

---

### 3. **Output** (HTML Digest)

**Generated file:** `output/limerick-weekly-2025-11-16.html`

**Features:**
- 📰 Modern, responsive newspaper design
- 🎨 Beautiful gradient sections
- 📱 Mobile-friendly
- 🔗 Links to original sources
- 💬 Quote of the week highlight
- 📊 Visual trend indicators
- 🔮 Forward-looking section

**Styling:**
- Clean, professional layout
- Easy to read typography
- Color-coded sections
- Hover effects on links
- Print-friendly

---

## Quick Start

### Generate This Week's Digest

**One command to do it all:**
```bash
npm run weekly
```

This runs:
1. Scraping (gets fresh articles)
2. Generation (AI creates digest)

**Result:** Beautiful HTML digest in `output/` folder

---

## Manual Workflow

### Step 1: Scrape News
```bash
npm run scrape
```

**Output:**
```
📡 Fetching from NewsAPI...
✓ Found 72 unique articles
✓ Saved 72 new articles to Redis
```

### Step 2: Generate Digest
```bash
npm run generate
```

**Output:**
```
🤖 Analyzing 50 articles with AI...
✓ AI analysis complete
✓ Digest saved to: output/limerick-weekly-2025-11-16.html
Top stories: 10
Trends identified: 3
```

### Step 3: View/Share
Open the HTML file in your browser:
```bash
start output/limerick-weekly-2025-11-16.html
```

---

## Automation Options

### Option 1: Windows Task Scheduler (Local)

**Create a batch file:** `generate-weekly.bat`
```batch
cd C:\Users\jim_c\lorraine\limerick-weekly
npm run weekly
```

**Schedule in Task Scheduler:**
- Trigger: Weekly, every Friday at 5:00 PM
- Action: Run `generate-weekly.bat`
- Result: Fresh digest every Friday evening

---

### Option 2: GitHub Actions (Cloud - Free)

Create `.github/workflows/weekly-digest.yml`:

```yaml
name: Generate Weekly Digest

on:
  schedule:
    - cron: '0 17 * * 5'  # Every Friday at 5 PM UTC
  workflow_dispatch:      # Manual trigger option

jobs:
  generate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'

      - name: Install dependencies
        run: npm install

      - name: Generate weekly digest
        env:
          GEMINI_API_KEY: ${{ secrets.GEMINI_API_KEY }}
          REDIS_URL: ${{ secrets.REDIS_URL }}
          NEWSAPI_KEY: ${{ secrets.NEWSAPI_KEY }}
        run: npm run weekly

      - name: Upload digest
        uses: actions/upload-artifact@v3
        with:
          name: weekly-digest
          path: output/limerick-weekly-*.html
```

**Benefits:**
- Fully automated
- Runs in the cloud (no local machine needed)
- Free for public repos
- Can email results

---

### Option 3: Vercel Cron Jobs (Deployed)

When deployed to Vercel, add to `vercel.json`:

```json
{
  "crons": [{
    "path": "/api/cron/generate-weekly",
    "schedule": "0 17 * * 5"
  }]
}
```

Create `api/cron/generate-weekly.js`:
```javascript
const { exec } = require('child_process');

module.exports = async (req, res) => {
  // Run weekly generation
  exec('npm run weekly', (error, stdout) => {
    if (error) {
      return res.status(500).json({ error: error.message });
    }
    res.json({ success: true, output: stdout });
  });
};
```

---

## Customization

### Change Keywords
Edit `.env`:
```bash
LIMERICK_KEYWORDS=Limerick,Munster,Shannon,Treaty City,UL,LIT
```

### Adjust Number of Articles
Edit `.env`:
```bash
ARTICLES_TO_ANALYZE=100  # Analyze more articles
TOP_STORIES_COUNT=15     # Show 15 top stories instead of 10
```

### Modify AI Tone
Edit `scripts/generate-weekly.js`:
- Line 65-78: Editorial guidelines
- Line 106-145: Detailed instructions

### Change Design
Edit `scripts/generate-weekly.js`:
- Line 200-414: All CSS styling
- Colors, fonts, layout, spacing

---

## Current Setup

✅ **Working:**
- NewsAPI integration (72 articles fetched)
- Gemini AI analysis (10 stories generated)
- Beautiful HTML output
- Redis Cloud caching
- API server running

⚠️ **Not Yet:**
- Automated scheduling (manual for now)
- Email delivery
- Web hosting
- Archive page

---

## What Makes It Great

### 1. **Smart AI Curation**
- Not just aggregation - actual journalism
- Identifies what matters to Limerick
- Connects stories into narratives
- Finds patterns and trends

### 2. **Professional Quality**
- Clean, modern design
- Easy to read
- Mobile responsive
- Print-friendly

### 3. **Comprehensive Coverage**
- 100+ news sources via NewsAPI
- Local AND national perspectives
- Sports, business, politics, events
- Quote of the week

### 4. **Fully Automated**
- One command generates everything
- Can run on schedule
- No manual editing needed

---

## Example Output

**This Week's Digest Includes:**

📰 **Top Stories:**
1. Labour Party Conference in Limerick
2. Local TD highlights drugs crisis
3. Storm Claudia impacts
4. Munster sports results
5. Housing policy discussions
... (10 total)

📊 **Weekly Trends:**
- Political focus on Limerick
- Community concerns about housing
- Weather and public safety

💬 **Quote of the Week:**
Impactful quote from local figure

🔮 **Looking Ahead:**
What to watch next week

---

## Next Steps

### Immediate:
1. ✅ Test weekly generation: `npm run weekly`
2. ✅ Review output in browser
3. ⬜ Set up automation (GitHub Actions or Task Scheduler)

### Future Enhancements:
- Email newsletter delivery
- Web archive of past issues
- Social media sharing
- Subscriber management
- Analytics tracking
- PDF export option

---

## Questions?

**Regenerate with fresh data:**
```bash
npm run weekly
```

**Just update without new scraping:**
```bash
npm run generate
```

**Check what's in Redis:**
```bash
npm run dev
# Visit: http://localhost:3000/api/stats
```

---

**You now have a fully functional AI-powered weekly news digest for Limerick!** 🎉

Every week, with one command, you can generate a professional, beautiful newsletter that keeps Limerick residents informed about what matters most in their community.
