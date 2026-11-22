/**
 * ============================================================================
 *   MIRURO API PROVIDER (primary anime data source)
 * ============================================================================
 *
 *   Talks to a Miruro-compatible REST API. Miruro (miruro.tv) is an
 *   AniList-driven streaming site, so a Miruro API wrapper re-exposes AniList's
 *   metadata (search / trending / recent / upcoming / top) as simple JSON and,
 *   optionally, Miruro streaming sources.
 *
 *   Base URL defaults to a community wrapper (https://miruro.adgstudios.co.za)
 *   and can be overridden with MIRURO_API_BASE_URL in .env — including pointing
 *   at a self-hosted instance (e.g. one of the open-source Miruro wrappers).
 *
 *   This wrapper follows the common shape:
 *
 *     GET /search?query=&page=&per_page=
 *     GET /trending?page=&per_page=
 *     GET /popular?page=&per_page=
 *     GET /recent?page=&per_page=      <- currently airing / this season
 *     GET /upcoming?page=&per_page=    <- not-yet-released / upcoming
 *
 *   Responses:
 *     { "success": true, "results": { page, perPage, total, hasNextPage, results: [ ... ] } }
 *
 *   Each result is AniList-shaped:
 *     { id, title: { romaji, english },
 *       coverImage: { large }, format, status, season, seasonYear,
 *       averageScore, episodes, genres, ... }
 *
 *   All responses are NORMALIZED into the app's internal format so the rest
 *   of the codebase stays provider-agnostic:
 *
 *     { data: [...], pagination: { current_page, last_visible_page, has_next_page } }
 *     item: { id, title, title_english, images.jpg.large_image_url,
 *             score, episodes, type, status, season, year, rating,
 *             synopsis, genres:[{name}], trailer }
 *
 *   "id" holds the numeric AniList id, which also keys the app's existing
 *   "Watch Now on Miruro" links.
 *
 *   Miruro is the primary metadata provider (search/trending/seasonal/detail),
 *   with AniList as the free backup. Episodes & streaming sources have no
 *   adapter, so those requests have no provider (HiAnime was removed); genre-only
 *   (mood) searches fall back to AniList in routes/anime.js because Miruro only
 *   searches by title.
 * ============================================================================
 */

const BASE_URL = (process.env.MIRURO_API_BASE_URL || 'https://miruro.adgstudios.co.za').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.MIRURO_TIMEOUT_MS || 15000);
const RETRIES = 2;

// In-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_TTL_LONG = 24 * 60 * 60 * 1000;

function isEnabled() {
    return Boolean(BASE_URL);
}

async function callMiruro(pathAndQuery, ttl = CACHE_TTL) {
    const url = `${BASE_URL}${pathAndQuery}`;

    const cached = cache.get(url);
    if (cached && Date.now() - cached.timestamp < ttl) return cached.data;

    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(url, {
                headers: { Accept: 'application/json' },
                signal: controller.signal
            });
            if (response.status === 429) {
                const retryAfter = Number(response.headers.get('retry-after')) || 30;
                throw Object.assign(
                    new Error(`Miruro API rate limit hit (retry in ${retryAfter}s)`),
                    { rateLimited: true, retryAfter }
                );
            }
            if (response.status === 404) throw new Error(`Miruro endpoint not found (${response.status})`);
            if (!response.ok) throw new Error(`Miruro API returned ${response.status}`);
            let data = await response.json();
            // Some wrappers nest under { success, results }; flatten expectantly.
            if (Array.isArray(data.results)) return data;                       // already a page shape
            if (data && data.results && typeof data.results === 'object') {
                data = data.results;                                            // unwrap { results: {...} }
            }
            cache.set(url, { data, timestamp: Date.now() });
            return data;
        } catch (error) {
            lastError = error;
            if (attempt < RETRIES) {
                const delayMs = error.rateLimited
                    ? Math.min(error.retryAfter * 1000, 60000)
                    : 800 * (attempt + 1);
                await new Promise(r => setTimeout(r, delayMs));
            }
        } finally {
            clearTimeout(timer);
        }
    }
    throw lastError;
}

/* ============================================================================
 * NORMALIZATION
 * ============================================================================ */

function decodeEntities(str) {
    return String(str || '')
        .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>');
}

function cleanText(str) {
    return decodeEntities(str)
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/p>/gi, '\n\n')
        .replace(/<[^>]*>/g, '')
        .replace(/[ \t]+\n/g, '\n')
        .replace(/\n{3,}/g, '\n\n')
        .trim();
}

