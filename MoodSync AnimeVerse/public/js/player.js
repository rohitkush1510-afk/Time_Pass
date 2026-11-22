window.Player = {
    hls: null,
    episodes: [],

    renderPage(animeId) {
        return `
            <div class="player-page container">
                <button class="btn-back" onclick="history.back()">← Back</button>

                <div id="player-wrapper" class="player-wrapper">
                    <video id="player-video" controls playsinline></video>
                    <div id="player-overlay" class="player-overlay">
                        <div class="loader-spinner"></div>
                        <p id="overlay-text">Loading stream...</p>
                    </div>
                </div>
                <div id="quality-row" class="quality-row"></div>

                <div id="player-info" class="player-info">
                    <h2 id="player-title">Loading...</h2>
                    <p id="player-synopsis"></p>
                    <a id="cr-link" href="#" target="_blank" rel="noopener" class="btn btn-primary" style="display:none; width:fit-content; margin-bottom:20px;">Watch Full Episodes on Miruro</a>
                </div>

                <section id="episodes-section" style="display:none;">
                    <h3>Episodes <span id="episode-count" class="text-muted"></span></h3>
                    <div id="episode-list" class="episode-list"></div>
                </section>

                <div class="feedback-section">
                    <h3>Did you enjoy this?</h3>
                    <div class="feedback-btns">
                        <button id="btn-up" class="btn btn-primary">👍 Yes</button>
                        <button id="btn-down" class="btn btn-secondary">👎 No</button>
                    </div>
                </div>
            </div>
        `;
    },

    async mountPage(animeId) {
        try {
            const [anime, episodesRes] = await Promise.allSettled([
                window.AnimeAPI.getDetail(animeId),
                window.AnimeAPI.getEpisodes(animeId)
            ]);

            if (anime.status !== 'fulfilled') throw new Error('Failed to load details');
            this.animeData = anime.value;
            this.episodes = episodesRes.status === 'fulfilled' ? (episodesRes.value || []) : [];

            const titleEl = document.getElementById('player-title');
            const synEl = document.getElementById('player-synopsis');
            const crLink = document.getElementById('cr-link');

            titleEl.innerText = this.animeData.title_english || this.animeData.title;
            const synFull = this.animeData.synopsis || 'No synopsis available.';
            synEl.innerText = synFull.length > 300 ? synFull.substring(0, 300).trimEnd() + '...' : synFull;

            // Title opens on miruro.to.
            crLink.href = window.AnimeDetail.miruroWatchUrl(
                this.animeData.title_english || this.animeData.title,
                this.animeData.id
            );
            crLink.innerText = 'Watch Full Episodes on Miruro';
            crLink.style.display = 'inline-block';

            this.setupFeedback(this.animeData);

            // Streaming mode when we have an episode list
            if (this.episodes.length > 0) {
                this.renderEpisodeList();
                this.playEpisode(this.episodes[0]);
            } else {
                this.showOverlay('No stream available for this title right now.');
            }
        } catch (e) {
            console.error('Player failed to mount:', e);
            this.showOverlay('Failed to load player data. Please try again later.');
            window.UI.showToast('Failed to load player data', 'error');
        }
    },

    renderEpisodeList() {
        const section = document.getElementById('episodes-section');
        const list = document.getElementById('episode-list');
        const count = document.getElementById('episode-count');
        if (!section || !list) return;

        section.style.display = 'block';
        count.textContent = `(${this.episodes.length})`;

        list.innerHTML = '';
        this.episodes.forEach(ep => {
            const btn = document.createElement('button');
            btn.className = 'episode-btn';
            btn.dataset.episode = ep.id;
            btn.innerHTML = `<span class="ep-num">${ep.number}</span><span class="ep-title">${window.UI.sanitize(String(ep.title || ''))}</span>${ep.isFiller ? '<span class="ep-filler">Filler</span>' : ''}`;
            btn.onclick = () => this.playEpisode(ep);
            list.appendChild(btn);
        });
    },

    markActiveEpisode(episodeId) {
        document.querySelectorAll('.episode-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.episode === String(episodeId));
        });
    },

    showOverlay(text) {
        const overlay = document.getElementById('player-overlay');
        const textEl = document.getElementById('overlay-text');
        if (!overlay) return;
        if (textEl && text) textEl.innerText = text;
        overlay.style.display = 'flex';
    },

    hideOverlay() {
        const overlay = document.getElementById('player-overlay');
        if (overlay) overlay.style.display = 'none';
    },

    destroyEngine() {
        if (this.hls) { this.hls.destroy(); this.hls = null; }
        const video = document.getElementById('player-video');
        if (video) {
            video.removeAttribute('src');
            try { video.load(); } catch (e) {}
        }
    },

    async playEpisode(ep) {
        if (!ep || !ep.id) return;
        this.markActiveEpisode(ep.id);

        const video = document.getElementById('player-video');
        const qualityRow = document.getElementById('quality-row');
        this.destroyEngine();
        qualityRow.innerHTML = '';
        this.showOverlay(`Loading episode ${ep.number}...`);

        try {
            const res = await window.AnimeAPI.getSources(ep.id);
            const sources = res.sources || [];
            if (sources.length === 0) throw new Error('No sources returned');

            const hlsSources = sources.filter(s => s.isM3U8);
            const primary = hlsSources.find(s => s.quality === 'auto') || hlsSources[0] || sources[0];

            const renderQualityButtons = () => {
                qualityRow.innerHTML = '';
                [...sources].sort((a, b) => this.qualityRank(b.quality) - this.qualityRank(a.quality)).forEach(s => {
                    const btn = document.createElement('button');
                    btn.className = 'quality-btn' + (s === primary ? ' active' : '');
                    btn.textContent = s.quality;
                    btn.onclick = () => this.attachSource(s);
                    qualityRow.appendChild(btn);
                });
            };

            renderQualityButtons();
            this.attachSource(primary);
        } catch (err) {
            console.error('Stream failed:', err);
            this.showOverlay('Stream unavailable for this episode. Try another one, or use the Miruro link below.');
        }
    },

    attachSource(source) {
        const video = document.getElementById('player-video');
        if (!video || !source) return;

        document.querySelectorAll('.quality-btn').forEach(b =>
            b.classList.toggle('active', b.textContent.trim() === String(source.quality)));

        if (source.isM3U8) {
            if (window.Hls && window.Hls.isSupported()) {
                this.destroyEngine();
                this.hls = new Hls({ maxBufferLength: 30 });
                this.hls.loadSource(source.url);
                this.hls.attachMedia(video);
                this.hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    this.hideOverlay();
                    video.play().catch(() => {});
                });
                this.hls.on(Hls.Events.ERROR, (_evt, data) => {
                    if (data.fatal) {
                        console.error('HLS fatal error:', data.type, data.details);
                        this.showOverlay('Stream unavailable. The source may be offline — try another episode or quality.');
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari native HLS
                video.src = source.url;
                video.addEventListener('loadedmetadata', () => this.hideOverlay(), { once: true });
                video.play().catch(() => {});
            } else {
                this.showOverlay('Your browser cannot play this stream format.');
            }
        } else {
            video.src = source.url;
            video.addEventListener('loadedmetadata', () => this.hideOverlay(), { once: true });
            video.play().catch(() => {});
        }
    },

    qualityRank(q) {
        const n = parseInt(q, 10);
        return Number.isNaN(n) ? -1 : n;
    },

    setupFeedback(anime) {
        const handleFeedback = (isPositive) => {
            window.UserStore.addWatchHistory({
                animeId: anime.id,
                title: anime.title_english || anime.title,
                mood: window.APP_STATE.currentMood || 'unknown',
                feedback: isPositive ? 'positive' : 'negative'
            });
            window.UI.showToast(isPositive ? 'Glad you liked it!' : 'We will recommend something better next time.', 'success');
        };

        document.getElementById('btn-up').onclick = () => handleFeedback(true);
        document.getElementById('btn-down').onclick = () => handleFeedback(false);
    },

    unmountPage() {
        this.destroyEngine();
        this.animeData = null;
        this.episodes = [];
        const wrapper = document.getElementById('player-wrapper');
        if (wrapper) wrapper.innerHTML = ''; // Stop everything
    }
};
