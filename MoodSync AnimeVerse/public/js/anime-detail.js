window.AnimeDetail = {
    renderPage(animeId) {
        return `
            <div class="anime-detail-page container">
                <button class="btn-back" onclick="history.back()">← Back</button>
                <div id="detail-content" class="detail-card">
                    <div class="detail-banner"></div>
                    <div class="detail-body">
                        <aside class="detail-sidebar">
                            <div class="skeleton-img" style="height:320px; border-radius: var(--radius-lg);"></div>
                            <div class="skeleton-text" style="height:44px;"></div>
                            <div class="skeleton-text" style="height:44px;"></div>
                        </aside>
                        <div class="detail-main">
                            <div class="skeleton-text" style="height:42px; width:70%; margin-bottom:20px;"></div>
                            <div class="skeleton-text"></div>
                            <div class="skeleton-text"></div>
                            <div class="skeleton-text short"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    },

    async mountPage(animeId) {
        try {
            const anime = await window.AnimeAPI.getDetail(animeId);
            const content = document.getElementById('detail-content');

            const title = window.UI.sanitize(anime.title_english || anime.title);
            const syn = window.UI.sanitize(anime.synopsis || 'No synopsis available.');
            const img = window.UI.sanitize((anime.images && anime.images.jpg && anime.images.jpg.large_image_url) || '');
            // Banner slot only takes a genuine widescreen banner. Stretching the
            // portrait cover up to fill it looks pixelated/blurry, so when there
            // is no real banner we leave the gradient placeholder instead.
            const banner = window.UI.sanitize(anime.banner_image || '');

            // Watch links go to miruro.to (keyed by AniList id):
            //   https://www.miruro.to/watch/{anilistId}/{title-slug}
            const watchUrl = this.miruroWatchUrl(anime.title_english || anime.title, anime.id);
            const searchUrl = `https://www.miruro.to/search?query=${encodeURIComponent(anime.title)}`;
            const watchLabel = '▶ Watch Now on Miruro';
            const searchLabel = 'Search on Miruro';

            // Genres — staggered pill entrance
            const genres = anime.genres && anime.genres.length
                ? anime.genres.map((g, i) =>
                    `<span class="genre-tag" style="animation-delay:${120 + i * 60}ms">${window.UI.sanitize(g.name)}</span>`
                  ).join('')
                : '';

            // Status pill with live "airing" pulse
            const statusClass = this.statusClass(anime.status);
            const statusPill = anime.status
                ? `<span class="detail-status-pill ${statusClass}"><i></i>${window.UI.sanitize(anime.status)}</span>`
                : '';

            // Tagline: Type · Season Year · Studio
            const seasonLabel = anime.season
                ? anime.season.charAt(0).toUpperCase() + anime.season.slice(1)
                : '';
            const taglineBits = [anime.type, seasonLabel ? `${seasonLabel} ${anime.year || ''}`.trim() : '', anime.studio]
                .filter(Boolean)
                .map(bit => `<span>${window.UI.sanitize(String(bit))}</span><span class="dot-sep"></span>`)
                .join('');

            // Information tiles (skip empty values)
            const stats = [
                ['Score', window.UI.formatScore(anime.score)],
                ['Type', anime.type || 'N/A'],
                ['Episodes', window.UI.formatEpisodes(anime.episodes)],
                anime.duration ? ['Duration', `${anime.duration} min`] : null,
                ['Status', anime.status || 'N/A'],
                seasonLabel ? ['Season', `${seasonLabel} ${anime.year || ''}`.trim()] : null,
                ['Age Rating', anime.rating || 'N/A'],
                anime.studio ? ['Studio', anime.studio] : null
            ].filter(Boolean)
             .map(([label, value]) => `
                <div class="meta-item">
                    <span class="meta-label">${label}</span>
                    <span class="meta-value">${window.UI.sanitize(String(value))}</span>
                </div>`).join('');

            const trailerLink = anime.trailer
                ? `<a href="${window.UI.sanitize(anime.trailer)}" target="_blank" rel="noopener" class="detail-trailer-link">▶ Watch Trailer</a>`
                : '';

            content.innerHTML = `
                <div class="detail-banner"${banner ? ` style="background-image:url('${banner}')"` : ''}>${statusPill}</div>
                <div class="detail-body">
                    <aside class="detail-sidebar">
                        <figure class="detail-poster-wrap">
                            <img src="${img}" alt="${title}" class="detail-poster" />
                            ${anime.score ? `
                            <figcaption class="detail-score-badge">
                                <b>${parseFloat(anime.score).toFixed(1)}</b>
                                <small>/ 10</small>
                            </figcaption>` : ''}
                        </figure>
                        <div class="detail-actions">
                            <a id="btn-watch-primary" href="${window.UI.sanitize(watchUrl)}" target="_blank" rel="noopener" class="btn-primary">${watchLabel}</a>
                            <a href="${window.UI.sanitize(searchUrl)}" target="_blank" rel="noopener" class="btn-secondary">${searchLabel}</a>
                            <div class="icon-actions">
                                <button id="btn-fav" class="btn-secondary" title="Add to Favorites">${this.favLabel(anime.id)}</button>
                                <button id="btn-watchlater" class="btn-secondary" title="Watch Later">${this.wlLabel(anime.id)}</button>
                            </div>
                        </div>
                    </aside>
                    <div class="detail-main">
                        <h1 class="detail-title">${title}</h1>
                        ${taglineBits ? `<p class="detail-tagline">${taglineBits}</p>` : ''}
                        ${genres ? `<div class="detail-genres">${genres}</div>` : ''}
                        <section class="detail-section detail-synopsis">
                            <h3>Synopsis</h3>
                            <p>${syn}</p>
                            ${trailerLink}
                        </section>
                        ${stats ? `
                        <section class="detail-section">
                            <h3>Information</h3>
                            <div class="detail-meta-grid">${stats}</div>
                        </section>` : ''}
                    </div>
                </div>
            `;

            this.setupActions(anime);
        } catch (error) {
            document.getElementById('detail-content').innerHTML =
                `<div class="detail-body"><p class="detail-error">Error loading anime details.</p></div>`;
        }
    },

    statusClass(status) {
        const s = String(status || '').toLowerCase();
        if (s.includes('currently')) return 'is-airing';
        if (s.includes('finished')) return 'is-finished';
        if (s.includes('not yet')) return 'is-upcoming';
        return '';
    },

    // Miruro watch URLs are keyed by the AniList id:
    //   https://www.miruro.to/watch/21/one-piece
    // The title slug is cosmetic (SEO) — lowercase words joined by hyphens.
    miruroWatchUrl(title, animeId) {
        if (!title || !animeId) return 'https://www.miruro.to/search?query=' + encodeURIComponent(title || '');
        const slug = String(title)
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
        return `https://www.miruro.to/watch/${animeId}/${slug}`;
    },

    favLabel(animeId) {
        return window.UserStore.isFavorite(animeId) ? '❤️ Favorited' : '🤍 Favorite';
    },

    wlLabel(animeId) {
        return window.UserStore.inWatchLater(animeId) ? '🔖 Saved' : '🔖 Save';
    },

    setupActions(anime) {
        const btnFav = document.getElementById('btn-fav');
        const btnWl = document.getElementById('btn-watchlater');

        const itemData = () => ({
            animeId: anime.id,
            title: anime.title_english || anime.title,
            imageUrl: anime.images.jpg.large_image_url,
            score: anime.score
        });

        btnFav.onclick = () => {
            const added = window.UserStore.toggleFavorite(itemData());
            btnFav.innerHTML = this.favLabel(anime.id);
            window.UI.showToast(added ? 'Added to favorites!' : 'Removed from favorites', added ? 'success' : 'info');
        };

        btnWl.onclick = () => {
            const added = window.UserStore.toggleWatchLater(itemData());
            btnWl.innerHTML = this.wlLabel(anime.id);
            window.UI.showToast(added ? 'Saved for later!' : 'Removed from watch later', added ? 'success' : 'info');
        };
    },

    unmountPage() {}
};
