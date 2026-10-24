const { GoogleGenerativeAI } = require('@google/generative-ai');

const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite';

// The free tier allows 15 requests a minute per model, so space calls a little over 4s apart
const MIN_INTERVAL_MS = parseInt(process.env.GEMINI_MIN_INTERVAL_MS || '4500');
const MAX_RETRIES = 3;

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: MODEL });

let lastCallAt = 0;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

/** Rate limits and overloads are worth waiting out; anything else is a real failure. */
function isRetryable(error) {
    return /\b(429|500|503)\b|Too Many Requests|overloaded|Service Unavailable/i.test(error.message);
}

/** Gemini says how long to wait ("Please retry in 14.3s"); fall back to 30s if it doesn't. */
function retryDelayMs(error) {
    const match = error.message.match(/retry in ([\d.]+)s/i) || error.message.match(/"retryDelay":"(\d+)s"/);
    return match ? Math.ceil(parseFloat(match[1]) * 1000) + 1000 : 30000;
}

/** Send a prompt and return the response text, pacing calls and retrying on rate limits. */
async function generate(prompt) {
    for (let attempt = 0; ; attempt++) {
        const wait = lastCallAt + MIN_INTERVAL_MS - Date.now();
        if (wait > 0) await sleep(wait);
        lastCallAt = Date.now();

        try {
            const result = await model.generateContent(prompt);
            return result.response.text();
        } catch (error) {
            if (attempt >= MAX_RETRIES || !isRetryable(error)) throw error;
            const delay = retryDelayMs(error);
            console.log(`   ⏳ Gemini busy or rate limited, retrying in ${Math.round(delay / 1000)}s...`);
            await sleep(delay);
        }
    }
}

module.exports = { generate, MODEL };
