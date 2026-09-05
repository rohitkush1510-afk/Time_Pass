window.App = {
    init() {
        window.APP_STATE = { currentMood: null, moodConfidence: null };
        window.navigateTo = (hash) => { location.hash = hash; };

        // Theme toggle (dark/light) — persisted in localStorage
        this.setupTheme();

        // Router setup
        window.addEventListener('hashchange', () => this.handleRoute());
        window.addEventListener('DOMContentLoaded', () => {
            this.setupNav();
            this.handleRoute();
            // Preload models in background
            setTimeout(() => { if (window.MoodScanner) window.MoodScanner.loadModels(); }, 2000);
        });
    },

    setupTheme() {
        const btn = document.getElementById('theme-toggle');
        if (!btn) return;

        const apply = (theme) => document.documentElement.setAttribute('data-theme', theme);

        btn.onclick = () => {
            const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            localStorage.setItem('theme', next);
            apply(next);
        };
    },

    setupNav() {
        const hamburger = document.getElementById('nav-hamburger');
        const menuPanel = document.getElementById('mobile-nav');

        if (hamburger && menuPanel) {
            hamburger.onclick = (e) => {
                e.stopPropagation();
                const isOpen = !menuPanel.classList.contains('open');
                menuPanel.classList.toggle('open', isOpen);
                hamburger.classList.toggle('open', isOpen);
                hamburger.setAttribute('aria-label', isOpen ? 'Close menu' : 'Open menu');
            };

            menuPanel.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => this.closeMenu(hamburger, menuPanel));
            });

            document.addEventListener('click', (e) => {
                if (!menuPanel.contains(e.target) && !hamburger.contains(e.target)) {
                    this.closeMenu(hamburger, menuPanel);
                }
            });
        }
    },

    closeMenu(hamburger, menuPanel) {
        if (!menuPanel || !hamburger) return;
        menuPanel.classList.remove('open');
        hamburger.classList.remove('open');
        hamburger.setAttribute('aria-label', 'Open menu');
    },

    async handleRoute() {
        const hash = location.hash || '#/';
        const appDiv = document.getElementById('app');

        // Unmount previous if exists
        if (this.currentModule && this.currentModule.unmountPage) {
            this.currentModule.unmountPage();
        }

        let path = hash.replace('#/', '');
        let param = null;

        if (path.includes('/')) {
            const parts = path.split('/');
            path = parts[0];
            param = parts[1];
        }

        // Routing map
        const routes = {
            '': { render: this.renderHome.bind(this), mount: this.mountHome.bind(this), unmountPage: () => this.unmountPage() },
            'scan': window.MoodScanner,
            'recommendations': window.Recommendations,
            'anime': window.AnimeDetail,
            'player': window.Player,
            'search': window.Search,
            'profile': window.Profile
        };

        const module = routes[path] || routes[''];
        this.currentModule = module;

        appDiv.innerHTML = module.renderPage ? module.renderPage(param) : module.render();
        window.scrollTo(0, 0);

        if (module.mountPage) {
            await module.mountPage(param);
        } else if (module.mount) {
            await module.mount(param);
        }

        this.updateActiveNav(path);
    },

    updateActiveNav(path) {
        document.querySelectorAll('.nav-link[data-page]').forEach(link => {
            link.classList.toggle('active', link.dataset.page === path || (path === '' && link.dataset.page === 'home'));
        });
    },

    pickMood(mood) {
        window.APP_STATE.currentMood = mood;
        window.APP_STATE.moodConfidence = null;
        // A freshly picked mood should load new recommendations, not restore a
        // stale cache of the same mood from a previous visit.
        if (window.Recommendations) window.Recommendations.clearCache();
        window.navigateTo('#/recommendations');
    },

    renderHome() {
        const state = window.APP_STATE;
        const mood = state.currentMood ? window.MoodMapping.MOOD_CONFIG[state.currentMood] : null;

        // Scanner mock readout — real scan results when present, demo otherwise
        const glyph = mood ? mood.emoji : '^_^';
        const moodLabel = mood ? mood.label : 'Calm';
        const confidencePct = state.moodConfidence ? Math.round(state.moodConfidence * 100) : 91;

        // Picks header adapts to whether a scan exists yet
        const picksTitle = mood
            ? `Because you're feeling <span class="mood-chip">${mood.label}</span>`
            : 'Top picks <span class="grad">while you decide</span>';
        const picksSub = mood
            ? 'Fresh picks, refreshed every scan.'
            : 'Seasonal standouts — or scan your mood for a personal match.';
        const picksBtn = mood ? 'Not feeling it? Rescan' : '&#127909; Scan my mood';

        const moodOrder = ['happy', 'sad', 'angry', 'surprised', 'neutral', 'naughty'];
        const moodTiles = moodOrder.map(key => {
            const m = window.MoodMapping.MOOD_CONFIG[key];
            return `
                <button class="mood-tile" data-mood="${key}" style="--mc:${m.color}">
                    <span class="emo">${m.emoji}</span>${m.label}
                    <small>${m.genreNames}</small>
                </button>`;
        }).join('');

        return `
            <div class="home-page">
                <!-- ================= HERO (showcase stage) ================= -->
                <section class="home-hero">
                    <div class="hero-stage">
                        <div class="hero-big-text creator-text-animate"><h2>Moods</h2></div>

                        <div class="hero-base-img hero-image-animate"></div>

                        <div class="hero-reveal-img" id="reveal-layer" aria-hidden="true"></div>

                        <div class="hero-content">
                            <div class="hero-content-inner">
                                <p class="hero-eyebrow">Real-time mood matching</p>
                                <h1 class="hero-headline" id="headline"></h1>
                                <div class="cta-row">
                                    <button class="cta-btn cta-animate" onclick="window.navigateTo('#/scan')">
                                        <span class="cta-btn-bg"></span>
                                        <span class="cta-btn-text">Scan my mood now</span>
                                        <span class="cta-btn-circle">
                                            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M5 13L13 5M13 5H6M13 5V12" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                                        </span>
                                    </button>
                                </div>
                                <a class="hero-alt-link cta-animate" href="#/search" style="animation-delay:1.35s;">or browse without scanning &rarr;</a>
                            </div>
                        </div>
                    </div>

                    <!-- Scanner mock -->
                    <div class="hero-visual" aria-hidden="true">
                        <div class="scanner-mock">
                            <div class="scan-ring"></div>
                            <div class="scan-frame">
                                <span class="scan-corner tl"></span><span class="scan-corner tr"></span>
                                <span class="scan-corner bl"></span><span class="scan-corner br"></span>
                                <div class="scan-line"></div>
                                <div class="face-glyph" id="hero-face-glyph">${glyph}</div>
                            </div>
                            <div class="scan-readout">
                                <div class="readout-row">
                                    <span class="readout-dot"></span>
                                    <span class="readout-label">Detected mood</span>
                                    <span class="readout-value" id="hero-readout-value">${moodLabel}</span>
                                </div>
                                <div class="meter"><span id="hero-meter" style="width:${confidencePct}%"></span></div>
                                <p class="readout-foot" id="hero-readout-foot">Confidence ${confidencePct}% · processed on device</p>
                            </div>
                        </div>
                    </div>
                </section>

                <!-- ================= MOOD PALETTE ================= -->
                <section class="container" id="home-moods">
                    <div class="home-section-head">
                        <h2>Pick a mood, or let the camera do it</h2>
                        <p>Nine detected states, each mapped to genre, pacing and tone.</p>
                    </div>
                    <div class="mood-palette">${moodTiles}</div>
                </section>

                <!-- ================= PICKS ================= -->
                <section class="container" id="home-picks-section">
                    <div class="home-section-head row">
                        <div>
                            <h2>${picksTitle}</h2>
                            <p id="picks-subtitle">${picksSub}</p>
                        </div>
                        <button class="btn btn-sm" onclick="window.navigateTo('#/scan')">${picksBtn}</button>
                    </div>
                    <div id="home-picks" class="anime-grid"></div>
                </section>

                <!-- ================= HOW IT WORKS ================= -->
                <section class="home-band" id="home-how">
                    <div class="home-section-head">
                        <h2>Three taps to playback</h2>
                    </div>
                    <ol class="steps-row">
                        <li class="step-tile"><span class="step-num">1</span><h3>Allow the camera</h3><p>One-time consent. Frames never leave your device — detection runs locally.</p></li>
                        <li class="step-tile"><span class="step-num">2</span><h3>One-second scan</h3><p>Your expression becomes a mood label with a confidence score you can see.</p></li>
                        <li class="step-tile"><span class="step-num">3</span><h3>Press play</h3><p>Recommendations stream in the built-in player. Rate them to sharpen the next batch.</p></li>
                    </ol>
                </section>

                <!-- ================= TRENDING ================= -->
                <section class="container" id="home-trending-section">
                    <div class="home-section-head row">
                        <h2>Trending this season</h2>
                        <a class="link-more" href="#/search">See all</a>
                    </div>
                    <div id="home-trending" class="anime-grid horizontal-scroll"></div>
                </section>

                <!-- ================= PRIVACY ================= -->
                <section class="container">
                    <div class="privacy-panel">
                        <h2>Your face stays yours</h2>
                        <p>
                            Detection runs entirely on your machine. No biometric templates, no image uploads,
                            no facial data at rest — only the mood label, and only if you consent,
                            with a one-tap way to wipe your mood history.
                        </p>
                        <div class="pill-row">
                            <span class="privacy-pill">On-device processing</span>
                            <span class="privacy-pill">Explicit camera consent</span>
                            <span class="privacy-pill">Delete history anytime</span>
                            <span class="privacy-pill">No biometric storage</span>
                        </div>
                    </div>
                </section>
            </div>
        `;
    },

    async mountHome() {
        const state = window.APP_STATE;
        const mood = state.currentMood;

        // Word-by-word blur-in headline (showcase style)
        const headline = document.getElementById('headline');
        if (headline) {
            const text = 'We read your expression & stream anime that matches your vibe.';
            headline.innerHTML = '';
            text.split(' ').forEach((word, i) => {
                const span = document.createElement('span');
                span.className = 'word-reveal';
                span.textContent = word;
                span.style.animationDelay = (1 + i * 0.05) + 's';
                headline.appendChild(span);
            });
        }

        // Spotlight reveal — mouse-following mask over the trending collage
        this.setupSpotlight();

        // Reflect a real scan in the hero readout
        if (mood) {
            const cfg = window.MoodMapping.MOOD_CONFIG[mood];
            const pct = state.moodConfidence ? Math.round(state.moodConfidence * 100) : null;
            const g = document.getElementById('hero-face-glyph');
            const v = document.getElementById('hero-readout-value');
            const f = document.getElementById('hero-readout-foot');
            if (g) g.textContent = cfg.emoji;
            if (v) v.textContent = cfg.label;
            if (f && pct !== null) f.textContent = `Confidence ${pct}% · processed on device`;
        }

        // Mood palette → jump straight into recommendations
        document.querySelectorAll('.mood-tile').forEach(btn => {
            btn.addEventListener('click', () => this.pickMood(btn.dataset.mood));
        });

        // Picks grid + trending rail load in parallel (independent requests)
        const loadPicks = (async () => {
            try {
                const picksGrid = document.getElementById('home-picks');
                window.UI.createSkeletonCards(8).forEach(c => picksGrid.appendChild(c));
                let picks = [];
                if (mood) {
                    const res = await window.AnimeAPI.searchByMood(mood);
                    picks = (res.data || []).slice(0, 8);
                } else {
                    picks = ((await window.AnimeAPI.getSeasonal()) || []).slice(0, 8);
                }
                if (!document.getElementById('home-picks')) return;
                picksGrid.innerHTML = '';
                picks.forEach(a => picksGrid.appendChild(window.UI.createAnimeCard(a)));
            } catch (e) {
                console.error('Failed to load home picks', e);
                const picksGrid = document.getElementById('home-picks');
                if (picksGrid) picksGrid.innerHTML = '<p>Could not load picks right now.</p>';
            }
        })();

        const loadTrending = (async () => {
            try {
                const grid = document.getElementById('home-trending');
                window.UI.createSkeletonCards(10).forEach(c => grid.appendChild(c));
                const trending = await window.AnimeAPI.getTrending();
                if (!document.getElementById('home-trending')) return;
                grid.innerHTML = '';
                trending.forEach(a => grid.appendChild(window.UI.createAnimeCard(a)));

                const revealLayer = document.getElementById('reveal-layer');
                if (revealLayer) {
                    revealLayer.innerHTML = trending.slice(0, 4).map(a =>
                        `<img src="${window.UI.sanitize((a.images && a.images.jpg && a.images.jpg.large_image_url) || '')}" alt="">`
                    ).join('');
                }
            } catch (e) {
                console.error('Failed to load trending on home', e);
                const grid = document.getElementById('home-trending');
                if (grid) grid.innerHTML = '<p>Could not load trending anime.</p>';
            }
        })();

        await Promise.allSettled([loadPicks, loadTrending]);
    },

    // Mouse-following radial mask that reveals the poster collage (reference theme)
    // Perf: the soft spotlight is rendered ONCE into a small offscreen tile and
    // moved via mask-position, instead of re-encoding a full-screen PNG every
    // frame (the old toDataURL-per-frame approach). Looks identical.
    setupSpotlight() {
        const imgLayer = document.getElementById('reveal-layer');
        if (!imgLayer) return;

        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
            imgLayer.classList.add('no-mask'); // always visible
            return;
        }

        const SPOTLIGHT_R = 260;
        const TILE = SPOTLIGHT_R * 2;

        // Build the gradient tile once (same color stops as before)
        const tile = document.createElement('canvas');
        tile.width = TILE;
        tile.height = TILE;
        const tctx = tile.getContext('2d');
        const grad = tctx.createRadialGradient(SPOTLIGHT_R, SPOTLIGHT_R, 0, SPOTLIGHT_R, SPOTLIGHT_R, SPOTLIGHT_R);
        grad.addColorStop(0, 'rgba(255,255,255,1)');
        grad.addColorStop(0.4, 'rgba(255,255,255,1)');
        grad.addColorStop(0.6, 'rgba(255,255,255,0.75)');
        grad.addColorStop(0.75, 'rgba(255,255,255,0.4)');
        grad.addColorStop(0.88, 'rgba(255,255,255,0.12)');
        grad.addColorStop(1, 'rgba(255,255,255,0)');
        tctx.fillStyle = grad;
        tctx.fillRect(0, 0, TILE, TILE);

        const tileUrl = `url(${tile.toDataURL()})`;
        imgLayer.style.webkitMaskImage = tileUrl;
        imgLayer.style.maskImage = tileUrl;
        imgLayer.style.webkitMaskRepeat = 'no-repeat';
        imgLayer.style.maskRepeat = 'no-repeat';
        imgLayer.style.webkitMaskSize = `${TILE}px ${TILE}px`;
        imgLayer.style.maskSize = `${TILE}px ${TILE}px`;

        const mouse = { x: -9999, y: -9999 };
        const smooth = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
        let rafId = null;

        const applyPosition = () => {
            const x = `${(smooth.x - SPOTLIGHT_R).toFixed(1)}px`;
            const y = `${(smooth.y - SPOTLIGHT_R).toFixed(1)}px`;
            imgLayer.style.webkitMaskPosition = `${x} ${y}`;
            imgLayer.style.maskPosition = `${x} ${y}`;
        };
        applyPosition();

        const loop = () => {
            smooth.x += (mouse.x - smooth.x) * 0.1;
            smooth.y += (mouse.y - smooth.y) * 0.1;
            applyPosition();

            // Settled? Stop the loop entirely until the mouse moves again
            if (Math.abs(mouse.x - smooth.x) < 0.1 && Math.abs(mouse.y - smooth.y) < 0.1) {
                rafId = null;
                return;
            }
            rafId = requestAnimationFrame(loop);
        };

        const onMove = (e) => {
            mouse.x = e.clientX;
            mouse.y = e.clientY;
            if (rafId === null) rafId = requestAnimationFrame(loop);
        };
        window.addEventListener('mousemove', onMove, { passive: true });

        this._spotlightCleanup = () => {
            if (rafId !== null) cancelAnimationFrame(rafId);
            window.removeEventListener('mousemove', onMove);
            this._spotlightCleanup = null;
        };
    },

    unmountPage() {
        if (this._spotlightCleanup) this._spotlightCleanup();
    }
};

window.App.init();
