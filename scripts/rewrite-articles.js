require('dotenv').config();
const { GoogleGenerativeAI } = require('@google/generative-ai');
const Redis = require('ioredis');
const fetch = require('node-fetch');
const cheerio = require('cheerio');
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

// Initialize Gemini AI
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

/**
 * Fetch full article content from URL using Cheerio for better extraction
 */
async function fetchFullArticle(url) {
    try {
        console.log(`   📄 Fetching full content from URL...`);

        const response = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            },
            timeout: 10000 // 10 second timeout
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const html = await response.text();
        const $ = cheerio.load(html);

        // Remove unwanted elements
        $('script, style, nav, header, footer, aside, .ads, .advertisement, .social-share').remove();

        // Try common article selectors
        let content = '';
        const selectors = [
            'article',
            '[role="main"]',
            '.article-content',
            '.post-content',
            '.entry-content',
            'main'
        ];

        for (const selector of selectors) {
            const element = $(selector);
            if (element.length > 0) {
                content = element.text();
                break;
            }
        }

        // Fallback: get all paragraphs
        if (!content || content.length < 200) {
            content = $('p').map((i, el) => $(el).text().trim()).get()
                .filter(p => p.length > 50)
                .join('\n\n');
        }

        // Clean up whitespace
        content = content
            .replace(/\s+/g, ' ')
            .replace(/\n\s*\n/g, '\n\n')
            .trim();

        if (content.length < 100) {
            console.log(`   ⚠️  Content too short (${content.length} chars), using description only`);
            return null;
        }

        console.log(`   ✓ Extracted ${content.length} characters`);
        return content.substring(0, 4000); // Limit to 4,000 chars for AI
    } catch (error) {
        console.error(`   ✗ Error fetching article: ${error.message}`);
        return null;
    }
}

/**
 * Check if article has Limerick connection using AI
 */
async function hasLimerickConnection(article, fullContent) {
    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const checkPrompt = `Does this article have ANY connection to Limerick, Ireland?

Consider connections to:
- Limerick city or county
- Shannon (town or airport nearby)
- Munster (province that includes Limerick)
- Irish national news that affects Limerick
- People from Limerick
- Sports teams from Limerick (e.g., Munster Rugby, Limerick GAA)
- Businesses or events in Limerick

Article: ${article.title}
Source: ${article.source}
Description: ${article.description.substring(0, 500)}
${fullContent ? 'Content: ' + fullContent.substring(0, 1000) : ''}

Respond with ONLY "YES" or "NO"`;

    try {
        const result = await model.generateContent(checkPrompt);
        const response = result.response.text().trim().toUpperCase();
        return response.includes('YES');
    } catch (error) {
        console.error(`   ✗ Error checking Limerick connection: ${error.message}`);
        // Default to YES to avoid missing potentially relevant articles
        return true;
    }
}

/**
 * Rewrite article using AI
 */
async function rewriteArticle(originalArticle, fullContent) {
    console.log(`\n✍️  Rewriting: ${originalArticle.title.substring(0, 60)}...`);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });

    const prompt = `You are a professional journalist writing for "The Limerick Weekly" newspaper.

SOURCE ARTICLE:
Title: ${originalArticle.title}
Source: ${originalArticle.source}
Published: ${originalArticle.pubDate}
Summary: ${originalArticle.description}

${fullContent ? `FULL CONTENT:\n${fullContent}` : ''}

TASK: Rewrite this as an original news story for The Limerick Weekly.

REQUIREMENTS:
1. Write in journalistic style - clear, engaging, professional
2. Focus on the Limerick angle - why this matters to local readers
3. Include key facts, quotes (if available), and context
4. Write 3-5 paragraphs (300-500 words)
5. Add a compelling headline that's different from the original
6. Make it feel like original reporting, not a summary
7. Be objective, balanced, and respectful - avoid condescending or patronizing language
8. Treat all communities, individuals, and groups with dignity and respect
9. Report facts without editorial judgment about social class, income, or location
10. Avoid rhetoric that implies some areas or people are "lesser than" others
11. Use neutral, factual language when describing neighborhoods and communities
12. Include local context and impact without sensationalism

RESPOND IN JSON:
{
  "headline": "<your compelling headline>",
  "subheadline": "<optional one-line subheadline>",
  "story": "<your full story in 3-5 paragraphs, separated by \\n\\n>",
  "pullQuote": "<one compelling quote or fact to highlight>",
  "localAngle": "<one sentence explaining the Limerick connection>"
}

Return ONLY valid JSON, no additional text.`;

    try {
        const result = await model.generateContent(prompt);
        const response = await result.response;
        const text = response.text();

        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('No JSON found in AI response');
        }

        const rewritten = JSON.parse(jsonMatch[0]);
        console.log(`   ✓ Generated ${rewritten.story.length} characters`);

        return {
            ...rewritten,
            originalTitle: originalArticle.title,
            originalSource: originalArticle.source,
            originalLink: originalArticle.link,
            publishedAt: originalArticle.pubDate,
            imageUrl: originalArticle.imageUrl,
            rewrittenAt: new Date().toISOString()
        };
    } catch (error) {
        console.error('   ✗ Error rewriting:', error.message);
        return null;
    }
}

