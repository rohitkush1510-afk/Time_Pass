window.UserStore = {
    KEYS: {
        favorites: 'moodsync_favorites',
        watchLater: 'moodsync_watchlater',
        moodHistory: 'moodsync_mood_history',
        watchHistory: 'moodsync_watch_history'
    },

    _read(key) {
        try {
            return JSON.parse(localStorage.getItem(key)) || [];
        } catch (e) {
            return [];
        }
    },

    _migrate(list) {
        return list.map(item => {
            if (item && typeof item === 'object' && item.animeId == null && item.malId != null) {
                return { ...item, animeId: String(item.malId), malId: undefined };
            }
            return item;
        });
    },

    _write(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
        } catch (e) {
            console.error('Storage write failed', e);
        }
    },

    // ---- Saved collections (favorites / watch later share one code path) ----
    _getCollection(key) {
        return this._migrate(this._read(key));
    },

    _inCollection(key, animeId) {
        const id = String(animeId);
        return this._getCollection(key).some(i => String(i.animeId) === id);
    },

    _addToCollection(key, anime, extra) {
        const list = this._getCollection(key).filter(i => i.animeId !== anime.animeId);
        list.unshift({
            animeId: anime.animeId,
            title: anime.title,
            imageUrl: anime.imageUrl,
            addedAt: new Date().toISOString(),
            ...extra
        });
        this._write(key, list);
    },

    _removeFromCollection(key, animeId) {
        const id = String(animeId);
        this._write(key, this._getCollection(key).filter(i => String(i.animeId) !== id));
    },

    _toggleInCollection(key, anime, extra) {
        if (this._inCollection(key, anime.animeId)) {
            this._removeFromCollection(key, anime.animeId);
            return false;
        }
        this._addToCollection(key, anime, extra);
        return true;
    },

    // ---- Favorites ----
    getFavorites() {
        return this._getCollection(this.KEYS.favorites);
    },

    isFavorite(animeId) {
        return this._inCollection(this.KEYS.favorites, animeId);
    },

    removeFavorite(animeId) {
        this._removeFromCollection(this.KEYS.favorites, animeId);
    },

    toggleFavorite(anime) {
        return this._toggleInCollection(this.KEYS.favorites, anime, { score: anime.score || null });
    },

    // ---- Watch Later ----
    getWatchLater() {
        return this._getCollection(this.KEYS.watchLater);
    },

    inWatchLater(animeId) {
        return this._inCollection(this.KEYS.watchLater, animeId);
    },

    removeWatchLater(animeId) {
        this._removeFromCollection(this.KEYS.watchLater, animeId);
    },

    toggleWatchLater(anime) {
        return this._toggleInCollection(this.KEYS.watchLater, anime, {});
    },

    // ---- Logs (mood history / watch history share one append path) ----
    _pushLog(key, item, cap, replaceFilter) {
        let list = this._read(key);
        if (replaceFilter) list = list.filter(i => !replaceFilter(i));
        list.unshift({
            id: Date.now() + '_' + Math.random().toString(36).slice(2, 7),
            ...item
        });
        this._write(key, list.slice(0, cap));
    },

    // ---- Mood History ----
    getMoodHistory(limit = 20) {
        return this._read(this.KEYS.moodHistory).slice(0, limit);
    },

    addMoodHistory(entry) {
        const isScan = (entry.method || 'manual') === 'scan';
        // A new face scan overwrites all previous scan records — only the
        // latest detected mood is kept (manual picks are never touched)
        this._pushLog(
            this.KEYS.moodHistory,
            { mood: entry.mood, confidence: entry.confidence, method: entry.method || 'manual', detectedAt: new Date().toISOString() },
            100,
            isScan ? (i => i.method === 'scan') : null
        );
    },

    // ---- Watch History / Feedback ----
    addWatchHistory(entry) {
        this._pushLog(
            this.KEYS.watchHistory,
            { animeId: entry.animeId, title: entry.title, mood: entry.mood || 'unknown', feedback: entry.feedback, watchedAt: new Date().toISOString() },
            200
        );
    }
};
