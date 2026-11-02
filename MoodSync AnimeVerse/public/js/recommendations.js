window.Recommendations = {
    currentPage: 1,
    totalPages: 1,
    isLoading: false,
    // In-session snapshots let Back return to the same mood/page/scroll
    // instantly instead of re-fetching and resetting everything.
    _snapshot: null,
    _lastMainData: null,
    _lastCuratedData: null,
    _lastTrendingData: null,

    clearCache() {
        this._snapshot = null;
        this._lastMainData = null;
        this._lastCuratedData = null;
        this._lastTrendingData = null;
    },

    renderPage() {
        return `
            <div class="recommendations-page">
                <div id="reco-header" class="mood-banner">
                    <div class="reco-mood-hero" id="reco-mood-hero"></div>
                    <h1 id="reco-title">Finding anime for you...</h1>
                    <p id="reco-subtitle"></p>
                    <div id="reco-confidence-bar" class="reco-confidence-bar" style="display:none;">
                        <div class="reco-conf-track">
                            <div class="reco-conf-fill" id="reco-conf-fill"></div>
                        </div>
                        <span class="reco-conf-label" id="reco-conf-label"></span>
                    </div>
                    <button class="btn-rescan" onclick="window.navigateTo('#/scan')"><span class="reco-rescan-glyph">🔄</span> Not feeling it? Rescan!</button>
                </div>

                <div class="container">
                    <h3>Your Personalized Recommendations</h3>
                    <div id="reco-grid" class="anime-grid"></div>
                    <div id="reco-pagination"></div>

                    <h3 style="margin-top: 40px;">👑 Handpicked for This Mood</h3>
                    <div id="curated-grid" class="anime-grid horizontal-scroll"></div>

                    <h3 style="margin-top: 40px;">You Might Also Like (Trending)</h3>
                    <div id="trending-grid" class="anime-grid horizontal-scroll"></div>
                </div>
            </div>
        `;
    },

    async mountPage() {
        const mood = window.APP_STATE.currentMood;
        if (!mood) {
            window.navigateTo('#/scan');
            return;
        }

        const config = window.MoodMapping.MOOD_CONFIG[mood];
        const confidence = window.APP_STATE.moodConfidence;
        const confPct = confidence ? Math.round(confidence * 100) : null;

        // Mood-themed header with gradient and emoji hero
        const header = document.getElementById('reco-header');
        header.style.background = `linear-gradient(135deg, ${config.color}66, ${config.color}22, var(--bg-secondary))`;

        const heroEl = document.getElementById('reco-mood-hero');
        if (heroEl) {
            heroEl.innerHTML = `<span class="reco-mood-emoji">${config.emoji}</span>`;
            heroEl.style.setProperty('--reco-color', config.color);
        }

        document.getElementById('reco-title').innerHTML = `Anime for when you're feeling <span style="color:${config.color}">${config.label}</span>`;
        document.getElementById('reco-subtitle').innerText = `Recommended genres: ${config.genreNames}`;

        // Show confidence bar if available
        if (confPct !== null) {
            const barWrap = document.getElementById('reco-confidence-bar');
            const barFill = document.getElementById('reco-conf-fill');
            const barLabel = document.getElementById('reco-conf-label');
            if (barWrap && barFill && barLabel) {
                barWrap.style.display = 'flex';
                barFill.style.background = config.color;
                barLabel.textContent = `${confPct}% match`;
                barLabel.style.color = config.color;
                setTimeout(() => { barFill.style.width = confPct + '%'; }, 200);
            }
        }

        // Back button: restore the in-session snapshot for this mood instead of
        // re-fetching (which flashes skeletons and drops the mood).
        if (this._snapshot && this._snapshot.mood === mood) {
            this.restoreSnapshot(mood);
            return;
        }

        // Fresh load — new mood (or first visit)
        this.currentPage = 1;
        this.clearCache();

        const grid = document.getElementById('reco-grid');
        window.UI.createSkeletonCards(10).forEach(c => grid.appendChild(c));

        try {
            await this.goToPage(1);
            this.loadCurated(mood);
            this.loadTrending();
        } catch (e) {
            grid.innerHTML = '<p>Failed to load recommendations.</p>';
        }
    },

    restoreSnapshot(mood) {
        const s = this._snapshot;
        this.currentPage = s.page || 1;
        this.totalPages = s.totalPages || 1;

        const grid = document.getElementById('reco-grid');
        grid.innerHTML = '';
        (s.mainData || []).forEach(anime => grid.appendChild(window.UI.createAnimeCard(anime)));

        const paginationContainer = document.getElementById('reco-pagination');
        paginationContainer.innerHTML = '';
        if (grid.children.length && this.totalPages > 1) {
            paginationContainer.appendChild(window.UI.createPagination({
                currentPage: this.currentPage,
                totalPages: Math.min(this.totalPages, 50),
                onPageChange: (p) => this.goToPage(p)
            }));
        }

        const curatedGrid = document.getElementById('curated-grid');
        if (curatedGrid) {
            curatedGrid.innerHTML = '';
            (s.curatedData || []).forEach(anime => curatedGrid.appendChild(window.UI.createAnimeCard(anime)));
        }
        const trendingGrid = document.getElementById('trending-grid');
        if (trendingGrid) {
            trendingGrid.innerHTML = '';
            (s.trendingData || []).forEach(anime => trendingGrid.appendChild(window.UI.createAnimeCard(anime)));
        }

        if (s.scrollY) {
            requestAnimationFrame(() => window.scrollTo(0, s.scrollY));
        }
    },

    async goToPage(page) {
        if (this.isLoading) return;
        this.isLoading = true;

        const mood = window.APP_STATE.currentMood;
        const grid = document.getElementById('reco-grid');
        const paginationContainer = document.getElementById('reco-pagination');

        if (!grid) { this.isLoading = false; return; }

        if (page === 1) grid.innerHTML = '';
        window.UI.createSkeletonCards(10).forEach(c => grid.appendChild(c));
        paginationContainer.innerHTML = '';
        if (page > 1) window.scrollTo({ top: 0, behavior: 'smooth' });

        try {
            const result = await window.AnimeAPI.searchByMood(mood, page);

            if (result.data && result.data.length > 0) {
                grid.innerHTML = '';
                this._lastMainData = result.data;
                result.data.forEach(anime => {
                    grid.appendChild(window.UI.createAnimeCard(anime));
                });
                this.currentPage = result.pagination?.current_page || page;
                this.totalPages = result.pagination?.last_visible_page || 1;

                paginationContainer.appendChild(window.UI.createPagination({
                    currentPage: this.currentPage,
                    totalPages: Math.min(this.totalPages, 50),
                    onPageChange: (p) => this.goToPage(p)
                }));
            } else {
                grid.innerHTML = '<p>No recommendations found for this mood.</p>';
            }
        } catch (e) {
            console.error('Failed to load recommendations page', e);
            grid.innerHTML = '<p>Could not load recommendations. Please try again.</p>';
        } finally {
            this.isLoading = false;
        }
    },

    async loadCurated(mood) {
        const grid = document.getElementById('curated-grid');
        if (!grid) return;
        try {
            const curated = await window.AnimeAPI.getCurated(mood);
            this._lastCuratedData = curated;
            grid.innerHTML = '';
            curated.forEach(anime => grid.appendChild(window.UI.createAnimeCard(anime)));
            if (curated.length === 0) {
                grid.innerHTML = '<p>No handpicked titles available right now.</p>';
            }
        } catch (e) {
            console.error('Failed to load curated picks', e);
            grid.innerHTML = '';
        }
    },

    async loadTrending() {
        const grid = document.getElementById('trending-grid');
        try {
            const data = await window.AnimeAPI.getTrending();
            this._lastTrendingData = data;
            data.forEach(anime => grid.appendChild(window.UI.createAnimeCard(anime)));
        } catch (e) {
            grid.innerHTML = '<p>Could not load trending anime.</p>';
        }
    },

    unmountPage() {
        // Snapshot the live page so Back returns here without re-fetching and
        // without dropping the mood / pagination / scroll position.
        this._snapshot = {
            mood: window.APP_STATE.currentMood,
            page: this.currentPage,
            totalPages: this.totalPages,
            mainData: this._lastMainData,
            curatedData: this._lastCuratedData,
            trendingData: this._lastTrendingData,
            scrollY: window.scrollY
        };
        this.isLoading = false;
    }
};
