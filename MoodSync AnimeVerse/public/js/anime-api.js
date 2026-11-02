window.AnimeAPI = {
    baseUrl: '/api/anime',
    // In-memory layer in front of sessionStorage — avoids repeated
    // JSON.parse/stringify of large payload lists on every navigation
    _memCache: new Map(),
    TTL: 300000, // 5 min

    _readCache(url) {
        const hit = this._memCache.get(url);
        if (hit && Date.now() - hit.timestamp < this.TTL) return hit.data;
        try {
            const raw = sessionStorage.getItem(url);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Date.now() - parsed.timestamp < this.TTL) {
                    this._memCache.set(url, parsed);
                    return parsed.data;
                }
            }
        } catch (e) {}
        return null;
    },

    _writeCache(url, data) {
        const entry = { data, timestamp: Date.now() };
        this._memCache.set(url, entry);
        try {
            sessionStorage.setItem(url, JSON.stringify(entry));
        } catch (e) { /* quota exceeded — memory cache still works */ }
    },

    async _fetch(endpoint) {
        const url = `${this.baseUrl}${endpoint}`;

        // Simple session cache
        const cached = this._readCache(url);
        if (cached) return cached;

        try {
            const response = await fetch(url);
            if (!response.ok) throw new Error(`API Error: ${response.status}`);
            const data = await response.json();

            this._writeCache(url, data);
            return data;
        } catch (error) {
            window.UI.showToast('Could not reach the anime service. Please try again.', 'error');
            throw error;
        }
    },

    async searchByMood(mood, page = 1) {
        const genres = window.MoodMapping.getGenresForMood(mood);
        if (!genres) return { data: [], pagination: {} };
        return this._fetch(`/search?genres=${encodeURIComponent(genres)}&page=${page}&limit=24`);
    },

    async getCurated(mood) {
        const titles = (window.MoodMapping.CURATED_ANIME && window.MoodMapping.CURATED_ANIME[mood]) || [];
        const results = await Promise.allSettled(
            titles.map(title =>
                this._fetch(`/search?q=${encodeURIComponent(title)}&limit=1`).then(res => (res.data && res.data[0]) || null)
            )
        );
        return results
            .filter(r => r.status === 'fulfilled' && r.value)
            .map(r => r.value)
            .filter((item, i, arr) => arr.findIndex(x => x.id === item.id) === i); // de-dupe
    },

    async getDetail(id) {
        const res = await this._fetch(`/${encodeURIComponent(id)}`);
        return res.data;
    },

    async getEpisodes(id) {
        const res = await this._fetch(`/episodes/${encodeURIComponent(id)}`);
        return res.data;
    },

    async getSources(episodeId) {
        const response = await fetch(`${this.baseUrl}/sources/${encodeURIComponent(episodeId)}`);
        if (!response.ok) throw new Error(`API Error: ${response.status}`);
        return response.json();
    },

    async getTrending() {
        const res = await this._fetch('/trending');
        return res.data;
    },

    async getSeasonal() {
        const res = await this._fetch('/seasonal');
        return res.data;
    },

    async search(query, genres = '', page = 1) {
        let q = `/search?page=${page}&limit=24`;
        if (query) q += `&q=${encodeURIComponent(query)}`;
        if (genres) q += `&genres=${encodeURIComponent(genres)}`;
        return this._fetch(q);
    },
};
