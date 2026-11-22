const express = require('express');
const router = express.Router();
const miruroApi = require('../services/miruro-api');
const anilistApi = require('../services/anilist-api');

// ---------------------------------------------------------------------------
// Failover chain: AniList (primary, GraphQL metadata) -> Miruro (backup,
// AniList-mirror wrapper).
//
// AniList became the primary because the public Miruro wrapper
// (miruro.adgstudios.co.za) is down hard — every endpoint 500s with its own
// "AniList query failed" — while AniList's GraphQL works for direct
// browser-like calls. Miruro stays last as a backup in case a working
// instance is configured via MIRURO_API_BASE_URL.
//
// Both providers cover the full metadata surface (search/mood+genre search,
// trending, seasonal, detail). Adult/hentai titles are never surfaced.
// ---------------------------------------------------------------------------

const PROVIDERS = [
    { api: anilistApi, source: 'anilist' },
    { api: miruroApi, source: 'miruro' }
];

// Circuit breaker: if a provider throws, skip it for a minute instead of
// re-trying it (with all its backoff delays) on every single request.
const COOLDOWN_MS = 60 * 1000;
const downUntil = Object.fromEntries(PROVIDERS.map(p => [p.source, 0]));
// Report one source go-down once (until it recovers) instead of spamming a
// warning for every endpoint that happens to hit it.
const downReported = Object.fromEntries(PROVIDERS.map(p => [p.source, false]));

async function serveAnimeData(res, name, args = {}) {
    let lastError;

    for (const { api, source } of PROVIDERS) {
        if (!api.isEnabled() || Date.now() < downUntil[source]) continue;
        try {
            const data = await api.call(name, args);
            downUntil[source] = 0;
            if (!res.headersSent) res.set('X-Anime-Source', source);
            if (downReported[source]) {
                downReported[source] = false;
                console.info(`[anime] ${source} recovered`);
            }
            return data;
        } catch (error) {
            downUntil[source] = Date.now() + COOLDOWN_MS;
            lastError = error;
            if (!downReported[source]) {
                downReported[source] = true;
                console.warn(`[anime] ${source} is down (${error.message}) - falling back to another provider`);
            }
        }
    }

    throw lastError || new Error('No anime provider available');
}

// GET /search - q, genres (names), page, limit
router.get('/search', async (req, res) => {
    try {
        const data = await serveAnimeData(res, 'search', {
            q: req.query.q || '',
            genres: req.query.genres || '',
            page: Number(req.query.page) || 1,
            limit: Number(req.query.limit) || 24
        });
        res.json(data);
    } catch (error) {
        res.status(error.status || 502).json({ error: 'Failed to search anime', message: error.message });
    }
});

// GET /trending - currently airing highlights
router.get('/trending', async (req, res) => {
    try {
        const data = await serveAnimeData(res, 'trending', { page: Number(req.query.page) || 1 });
        res.json(data);
    } catch (error) {
        res.status(error.status || 502).json({ error: 'Failed to fetch trending anime', message: error.message });
    }
});

// GET /seasonal - top airing this season
router.get('/seasonal', async (req, res) => {
    try {
        const data = await serveAnimeData(res, 'seasonal', { page: Number(req.query.page) || 1 });
        res.json(data);
    } catch (error) {
        res.status(error.status || 502).json({ error: 'Failed to fetch seasonal anime', message: error.message });
    }
});

// GET /:id - details (must stay LAST so it doesn't shadow the routes above)
router.get('/:id', async (req, res) => {
    try {
        const data = await serveAnimeData(res, 'detail', { id: req.params.id });
        res.json(data);
    } catch (error) {
        res.status(error.status || 502).json({ error: 'Failed to fetch anime details', message: error.message });
    }
});

module.exports = router;
