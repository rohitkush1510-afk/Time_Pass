window.Profile = {
    pageSize: 8,

    renderPage() {
        return `
            <div class="profile-page container">
                <div id="profile-header" class="profile-header">
                    <div class="profile-avatar" id="prof-avatar">👤</div>
                    <div class="profile-info">
                        <h2 id="prof-name">Your Profile</h2>
                        <p id="prof-email">All your data is stored locally on this device.</p>
                    </div>
                </div>

                <div class="profile-stats" id="profile-stats"></div>

                <div class="profile-tabs">
                    <button class="profile-tab active" data-target="tab-history">Mood History</button>
                    <button class="profile-tab" data-target="tab-favorites">Favorites</button>
                    <button class="profile-tab" data-target="tab-watchlater">Watch Later</button>
                </div>

                <div class="tab-content active" id="tab-history">
                    <div id="mood-history-list" class="list-container">Loading...</div>
                    <div id="history-pagination"></div>
                </div>

                <div class="tab-content" id="tab-favorites">
                    <div id="favorites-grid" class="anime-grid">Loading...</div>
                    <div id="favorites-pagination"></div>
                </div>

                <div class="tab-content" id="tab-watchlater">
                    <div id="watchlater-grid" class="anime-grid">Loading...</div>
                    <div id="watchlater-pagination"></div>
                </div>
            </div>
        `;
    },

    async mountPage() {
        // Tabs setup
        document.querySelectorAll('.profile-tabs button').forEach(btn => {
            btn.onclick = (e) => {
                document.querySelectorAll('.profile-tabs button').forEach(b => b.classList.remove('active'));
                document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));

                e.target.classList.add('active');
                document.getElementById(e.target.dataset.target).classList.add('active');
            };
        });

        this.renderStats();
        this.renderMoodHistory(1);
        this.renderList('favorites', 'favorites-grid', 'favorites-pagination', 1);
        this.renderList('watchLater', 'watchlater-grid', 'watchlater-pagination', 1);
    },

    renderStats() {
        const statsEl = document.getElementById('profile-stats');
        const moods = window.UserStore.getMoodHistory(1000);
        const favs = window.UserStore.getFavorites();
        const wl = window.UserStore.getWatchLater();

        const moodCounts = {};
        moods.forEach(m => { moodCounts[m.mood] = (moodCounts[m.mood] || 0) + 1; });
        const topMood = Object.keys(moodCounts).sort((a, b) => moodCounts[b] - moodCounts[a])[0];

        statsEl.innerHTML = `
            <div class="stat-card"><span class="stat-value">${moods.length}</span><span class="stat-label">Mood Scans</span></div>
            <div class="stat-card"><span class="stat-value">${topMood ? window.MoodMapping.getMoodEmoji(topMood) + ' ' + topMood : '—'}</span><span class="stat-label">Top Mood</span></div>
            <div class="stat-card"><span class="stat-value">${favs.length}</span><span class="stat-label">Favorites</span></div>
            <div class="stat-card"><span class="stat-value">${wl.length}</span><span class="stat-label">Watch Later</span></div>
        `;
    },

    renderMoodHistory(page) {
        const list = document.getElementById('mood-history-list');
        const paginationContainer = document.getElementById('history-pagination');
        const all = window.UserStore.getMoodHistory(1000);

        if (all.length === 0) {
            list.innerHTML = '<p>No mood history yet. Go scan your mood!</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(all.length / this.pageSize);
        const start = (page - 1) * this.pageSize;
        const slice = all.slice(start, start + this.pageSize);

        list.innerHTML = '';
        slice.forEach(data => {
            const mConf = window.MoodMapping.MOOD_CONFIG[data.mood];
            const dateStr = data.detectedAt ? window.UI.timeAgo(data.detectedAt) : 'Recently';

            const item = document.createElement('div');
            item.className = 'history-item';
            item.innerHTML = `
                <div class="history-emoji">${mConf ? mConf.emoji : '😐'}</div>
                <div class="history-details">
                    <b>${window.UI.sanitize(data.mood)}</b> (${Math.round((data.confidence || 0) * 100)}%) via ${window.UI.sanitize(data.method)}
                    <br><small>${dateStr}</small>
                </div>
            `;
            list.appendChild(item);
        });

        paginationContainer.innerHTML = '';
        if (totalPages > 1) {
            paginationContainer.appendChild(window.UI.createPagination({
                currentPage: page,
                totalPages,
                onPageChange: (p) => this.renderMoodHistory(p)
            }));
        }
    },

    renderList(collectionName, containerId, paginationId, page) {
        const grid = document.getElementById(containerId);
        const paginationContainer = document.getElementById(paginationId);
        const all = collectionName === 'favorites' ? window.UserStore.getFavorites() : window.UserStore.getWatchLater();

        if (all.length === 0) {
            grid.innerHTML = '<p>No items saved here yet.</p>';
            paginationContainer.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(all.length / this.pageSize);
        const start = (page - 1) * this.pageSize;
        const slice = all.slice(start, start + this.pageSize);

        grid.innerHTML = '';
        slice.forEach(data => {
            const card = document.createElement('div');
            card.className = 'anime-card';
            card.onclick = () => window.navigateTo(`#/anime/${data.animeId}`);
            card.innerHTML = `
                <div class="anime-card-img" style="background-image: url('${window.UI.sanitize(data.imageUrl)}')"></div>
                <div class="anime-card-body">
                    <h4 title="${window.UI.sanitize(data.title)}">${window.UI.sanitize(data.title)}</h4>
                    <button class="btn-remove" data-id="${data.animeId}">✕ Remove</button>
                </div>
            `;
            card.querySelector('.btn-remove').onclick = (e) => {
                e.stopPropagation();
                if (collectionName === 'favorites') {
                    window.UserStore.removeFavorite(data.animeId);
                } else {
                    window.UserStore.removeWatchLater(data.animeId);
                }
                window.UI.showToast('Removed', 'info');
                this.renderStats();
                this.renderList(collectionName, containerId, paginationId, page);
            };
            grid.appendChild(card);
        });

        paginationContainer.innerHTML = '';
        if (totalPages > 1) {
            paginationContainer.appendChild(window.UI.createPagination({
                currentPage: page,
                totalPages,
                onPageChange: (p) => this.renderList(collectionName, containerId, paginationId, p)
            }));
        }
    },

    unmountPage() {}
};
