/**
 * ============================================================================
 *   ANILIST API PROVIDER (secondary backup anime data source — free, no key required)
 * ============================================================================
 *
 *   Talks to https://graphql.anilist.co (GraphQL). No authentication needed,
 *   so it works out of the box. Base URL can be overridden with
 *   ANILIST_GRAPHQL_URL in .env.
 *
 *   All responses are NORMALIZED into the app's internal format so the rest
 *   of the codebase stays provider-agnostic:
 *
 *     { data: [...], pagination: { current_page, last_visible_page, has_next_page } }
 *     item: { id, title, title_english, images.jpg.large_image_url,
 *             score, episodes, type, status, season, year, rating,
 *             synopsis, genres:[{name}], trailer }
 *
 *   "id" holds the numeric AniList id (e.g. "154587" for Frieren).
 *
 *   AniList is metadata-only (search/trending/seasonal/details). Episodes &
 *   streaming sources have no adapter here, so those requests have no provider
 *   (HiAnime was removed); metadata requests fall back to AniList in
 *   routes/anime.js.
 * ============================================================================
 */

const BASE_URL = (process.env.ANILIST_GRAPHQL_URL || 'https://graphql.anilist.co').replace(/\/+$/, '');
const TIMEOUT_MS = Number(process.env.ANILIST_TIMEOUT_MS || 15000);
const RETRIES = 2;

// graphql.anilist.co sits behind Cloudflare, which intermittently blocks
// plain server fetches (HTTP 403) but lets real browser sessions through.
// To stay "just another browser tab", carry the same header fingerprint a
// Chrome tab at anilist.co sends: Origin, Referer, Accept-Language and the
// sec-ch-ua client hints.
const REQUEST_HEADERS = {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
    'Accept-Language': 'en-US,en;q=0.9',
    'Origin': 'https://anilist.co',
    'Referer': 'https://anilist.co/',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    'sec-ch-ua': '"Chromium";v="125", "Google Chrome";v="125", "Not.A/Brand";v="24"',
    'sec-ch-ua-mobile': '?0',
    'sec-ch-ua-platform': '"Windows"'
};

// In-memory cache
const cache = new Map();
const CACHE_TTL = 5 * 60 * 1000;
const CACHE_TTL_LONG = 24 * 60 * 60 * 1000;

function isEnabled() {
    return Boolean(BASE_URL);
}