/**
 * Get recent articles from Redis
 */
async function getRecentArticles(limit = 20) {
    try {
        const articleIds = await redis.zrevrange('articles:by_date', 0, limit - 1);

        if (articleIds.length === 0) {
            console.log('⚠️  No articles found in database');
            return [];
        }

        const articles = [];
        for (const id of articleIds) {
            const data = await redis.get(`article:${id}`);
            if (data) {
                articles.push(JSON.parse(data));
            }
        }

        return articles;
    } catch (error) {
        console.error('Error fetching articles:', error.message);
        return [];
    }
}

/**
 * Save rewritten article
 */
async function saveRewrittenArticle(rewritten, originalId) {
    try {
        // Save to Redis
        const key = `article:rewritten:${originalId}`;
        await redis.setex(key, 30 * 24 * 60 * 60, JSON.stringify(rewritten)); // 30 days

        // Also save to file for backup
        const outputDir = path.join(__dirname, '..', 'articles');
        await fs.mkdir(outputDir, { recursive: true });

        const filename = `${originalId.replace(/[^a-z0-9]/gi, '-')}.json`;
        const filepath = path.join(outputDir, filename);
        await fs.writeFile(filepath, JSON.stringify(rewritten, null, 2));

        console.log(`   ✓ Saved to Redis and ${filepath}`);
    } catch (error) {
        console.error('Error saving rewritten article:', error.message);
    }
}

/**
 * Rewrite multiple articles
 */
async function rewriteArticles(count = 10) {
    console.log('📝 AI Article Rewriter\n');
    console.log('='.repeat(50));

    try {
        // Get recent articles
        console.log(`\n📚 Fetching ${count} recent articles...`);
        const articles = await getRecentArticles(count);

        if (articles.length === 0) {
            console.log('\n⚠️  No articles available. Run "npm run scrape" first.');
            return null;
        }

        console.log(`✓ Found ${articles.length} articles to rewrite\n`);

        let rewritten = 0;
        let skipped = 0;

        for (const article of articles) {
            // Check if already rewritten
            const existingKey = `article:rewritten:${article.id}`;
            const existing = await redis.get(existingKey);

            if (existing) {
                console.log(`⊘ Skipping (already rewritten): ${article.title.substring(0, 60)}...`);
                skipped++;
                continue;
            }

            // Fetch full content from article URL
            const fullContent = await fetchFullArticle(article.link);

            // Check if article has Limerick connection before rewriting
            console.log(`   🔍 Checking Limerick connection...`);
            const hasConnection = await hasLimerickConnection(article, fullContent);

            if (!hasConnection) {
                console.log(`   ⊘ Skipping (no Limerick connection): ${article.title.substring(0, 60)}...`);
                skipped++;
                continue;
            }

            console.log(`   ✓ Has Limerick connection - proceeding with rewrite`);

            // Rewrite article with full content
            const rewrittenArticle = await rewriteArticle(article, fullContent);

            if (rewrittenArticle) {
                await saveRewrittenArticle(rewrittenArticle, article.id);
                rewritten++;
            }

            // Rate limiting - wait 1 second between requests
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        console.log('\n' + '='.repeat(50));
        console.log('📊 Rewriting Summary:');
        console.log(`   Total articles: ${articles.length}`);
        console.log(`   Rewritten: ${rewritten}`);
        console.log(`   Skipped: ${skipped}`);
        console.log('='.repeat(50));

        return { rewritten, skipped };
    } catch (error) {
        console.error('\n❌ Error:', error.message);
        throw error;
    }
}

// Run if called directly
if (require.main === module) {
    const count = parseInt(process.argv[2]) || 10;

    rewriteArticles(count)
        .then(() => {
            console.log('\n🎉 Done!');
            redis.disconnect();
            process.exit(0);
        })
        .catch((error) => {
            console.error('\n❌ Error:', error);
            redis.disconnect();
            process.exit(1);
        });
}

module.exports = { rewriteArticles, rewriteArticle };