function toScore(averageScore) {
    if (averageScore === undefined || averageScore === null || averageScore === '') return null;
    const pct = Number(averageScore);
    if (!Number.isFinite(pct) || pct <= 0) return null;
    if (pct > 0 && pct <= 10) return Math.round(pct * 10) / 10;   // already 0-10
    return Math.round(pct) / 10;                                  // 0-100 -> 0-10
}

function mapFormat(format) {
    switch (String(format || '').toUpperCase()) {
        case 'MOVIE': return 'Movie';
        case 'OVA': return 'OVA';
        case 'ONA': return 'ONA';
        case 'SPECIAL': return 'Special';
        case 'MUSIC': return 'Music';
        case 'TV':
        case 'TV_SHORT': return 'TV';
        default: return 'TV';
    }
}

function mapStatus(status) {
    switch (String(status || '').toUpperCase()) {
        case 'RELEASING': return 'Currently Airing';
        case 'FINISHED': return 'Finished Airing';
        case 'NOT_YET_RELEASED': return 'Not yet aired';
        case 'CANCELLED': return 'Cancelled';
        case 'HIATUS': return 'On Hiatus';
        default: return '';
    }
}

function normalizeItem(raw = {}) {
    const titles = raw.title || {};
    const title = titles.english || titles.romaji || raw.title_english || raw.name || 'Unknown title';
    const poster = raw.coverImage || raw.poster || {};
    const large = poster.extraLarge || poster.large || poster.medium || (typeof poster === 'string' ? poster : '');
    // Miruro results may carry a full date object or a plain year
    const year = raw.seasonYear
        ?? (raw.year)
        ?? (raw.startDate && raw.startDate.year)
        ?? null;

    return {
        id: String(raw.id ?? ''),
        title,
        title_english: titles.english || raw.title_english || null,
        images: {
            jpg: {
                large_image_url: large,
                image_url: poster.medium || poster.small || large
            }
        },
        score: toScore(raw.averageScore ?? raw.score),
        episodes: raw.episodes != null ? Number(raw.episodes) || null : null,
        type: mapFormat(raw.format),
        status: mapStatus(raw.status),
        season: raw.season ? String(raw.season).toLowerCase() : null,
        year: year != null ? Number(year) || null : null,
        rating: null,
        synopsis: cleanText(raw.description || raw.synopsis),
        genres: Array.isArray(raw.genres)
            ? raw.genres.map(g => ({ name: typeof g === 'string' ? g : (g && g.name) || 'Unknown' }))
            : [],
        trailer: null
    };
}

// Adult / hentai titles are never shown anywhere in the app. Miruro's metadata
// is AniList-derived, so each raw result carries an `isAdult` flag (plus the
// genres), which we use to drop 18+ titles from every list before it reaches
// the UI. Note: "Ecchi" is animated/comedy-leaning and NOT filtered here — only
// actual 18+ titles (flagged isAdult, or format/genre literally "Hentai"/"Adult").
const HENTAI_TERMS = new Set(['Hentai', 'Adult']);

function isAdult(item) {
    if (!item) return false;
    if (item.isAdult === true) return true;
    if (String(item.format || '').toLowerCase() === 'hentai') return true;
    if (Array.isArray(item.genres)) {
        for (const g of item.genres) {
            const name = typeof g === 'string' ? g : (g && g.name);
            if (name && HENTAI_TERMS.has(String(name))) return true;
        }
    }
    return false;
}

function normalizePage(raw = {}, page = 1, limit = 20) {
    let items = [];
    if (Array.isArray(raw)) items = raw;
    else if (Array.isArray(raw.results)) items = raw.results;
    else if (Array.isArray(raw.data)) items = raw.data;
    else if (Array.isArray(raw.animes)) items = raw.animes;

    const currentPage = Number(raw.page) || Number(raw.currentPage) || page;
    const hasNext = Boolean(raw.hasNextPage) || raw.hasNextPage === undefined && false;
    const totalPages = Number(raw.lastPage) || (hasNext ? currentPage + 1 : currentPage);

    return {
        data: items.filter(Boolean)
            .filter(item => !isAdult(item))
            .map(normalizeItem),
        pagination: {
            current_page: currentPage,
            last_visible_page: totalPages,
            has_next_page: hasNext
        }
    };
}

// App genre names are identical to AniList's canonical genre strings (Miruro
// metadata is AniList-derived, so filtering keeps working).
const GENRE_NAMES = [
    'Action', 'Adventure', 'Comedy', 'Drama', 'Ecchi', 'Fantasy', 'Horror',
    'Mahou Shoujo', 'Mecha', 'Music', 'Mystery', 'Psychological', 'Romance',
    'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural', 'Thriller'
];

/* ============================================================================
 * ADAPTERS — one per backend capability
 * ============================================================================ */

