const fs = require('fs');
const path = require('path');

const STORE_PATH = process.env.STORE_PATH || path.join(__dirname, '..', '..', 'data', 'store.json');
const TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days, same as the old Redis expiry

let cache = null;

function emptyStore() {
    return { meta: {}, articles: {}, rewritten: {} };
}

function timestampOf(article) {
    const t = new Date(article.pubDate || article.scrapedAt).getTime();
    return Number.isNaN(t) ? new Date(article.scrapedAt).getTime() || 0 : t;
}

function load() {
    if (cache) return cache;
    try {
        cache = { ...emptyStore(), ...JSON.parse(fs.readFileSync(STORE_PATH, 'utf8')) };
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        cache = emptyStore();
    }
    prune();
    return cache;
}

/** Drop anything older than the 30 day TTL. */
function prune() {
    const cutoff = Date.now() - TTL_MS;
    for (const [id, article] of Object.entries(cache.articles)) {
        if (new Date(article.scrapedAt).getTime() < cutoff) {
            delete cache.articles[id];
        }
    }
    for (const [id, article] of Object.entries(cache.rewritten)) {
        if (new Date(article.rewrittenAt).getTime() < cutoff) {
            delete cache.rewritten[id];
        }
    }
}

/** Write atomically so a crashed run can't leave a half-written store. */
function save() {
    const data = load();
    fs.mkdirSync(path.dirname(STORE_PATH), { recursive: true });
    const tmp = `${STORE_PATH}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(data, null, 2));
    fs.renameSync(tmp, STORE_PATH);
}

function hasArticle(id) {
    return Object.prototype.hasOwnProperty.call(load().articles, id);
}

function getArticle(id) {
    return load().articles[id] || null;
}

function addArticle(article) {
    load().articles[article.id] = article;
}

/** Newest first, like the old `zrevrange articles:by_date`. */
function getRecentArticles(limit = 20) {
    return Object.values(load().articles)
        .sort((a, b) => timestampOf(b) - timestampOf(a))
        .slice(0, limit);
}

function removeArticle(id) {
    const data = load();
    delete data.articles[id];
    delete data.rewritten[id];
}

function getRewritten(id) {
    return load().rewritten[id] || null;
}

function setRewritten(id, rewritten) {
    load().rewritten[id] = rewritten;
}

/** Rewritten articles as [id, article], newest published first. */
function listRewritten() {
    return Object.entries(load().rewritten)
        .sort(([, a], [, b]) => timestampOf({ pubDate: b.publishedAt, scrapedAt: b.rewrittenAt }) -
            timestampOf({ pubDate: a.publishedAt, scrapedAt: a.rewrittenAt }));
}

function clearRewrites() {
    const data = load();
    const cleared = Object.keys(data.rewritten).length;
    data.rewritten = {};
    return cleared;
}

function setMeta(key, value) {
    load().meta[key] = value;
}

module.exports = {
    STORE_PATH,
    save,
    hasArticle,
    getArticle,
    addArticle,
    getRecentArticles,
    removeArticle,
    getRewritten,
    setRewritten,
    listRewritten,
    clearRewrites,
    setMeta
};
