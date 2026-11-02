window.Search = {
    currentPage: 1,
    totalPages: 1,
    currentQuery: '',
    currentGenres: '',
    // In-session snapshots keep Back from wiping the query box/grid
    _snapshot: null,
    _lastResultsData: null,
    _lastTrendingData: null,
    _lastSeasonalData: null,

    renderPage() {
        return `
            <div class="search-page container">
                <div class="search-bar-container">
                    <input type="text" id="search-input" placeholder="Search anime by title..." autocomplete="off"/>
                </div>

                <div class="filter-row">
                    <select id="filter-mood">
                        <option value="">Filter by Mood</option>
                        ${window.MoodMapping.getAllMoods().map(m => `<option value="${m}">${window.MoodMapping.MOOD_CONFIG[m].label}</option>`).join('')}
                    </select>
                </div>

                <div id="search-results-container">
                    <div id="default-views">
                        <h3>Trending Anime</h3>
                        <div id="search-trending" class="anime-grid horizontal-scroll"></div>
                        <h3 style="margin-top:30px">Seasonal Anime</h3>
                        <div id="search-seasonal" class="anime-grid horizontal-scroll"></div>
                    </div>

                    <div id="search-results" style="display:none;">
                        <h3>Results</h3>
                        <div id="results-grid" class="anime-grid"></div>
                        <div id="pagination-container"></div>
                    </div>
                </div>
            </div>
        `;
    },

    async mountPage() {
        const input = document.getElementById('search-input');
        const moodFilter = document.getElementById('filter-mood');

        // Back button: restore the last in-session search instead of resetting
        // the query box and results grid.
        if (this._snapshot) {
            const s = this._snapshot;
            this.currentQuery = s.query;
            this.currentGenres = s.genres;
            this.currentPage = s.page || 1;
            this.totalPages = s.totalPages || 1;
            this._lastTrendingData = s.trendingData;
            this._lastSeasonalData = s.seasonalData;
            this._lastResultsData = s.resultsData;
            input.value = s.query;
            if (moodFilter) moodFilter.value = s.moodFilter || '';

            this.renderDefaultsFromCache();
            if (s.query || s.genres) {
                document.getElementById('default-views').style.display = 'none';
                document.getElementById('search-results').style.display = 'block';
                const grid = document.getElementById('results-grid');
                grid.innerHTML = '';
                if (s.resultsData && s.resultsData.length) {
                    s.resultsData.forEach(anime => grid.appendChild(window.UI.createAnimeCard(anime)));
                    this._renderResultsPagination();
                } else {
                    grid.innerHTML = '<p>No results found.</p>';
                }
            }
            if (s.scrollY) requestAnimationFrame(() => window.scrollTo(0, s.scrollY));
            this._snapshot = null;
            this.wireSearch(input, moodFilter);
            return;
        }

        // Load defaults
        this.loadDefaults();

        this.wireSearch(input, moodFilter);
    },

    wireSearch(input, moodFilter) {
        const goToPage = async (page) => {
            this.currentPage = page;
            await this.doSearch(page);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        };

        this._goToPage = goToPage;

        input.addEventListener('input', window.UI.debounce(() => {
            this.currentQuery = input.value.trim();
            goToPage(1);
        }, 500));

        moodFilter.addEventListener('change', () => {
            const mood = moodFilter.value;
            this.currentGenres = mood ? window.MoodMapping.getGenresForMood(mood) : '';
            goToPage(1);
        });
    },

    renderDefaultsFromCache() {
        const tGrid = document.getElementById('search-trending');
        const sGrid = document.getElementById('search-seasonal');
        if (tGrid) (this._lastTrendingData || []).forEach(a => tGrid.appendChild(window.UI.createAnimeCard(a)));
        if (sGrid) (this._lastSeasonalData || []).forEach(a => sGrid.appendChild(window.UI.createAnimeCard(a)));
    },

    _renderResultsPagination() {
        const paginationContainer = document.getElementById('pagination-container');
        if (!paginationContainer) return;
        paginationContainer.innerHTML = '';
        if (this.totalPages > 1) {
            paginationContainer.appendChild(window.UI.createPagination({
                currentPage: this.currentPage,
                totalPages: Math.min(this.totalPages, 50),
                onPageChange: (p) => this._goToPage(p)
            }));
        }
    },

    async doSearch(page = 1) {
        if (!this.currentQuery && !this.currentGenres) {
            document.getElementById('default-views').style.display = 'block';
            document.getElementById('search-results').style.display = 'none';
            return;
        }

        document.getElementById('default-views').style.display = 'none';
        document.getElementById('search-results').style.display = 'block';

        const grid = document.getElementById('results-grid');
        const paginationContainer = document.getElementById('pagination-container');
        grid.innerHTML = '';
        paginationContainer.innerHTML = '';
        window.UI.createSkeletonCards(10).forEach(c => grid.appendChild(c));

        try {
            const res = await window.AnimeAPI.search(this.currentQuery, this.currentGenres, page);
            grid.innerHTML = '';

            if (res.data && res.data.length > 0) {
                this._lastResultsData = res.data;
                res.data.forEach(anime => grid.appendChild(window.UI.createAnimeCard(anime)));
                this.totalPages = res.pagination?.last_visible_page || 1;
                this.currentPage = res.pagination?.current_page || page;
                this._renderResultsPagination();
            } else {
                this._lastResultsData = [];
                grid.innerHTML = '<p>No results found.</p>';
            }
        } catch (e) {
            grid.innerHTML = '<p>Search failed. Please try again.</p>';
        }
    },

    async loadDefaults() {
        try {
            const [trendingRes, seasonalRes] = await Promise.allSettled([
                window.AnimeAPI.getTrending(),
                window.AnimeAPI.getSeasonal()
            ]);

            const tGrid = document.getElementById('search-trending');
            const sGrid = document.getElementById('search-seasonal');

            if (trendingRes.status === 'fulfilled' && Array.isArray(trendingRes.value)) {
                this._lastTrendingData = trendingRes.value;
                trendingRes.value.forEach(a => tGrid.appendChild(window.UI.createAnimeCard(a)));
            }
            if (seasonalRes.status === 'fulfilled' && Array.isArray(seasonalRes.value)) {
                this._lastSeasonalData = seasonalRes.value;
                seasonalRes.value.forEach(a => sGrid.appendChild(window.UI.createAnimeCard(a)));
            }
        } catch (e) {}
    },

    unmountPage() {
        const input = document.getElementById('search-input');
        const moodFilter = document.getElementById('filter-mood');
        this._snapshot = {
            query: this.currentQuery,
            genres: this.currentGenres,
            moodFilter: moodFilter ? moodFilter.value : '',
            page: this.currentPage,
            totalPages: this.totalPages,
            resultsData: this._lastResultsData,
            trendingData: this._lastTrendingData,
            seasonalData: this._lastSeasonalData,
            scrollY: window.scrollY
        };
    }
};
