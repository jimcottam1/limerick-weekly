# The Limerick Weekly

AI-Curated Local News Digest for Limerick

## About

The Limerick Weekly is an AI-powered news aggregator that collects articles from multiple Limerick news sources and generates a comprehensive weekly digest. Using Google's Gemini AI, it analyzes news coverage, identifies trending topics, and creates an engaging newspaper-style summary.

## Features

- 📰 **Multi-Source Aggregation** - Pulls from Limerick Post, Limerick Leader, Live 95, and more
- 🤖 **AI-Powered Summaries** - Gemini AI analyzes and summarizes stories
- 🔥 **Trend Detection** - Identifies most discussed topics
- 📊 **Story Clustering** - Combines coverage of same story from multiple sources
- 📅 **Weekly Editions** - Professional newspaper-style digest every week
- 📧 **Email Newsletter** - Subscribe for weekly updates

## Tech Stack

- **Backend**: Node.js, Express
- **AI**: Google Gemini 2.5 Flash Lite
- **Database**: Redis (caching)
- **Hosting**: Vercel
- **Automation**: GitHub Actions

## Project Structure

```
limerick-weekly/
├── api/
│   ├── articles.js          # Get all articles
│   ├── weekly.js            # Generate weekly digest
│   └── issue/[number].js    # Get specific issue
├── scripts/
│   ├── scrape-news.js       # Scrape RSS feeds
│   └── generate-weekly.js   # Generate weekly edition
├── public/
│   ├── index.html           # Main page
│   ├── styles.css           # Styling
│   └── app.js               # Frontend logic
├── server.js                # Express server
└── package.json
```

## Setup

1. Clone the repository
```bash
git clone https://github.com/yourusername/limerick-weekly.git
cd limerick-weekly
```

2. Install dependencies
```bash
npm install
```

3. Create `.env` file
```
GEMINI_API_KEY=your_api_key_here
REDIS_URL=your_redis_url_here
```

4. Run locally
```bash
npm run dev
```

## Scripts

- `npm start` - Start production server
- `npm run dev` - Start development server with nodemon
- `npm run scrape` - Scrape news sources
- `npm run generate` - Generate weekly digest

## Data Sources

- Limerick Post
- Limerick Leader
- Live 95 FM
- Google News (Limerick)
- Munster Rugby
- GAA News
- More sources coming soon...

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.
