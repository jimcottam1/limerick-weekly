# Deploying The Limerick Weekly to Render

## Prerequisites
- GitHub account
- Render account (sign up at https://render.com - free)
- Your GitHub repository: https://github.com/jimcottam1/limerick-weekly

## Step-by-Step Deployment Guide

### 1. Push Your Code to GitHub

Make sure all your latest changes are committed and pushed:

```bash
git add .
git commit -m "Add Render configuration"
git push origin master
```

### 2. Create Render Account

1. Go to https://render.com
2. Click "Get Started for Free"
3. Sign up with your GitHub account (recommended for easy integration)

### 3. Deploy from Dashboard

**Option A: Using render.yaml (Recommended)**

1. In Render dashboard, click **"New +"** → **"Blueprint"**
2. Connect your GitHub account if not already connected
3. Select the repository: `jimcottam1/limerick-weekly`
4. Render will automatically detect the `render.yaml` file
5. Click **"Apply"**

**Option B: Manual Setup**

If Blueprint doesn't work, create services manually:

1. Click **"New +"** → **"Web Service"**
2. Connect your GitHub repository
3. Configure:
   - **Name**: limerick-weekly
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Plan**: Free

### 4. Set Environment Variables (IMPORTANT!)

In your Render service settings, add these **secret** environment variables:

**Required Secrets** (click "Add Environment Variable"):
- `GEMINI_API_KEY` = `AIzaSyAhFGFCHpcX6f4sUunxXavIhUDP-ff1zdk`
- `REDIS_URL` = `redis://default:fTogsFImpS9dAuzkxnTuGUVybaXoimhJ@redis-15214.c1.eu-west-1-3.ec2.redns.redis-cloud.com:15214`
- `NEWSAPI_KEY` = `f8105cb0a7b54338b115432bfbe4ed33`
- `UPDATE_TOKEN` = (generate a random secret token - see below)

**Generate UPDATE_TOKEN:**
```bash
# Run this to generate a secure random token:
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Copy the output and use it as your UPDATE_TOKEN in both Render and GitHub (next step).

All other variables are already in the render.yaml file.

### 5. Set Up GitHub Actions for Daily Updates

GitHub Actions will automatically trigger daily updates at 6 AM (completely free!).

1. Go to your GitHub repository: https://github.com/jimcottam1/limerick-weekly
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add:
   - Name: `UPDATE_TOKEN`
   - Value: (paste the same token you used in Render)
4. Add another secret:
   - Name: `RENDER_URL`
   - Value: `https://your-app-name.onrender.com` (replace with your actual Render URL)

That's it! GitHub Actions is now configured to trigger updates daily.

### 6. Deploy!

1. Click **"Create Web Service"** (or "Deploy")
2. Render will:
   - Clone your GitHub repo
   - Install dependencies
   - Start your application
   - Provide you with a public URL (e.g., `https://limerick-weekly.onrender.com`)

### 7. Verify Deployment

Once deployed, test these URLs:
- `https://your-app.onrender.com/` - Main page
- `https://your-app.onrender.com/health` - Health check
- `https://your-app.onrender.com/api/stats` - API stats

## What Happens After Deployment

### Initial Deployment
When you first deploy, Render will:
1. Install all dependencies (`npm install`)
2. Run post-deployment script that:
   - Creates required directories (`articles/`, `articles-html/`, `output/`)
   - Attempts to generate initial content (scrape + AI rewrite + HTML generation)
   - This may take 5-10 minutes but won't block deployment
3. Start the web server
4. GitHub Actions will handle daily updates (no background worker needed!)

### Daily Automatic Updates
✅ **Web Server**: Runs continuously on Render, serves your website
✅ **Redis**: Connected to your existing Redis Cloud instance
✅ **GitHub Actions**: Runs **daily at 6 AM UTC** (free forever!) to:
   - Trigger the `/api/trigger-update` endpoint
   - Server then scrapes latest news from NewsAPI and RSS feeds
   - AI rewrites up to 20 articles with Limerick angle
   - Generates new HTML article pages
   - Updates category pages
✅ **Auto-Deploy**: Every git push triggers automatic redeployment
✅ **Free Tier**: Render free tier includes 750 hours/month (enough for 24/7 uptime)

### Content Generation Timeline
- **On Deploy**: Initial content generated (if successful)
- **Daily at 6 AM UTC**: Fresh content automatically generated via GitHub Actions
- **Manual**:
  - Via Render Shell: `npm run weekly`
  - Via GitHub Actions: Go to Actions tab → "Daily News Update" → "Run workflow"
  - Via API: `curl -X POST -H "Authorization: Bearer YOUR_TOKEN" https://your-app.onrender.com/api/trigger-update`

## Important Notes

### Free Tier Limitations
- Server spins down after 15 minutes of inactivity
- First request after idle may take 30-60 seconds to wake up
- 750 hours/month free (one service 24/7)

### Keeping It Awake (Optional)
If you want instant response times, upgrade to paid plan ($7/month) or use a service like UptimeRobot to ping your site every 5 minutes.

### Monitoring
- View logs in Render dashboard
- Check Redis usage in Redis Cloud dashboard
- Monitor Gemini API usage in Google Cloud Console
- NewsAPI usage: https://newsapi.org/account

## Troubleshooting

**Build fails?**
- Check that `package.json` is committed
- Verify build command includes post-deploy script
- Check build logs in Render dashboard

**Server won't start?**
- Check environment variables are set correctly
- View logs in Render dashboard
- Verify Redis URL is accessible

**No articles showing on first deployment?**
- This is normal! Initial content generation may take 5-10 minutes
- Check the build logs to see if content generation completed
- Wait for 6 AM Irish time for the scheduler to run
- OR manually run: `npm run weekly` from Render Shell

**Daily updates not running?**
- Check GitHub Actions tab in your repository
- Verify both secrets are set: `UPDATE_TOKEN` and `RENDER_URL`
- Check the workflow run logs for errors
- Manually test: Actions tab → "Daily News Update" → "Run workflow"
- Verify the API endpoint works: test with curl command above

## Manual Updates

To manually trigger a full update:
1. Go to Render dashboard
2. Select your web service
3. Click "Shell" tab
4. Run: `npm run weekly`

## Cost Estimates

- **Render Free Tier**: $0/month
- **Redis Cloud**: $0/month (free tier)
- **Gemini API**: ~$0.10-0.50/month (20 articles/day)
- **NewsAPI**: $0/month (free tier: 100 requests/day)

**Total: ~$0-1/month** for free tier operation!

## Support

- Render docs: https://render.com/docs
- GitHub repo: https://github.com/jimcottam1/limerick-weekly
- Issues: Open an issue on GitHub

---

Ready to deploy? Start with Step 1! 🚀
