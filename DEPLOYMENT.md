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

All other variables are already in the render.yaml file.

### 5. Add Background Worker (For Daily Updates)

1. Click **"New +"** → **"Background Worker"**
2. Select same repository
3. Configure:
   - **Name**: limerick-weekly-scheduler
   - **Environment**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm run scheduler`
4. Add the same environment variables as above

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

✅ **Web Server**: Runs continuously, serves your website
✅ **Redis**: Connected to your existing Redis Cloud instance
✅ **Scheduler**: Runs daily at 6 AM Irish time to update news
✅ **Auto-Deploy**: Every git push triggers automatic redeployment
✅ **Free Tier**: Includes 750 hours/month (enough for 24/7 uptime)

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
- Verify build command: `npm install`

**Server won't start?**
- Check environment variables are set correctly
- View logs in Render dashboard
- Verify Redis URL is accessible

**Scheduler not running?**
- Make sure the background worker is deployed
- Check worker logs for errors

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