const ADAPTERS = {
    async search({ q = '', genres = '', page = 1, limit = 24 }) {
        const p = Number(page) || 1;
        const perPage = Math.min(Math.max(Number(limit) || 24, 1), 50);

        // Text query -> Miruro full-text /search
        if (q) {
            const params = new URLSearchParams();
            params.set('query', q);
            params.set('page', String(p));
            params.set('per_page', String(perPage));
            const raw = await callMiruro(`/search?${params.toString()}`);
            return normalizePage(raw, p, perPage);
        }

        // Genre (mood) search -> Miruro /filter. Miruro's /filter only filters
        // by ONE genre at a time, so query each requested genre and
        // merge/dedupe the results. Mirror the requested page on every genre so
        // pagination stays real.
        const genreList = String(genres)
            .split(',')
            .map(g => g.trim())
            .filter(Boolean);

        if (!genreList.length) return normalizePage({ results: [] }, p, perPage);

        const genreItems = [];
        const seenGenre = new Set();
        let maxTotal = 0;
        let anyHasNext = false;

        for (const genre of genreList) {
            const params = new URLSearchParams();
            params.set('genre', genre);
            params.set('page', String(p));
            params.set('per_page', String(Math.max(perPage, 10)));
            let raw;
            try {
                raw = await callMiruro(`/filter?${params.toString()}`, CACHE_TTL);
            } catch {
                continue; // one bad genre shouldn't break the whole search
            }
            maxTotal = Math.max(maxTotal, Number(raw.total) || 0);
            anyHasNext = anyHasNext || Boolean(raw.hasNextPage);
            const list = normalizePage(raw, p, perPage);
            for (const item of list.data) {
                if (seenGenre.has(item.id)) continue;
                seenGenre.add(item.id);
                genreItems.push(item);
            }
        }

        const lastPage = Math.max(Math.ceil((maxTotal || perPage) / perPage), 1);

        return {
            data: genreItems.slice(0, perPage),
            pagination: {
                current_page: p,
                last_visible_page: lastPage,
                has_next_page: anyHasNext || p < lastPage
            }
        };
    },

    async trending({ page = 1 } = {}) {
        const p = Number(page) || 1;
        const params = new URLSearchParams();
        params.set('page', String(p));
        params.set('per_page', '10');
        const raw = await callMiruro(`/trending?${params.toString()}`);
        return normalizePage(raw, p, 10);
    },

    // Miruro's /recent is "currently airing / this season" — a good fit for the
    // app's seasonal (airing-now) section.
    async seasonal({ page = 1 } = {}) {
        const p = Number(page) || 1;
        const params = new URLSearchParams();
        params.set('page', String(p));
        params.set('per_page', '10');
        const raw = await callMiruro(`/recent?${params.toString()}`);
        return normalizePage(raw, p, 10);
    },

    async genres() {
        // Serve the app's canonical genre list statically — names match
        // AniList's genre enum values exactly, so filtering keeps working.
        return { data: GENRE_NAMES.map((name, i) => ({ id: i + 1, name })) };
    },

    async detail({ id }) {
        const numericId = Number(id);
        if (!Number.isInteger(numericId)) throw new Error(`Invalid Miruro id "${id}"`);
        // Some wrappers expose /info/{id}; try it, else fall back to a search match.
        let raw;
        try {
            raw = await callMiruro(`/info/${numericId}`, CACHE_TTL_LONG);
        } catch {
            const search = await callMiruro(`/search?query=${encodeURIComponent(String(numericId))}&per_page=1`);
            const list = normalizePage(search, 1, 1).data;
            const hit = list.find(i => i.id === String(numericId)) || list[0];
            if (!hit) throw new Error(`Miruro anime not found (id ${id})`);
            return { data: hit };
        }
        // /info may return the item directly or wrapped under .results / .anime
        const info = (raw && raw.anime) || (raw && raw.data) || raw;
        const item = normalizeItem(info);
        // Only real widescreen banners belong here — mirroring a portrait
        // cover into the wide banner slot stretches it and looks blurry.
        item.banner_image = info.bannerImage || null;
        item.duration = info.duration != null ? Number(info.duration) : null;
        item.studio = (info.studios && Array.isArray(info.studios.nodes) && info.studios.nodes[0] && info.studios.nodes[0].name) || null;
        item.episodes_total = item.episodes;
        return { data: item };
    }
};

/**
 * @param {string} name one of: search | trending | seasonal | genres | detail
 * @param {object} args endpoint arguments
 */
async function call(name, args = {}) {
    const adapter = ADAPTERS[name];
    if (!adapter) throw new Error(`No Miruro adapter named "${name}"`);
    return adapter(args);
}

module.exports = { isEnabled, call };