async function callAniList(query, variables = {}, ttl = CACHE_TTL) {
    const cacheKey = JSON.stringify({ query, variables });

    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < ttl) return cached.data;

    let lastError;
    for (let attempt = 0; attempt <= RETRIES; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(BASE_URL, {
                method: 'POST',
                headers: REQUEST_HEADERS,
                body: JSON.stringify({ query, variables }),
                signal: controller.signal
            });
            // Rate limited: honor Retry-After before backing off
            if (response.status === 429) {
                const retryAfter = Number(response.headers.get('retry-after')) || 60;
                throw Object.assign(
                    new Error(`AniList API rate limit hit (retry in ${retryAfter}s)`),
                    { rateLimited: true, retryAfter }
                );
            }
            if (!response.ok) throw new Error(`AniList API returned ${response.status}`);
            const payload = await response.json();
            if (payload.errors && payload.errors.length) {
                throw new Error(`AniList GraphQL error: ${payload.errors[0].message}`);
            }
            cache.set(cacheKey, { data: payload.data, timestamp: Date.now() });
            return payload.data;
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
 * GRAPHQL QUERIES
 * ============================================================================ */

const MEDIA_FIELDS = `
fragment MediaCore on Media {
  id
  idMal
  title { romaji english native userPreferred }
  coverImage { extraLarge large medium }
  averageScore
  episodes
  format
  status
  season
  seasonYear
  description
  genres
  trailer { id site }
}
`;

const PAGE_QUERY = MEDIA_FIELDS + `
query ($page: Int = 1, $perPage: Int = 24, $search: String, $genres: [String], $status: MediaStatus, $sort: [MediaSort]) {
  Page(page: $page, perPage: $perPage) {
    pageInfo { currentPage lastPage hasNextPage perPage }
    media(type: ANIME, search: $search, genre_in: $genres, status: $status, sort: $sort, isAdult: false) {
      ...MediaCore
    }
  }
}
`;

const DETAIL_QUERY = MEDIA_FIELDS + `
query ($id: Int) {
  Media(id: $id, type: ANIME) {
    ...MediaCore
    bannerImage
    duration
    meanScore
    popularity
    studios(isMain: true) { nodes { name } }
  }
}
`;

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

// AniList descriptions contain inline HTML (<br>, <i>, spoiler spans...)
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
    const pct = Number(averageScore);               // e.g. 87 (0..100 scale)
    if (!Number.isFinite(pct) || pct <= 0) return null;
    return Math.round(pct) / 10;                    // -> 0..10 scale
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

function toTrailerUrl(trailer) {
    if (!trailer || !trailer.id) return null;
    if (String(trailer.site).toLowerCase() === 'youtube') {
        return `https://www.youtube.com/watch?v=${trailer.id}`;
    }
    return null;
}

function normalizeItem(media = {}) {
    const titles = media.title || {};
    const poster = media.coverImage || {};
    const large = poster.extraLarge || poster.large || poster.medium || '';

    return {
        id: String(media.id ?? ''),
        id_mal: media.idMal != null ? Number(media.idMal) || null : null,
        title: titles.english || titles.userPreferred || titles.romaji || 'Unknown title',
        title_english: titles.english || null,
        images: {
            jpg: {
                large_image_url: large,
                image_url: poster.medium || poster.small || large
            }
        },
        score: toScore(media.averageScore),
        episodes: media.episodes != null ? Number(media.episodes) || null : null,
        type: mapFormat(media.format),
        status: mapStatus(media.status),
        season: media.season ? String(media.season).toLowerCase() : null,
        year: media.seasonYear || null,
        rating: null,
        synopsis: cleanText(media.description),
        genres: Array.isArray(media.genres) ? media.genres.map(g => ({ name: g })) : [],
        trailer: toTrailerUrl(media.trailer)
    };
}

function normalizePage(raw = {}, page = 1, limit = 24) {
    const pageData = raw.Page || {};
    const items = (Array.isArray(pageData.media) ? pageData.media : [])
        .filter(Boolean).map(normalizeItem);

    const info = pageData.pageInfo || {};
    const hasNext = Boolean(info.hasNextPage);

    return {
        data: items,
        pagination: {
            current_page: Number(info.currentPage) || page,
            last_visible_page: Number(info.lastPage) || (hasNext ? page + 1 : page),
            has_next_page: hasNext
        }
    };
}

// App genre names are identical to AniList's canonical genre strings
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
        const genreList = String(genres)
            .split(',')
            .map(g => g.trim())
            .filter(Boolean);
        // genre_in uses OR semantics — mood pairs like "Comedy,Slice of Life"
        // broaden the picks instead of over-restricting them.
        const variables = {
            page: Number(page) || 1,
            perPage: Math.min(Math.max(Number(limit) || 24, 1), 50),
            genres: genreList.length ? genreList : undefined,
            sort: q ? ['SEARCH_MATCH'] : ['POPULARITY_DESC']
        };
        if (q) variables.search = q;

        const raw = await callAniList(PAGE_QUERY, variables);
        return normalizePage(raw, variables.page, variables.perPage);
    },

    async trending({ page = 1 } = {}) {
        const p = Number(page) || 1;
        const raw = await callAniList(PAGE_QUERY, { page: p, perPage: 10, sort: ['TRENDING_DESC'] });
        return normalizePage(raw, p, 10);
    },

    async seasonal({ page = 1 } = {}) {
        // Top airing right now by popularity
        const p = Number(page) || 1;
        const raw = await callAniList(PAGE_QUERY, {
            page: p, perPage: 10, status: 'RELEASING', sort: ['POPULARITY_DESC']
        });
        return normalizePage(raw, p, 10);
    },

    async genres() {
        // Serve the app's canonical genre list statically — these names match
        // AniList's genre enum values exactly, so filtering keeps working
        // without a network call.
        return { data: GENRE_NAMES.map((name, i) => ({ id: i + 1, name })) };
    },

    async detail({ id }) {
        const numericId = Number(id);
        if (!Number.isInteger(numericId)) throw new Error(`Invalid AniList id "${id}"`);
        const raw = await callAniList(DETAIL_QUERY, { id: numericId }, CACHE_TTL_LONG);
        if (!raw || !raw.Media) throw new Error(`AniList anime not found (id ${id})`);
        const item = normalizeItem(raw.Media);
        item.banner_image = raw.Media.bannerImage || null;
        item.duration = raw.Media.duration != null ? Number(raw.Media.duration) : null;
        item.studio = (raw.Media.studios && Array.isArray(raw.Media.studios.nodes) && raw.Media.studios.nodes[0] && raw.Media.studios.nodes[0].name) || null;
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
    if (!adapter) throw new Error(`No AniList adapter named "${name}"`);
    return adapter(args);
}

module.exports = { isEnabled, call };

