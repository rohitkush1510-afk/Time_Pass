window.MoodScanner = {
    modelsLoaded: false,
    modelsFailed: false,
    stream: null,
    _guideInterval: null,

    MIN_CONFIDENCE: 0.50,
    // face-api structurally outputs lower probabilities for the rare negative
    // emotions even when correct, so accept them at a lower floor.
    MIN_CONFIDENCE_RARE: 0.30,
    RARE_EMOTIONS: ['sad', 'fearful', 'disgusted'],

    /* Scanner page DOM, fetched fresh each time (page re-renders per visit) */
    els() {
        return {
            video: document.getElementById('scanner-video'),
            canvas: document.getElementById('scanner-canvas'),
            status: document.getElementById('scan-status'),
            btnStart: document.getElementById('btn-start-scan'),
            frame: document.getElementById('scanner-frame'),
            controls: document.getElementById('scanner-controls'),
            result: document.getElementById('scan-result'),
            faceGuide: document.getElementById('face-guide')
        };
    },

    /* One-liner shown under the result, keyed by mapped mood */
    SUGGESTIONS: {
        happy: 'Ride the wave — comedies will land even better right now.',
        sad: 'A good cry can help. Or something gentle to lift you up.',
        angry: 'Channel it into high-octane action.',
        surprised: 'Lean into it — twists ahead.',
        neutral: 'Easy viewing while you chill.',
        naughty: 'Feeling spicy? We won\u2019t judge.'
    },

    async loadModels() {
        if (this.modelsLoaded) return true;
        if (this.modelsFailed) return false;

        // Delegated to the mood-meter core function module
        const ok = await window.MoodMeter.loadModels();
        this.modelsLoaded = ok;
        this.modelsFailed = !ok;
        return ok;
    },

    // Only accept scans the AI is reasonably sure about — an honest "try again"
    // beats a confidently wrong mood
    acceptResult(mood, confidence, scores, status, btnStart) {
        if (typeof confidence === 'number') {
            const floor = this.RARE_EMOTIONS.includes(mood) ? this.MIN_CONFIDENCE_RARE : this.MIN_CONFIDENCE;
            if (confidence < floor) {
                status.innerText = '';
                window.UI.showToast(
                    `Confidence too low (${Math.round(confidence * 100)}%). Try again with:\n• Better lighting on your face\n• Neutral background\n• Hold still during scan`,
                    'info'
                );
                btnStart.style.display = 'inline-block';
                return false;
            }
        }
        this.finishScan(mood, confidence, scores);
        return true;
    },

    renderPage() {
        const moodsHtml = window.MoodMapping.getAllMoods().map(mood => {
            const m = window.MoodMapping.MOOD_CONFIG[mood];
            return `<button class="mood-btn" data-mood="${mood}" style="border-color:${m.color}">
                <span class="mood-emoji">${m.emoji}</span>
                <span class="mood-label">${m.label}</span>
            </button>`;
        }).join('');

        return `
            <div class="scanner-page">
                <div class="hero-section">
                    <h2>Let's detect your mood!</h2>
                    <p>Position your face in the frame and we'll analyze your expression</p>
                </div>

                <div class="scanner-container">
                    <video id="scanner-video" class="scanner-video" autoplay muted playsinline></video>
                    <canvas id="scanner-canvas" class="scanner-canvas"></canvas>
                    <div id="face-guide" class="face-guide"></div>
                    <div class="scanner-frame" id="scanner-frame"></div>
                    <button id="btn-reload-scan" class="btn-scan-reload" title="Scan again" aria-label="Scan again"><span class="btn-scan-reload-icon">⟳</span></button>
                </div>

                <div id="scanner-controls" class="scanner-controls">
                    <button id="btn-start-scan" class="btn-primary">Start Scan</button>
                    <p id="scan-status" class="scanner-status"></p>
                </div>

                <div id="scan-result" class="scan-result" style="display:none;">
                    <div class="result-card">
                        <div class="result-card-header">
                            <span class="result-badge-label">Scan Complete</span>
                            <div class="winner-display">
                                <span id="result-emoji" class="winner-emoji"></span>
                                <h3 id="result-text" class="winner-mood-label"></h3>
                                <div id="winner-pct" class="winner-percentage"></div>
                            </div>
                            <div id="secondary-moods" class="secondary-moods"></div>
                        </div>

                        <div class="mood-breakdown-section">
                            <div class="mood-breakdown-header">Mood Breakdown</div>
                            <div id="mood-breakdown" class="mood-breakdown"></div>
                        </div>

                        <p id="result-suggestion" class="result-suggestion"></p>

                        <div class="scan-actions">
                            <button id="btn-accept-scan" class="btn-accept">
                                <span>Accept & See Anime</span>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
                            </button>
                            <button id="btn-rescan" class="btn-rescan">Rescan</button>
                        </div>
                    </div>
                </div>

                <div class="manual-moods" style="margin-top:40px;">
                    <h3>Or choose your mood manually</h3>
                    <div class="mood-grid">
                        ${moodsHtml}
                    </div>
                </div>
            </div>
        `;
    },

    async mountPage() {
        // Re-check DeepFace availability fresh on each page visit.
        this._deepFaceEnabled = undefined;
        document.getElementById('btn-start-scan').onclick = () => this.startScan();

        // Reload icon on the camera frame — rescan the mood from anywhere
        document.getElementById('btn-reload-scan').onclick = () => {
            const result = document.getElementById('scan-result');
            const controls = document.getElementById('scanner-controls');
            if (result) result.style.display = 'none';
            if (controls) controls.style.display = 'block';
            this.stopScan();
            this.startScan();
        };

        document.querySelectorAll('.mood-btn').forEach(btn => {
            btn.onclick = () => this.selectMood(btn.dataset.mood);
        });

        document.getElementById('btn-accept-scan').onclick = () => {
            window.navigateTo('#/recommendations');
        };
        document.getElementById('btn-rescan').onclick = () => {
            document.getElementById('scan-result').style.display = 'none';
            document.getElementById('scanner-controls').style.display = 'block';
            document.getElementById('scan-status').innerText = '';
            this.startScan();
        };

        // Pre-warm models quietly so the first scan is instant
        if (!this.modelsLoaded && !this.modelsFailed) {
            const status = document.getElementById('scan-status');
            status.innerText = 'Preparing AI...';
            const ok = await this.loadModels();
            status.innerText = ok ? 'Ready! Click "Start Scan".' : 'AI unavailable — you can still pick your mood manually below.';
        }
    },

    async startCamera(video, status, showToast) {
        status.innerText = 'Requesting camera access...';
        try {
            this.stopCamera();
            this.stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false
            });
            video.srcObject = this.stream;
        } catch (err) {
            console.error('Camera error:', err);
            status.innerText = '';
            showToast('Camera access denied or unavailable. Pick a mood manually instead.', 'error');
            return false;
        }

        status.innerText = 'Starting camera...';
        try {
            await new Promise((resolve, reject) => {
                const timeout = setTimeout(() => reject(new Error('Camera startup timed out')), 10000);
                const onReady = () => { clearTimeout(timeout); resolve(); };
                if (video.readyState >= 2 && !video.paused) {
                    onReady();
                } else {
                    video.addEventListener('playing', onReady, { once: true });
                    video.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('Video error')); }, { once: true });
                }
            });
        } catch (err) {
            console.error(err);
            this.stopCamera();
            status.innerText = '';
            showToast('Could not start the camera feed.', 'error');
            return false;
        }

        // Start face guidance if models are loaded
        if (this.modelsLoaded) {
            this.startFaceGuide(video);
        }

        return true;
    },

    /* Show real-time face detection feedback while camera is active
       but before the actual scan starts */
    startFaceGuide(video) {
        this.stopFaceGuide();
        if (typeof faceapi === 'undefined') return; // models not loaded — no face guide
        const { canvas, faceGuide } = this.els();
        if (!canvas || !faceGuide) return;

        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: window.MoodMeter.INPUT_SIZE,
            scoreThreshold: 0.3
        });

        let lastCheck = 0;
        const checkInterval = 500; // check every 500ms to avoid perf hit

        const guideLoop = async () => {
            const now = Date.now();
            if (now - lastCheck < checkInterval) {
                this._guideInterval = requestAnimationFrame(guideLoop);
                return;
            }
            lastCheck = now;

            if (!video.videoWidth || video.paused || video.ended) {
                this.stopFaceGuide();
                return;
            }

            try {
                const det = await faceapi.detectSingleFace(video, options);
                if (det) {
                    const faceArea = det.detection.box.width * det.detection.box.height;
                    const frameArea = video.videoWidth * video.videoHeight;
                    const ratio = faceArea / frameArea;

                    if (ratio < 0.08) {
                        faceGuide.textContent = 'Move closer to the camera';
                        faceGuide.className = 'face-guide warning';
                    } else if (ratio > 0.5) {
                        faceGuide.textContent = 'Move back a little';
                        faceGuide.className = 'face-guide warning';
                    } else {
                        faceGuide.textContent = 'Face detected — ready to scan!';
                        faceGuide.className = 'face-guide good';
                    }
                } else {
                    faceGuide.textContent = 'Position your face in the center';
                    faceGuide.className = 'face-guide searching';
                }
            } catch (e) {
                // Silently ignore detection errors during guide
            }

            this._guideInterval = requestAnimationFrame(guideLoop);
        };

        this._guideInterval = requestAnimationFrame(guideLoop);
    },

    stopFaceGuide() {
        if (this._guideInterval) {
            cancelAnimationFrame(this._guideInterval);
            this._guideInterval = null;
        }
        const { faceGuide } = this.els();
        if (faceGuide) {
            faceGuide.textContent = '';
            faceGuide.className = 'face-guide';
        }
    },

    async runScan() {
        const { video, canvas, status, btnStart } = this.els();
        if (!video || !btnStart) return;

        btnStart.disabled = true;
        btnStart.classList.add('scanning');
        btnStart.textContent = 'Reading your face\u2026';

        this.stopFaceGuide();

        try {
            if (status) status.innerText = 'Analyzing expressions\u2026';
            const result = await window.MoodMeter.scan(video, canvas);

            // Optional fusion with the DeepFace sidecar: if it's enabled and
            // answers, merge its independent 7-emotion scores into the result.
            const fused = await this.tryDeepFaceFusion(video, result);

            const mood = (fused && fused.top) || result.top;
            const confidence = (fused && fused.confidence) || result.confidence;
            const scores = (fused && fused.scores) || result.scores;

            console.log('[MoodScanner] scan result:', {
                mood: mood,
                confidence: Math.round(confidence * 100) + '%',
                source: (fused && fused.source) || 'faceapi',
                hits: result.hits + '/' + result.totalSamples,
                allScores: Object.fromEntries(
                    Object.entries(scores).map(([k, v]) => [k, Math.round(v * 100) + '%'])
                )
            });

            this.acceptResult(mood, confidence, scores, status, btnStart);
        } catch (err) {
            this.stopScan();
            if (status) {
                if (err.message === 'NO_FACE') {
                    status.innerText = 'No clear face detected. Tips:\n\u2022 Center your face in the frame\n\u2022 Use good front-facing lighting\n\u2022 Remove sunglasses or heavy obstructions';
                } else {
                    status.innerText = 'Something went wrong during the scan. Please try again.';
                }
            }
            window.UI.showToast(err.message === 'NO_FACE'
                ? 'Mood detection failed \u2014 pick a mood manually below.'
                : 'Scan failed \u2014 please try again.', 'error');
        } finally {
            if (btnStart) {
                btnStart.disabled = false;
                btnStart.style.display = '';
                btnStart.classList.remove('scanning');
                btnStart.textContent = 'Start Scan';
            }
        }
    },

    /* Ask the backend whether the DeepFace sidecar is enabled. Cached. */
    async deepFaceEnabled() {
        if (this._deepFaceEnabled !== undefined) return this._deepFaceEnabled;
        try {
            const resp = await fetch('/api/mood/deepface-status', { cache: 'no-store' });
            const data = await resp.json();
            this._deepFaceEnabled = Boolean(data && data.enabled);
        } catch {
            this._deepFaceEnabled = false;
        }
        return this._deepFaceEnabled;
    },

    /* Capture one frame, proxy it to the DeepFace sidecar, and fuse its
       scores with the face-api result. Gracefully falls back to the face-api
       result if the sidecar is off, unreachable or errors. */
    async tryDeepFaceFusion(video, faceResult) {
        if (!window.MoodFuser) return null;
        let enabled = false;
        try { enabled = await this.deepFaceEnabled(); } catch { enabled = false; }
        if (!enabled || !video || !video.videoWidth) return null;

        try {
            const off = document.createElement('canvas');
            off.width = video.videoWidth;
            off.height = video.videoHeight;
            const ctx = off.getContext('2d');
            ctx.drawImage(video, 0, 0, off.width, off.height);
            const dataUri = off.toDataURL('image/jpeg', 0.9);

            const resp = await fetch('/api/mood/deepface', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ image: dataUri })
            });
            if (!resp.ok) return null;
            const data = await resp.json();
            if (!data || !data.available || !data.scores) return null;

            return window.MoodFuser.fuse(faceResult.scores, data.scores);
        } catch (e) {
            console.warn('[MoodScanner] DeepFace fusion unavailable:', e);
            return null;
        }
    },

    async startScan() {
        const { video, status, btnStart, frame } = this.els();

        status.innerText = 'Preparing AI...';
        const modelsOk = await this.loadModels();

        if (!modelsOk) {
            status.innerText = 'AI could not load. Please choose your mood manually below.';
            window.UI.showToast('Face scan unavailable — use manual mood selection.', 'info');
            return;
        }

        // Stop the guide before starting camera (will restart after camera is ready)
        this.stopFaceGuide();

        if (!await this.startCamera(video, status, window.UI.showToast)) return;

        btnStart.style.display = 'none';
        status.innerText = 'Scanning...';
        if (frame) frame.classList.add('scanning');
        await this.runScan();
    },

    /* Result card: prominent winner mood, secondary mood chips */
    finishScan(mood, confidence, rawScores) {
        // Resolve winning mood from full expression scores
        const resolved = window.MoodMapping.resolveWinningMood(rawScores);

        window.APP_STATE.currentMood = resolved.mood;
        window.APP_STATE.moodConfidence = resolved.confidence;
        // A fresh scan must produce fresh recommendations — drop the cached page
        if (window.Recommendations) window.Recommendations.clearCache();

        const { frame, controls, result } = this.els();
        controls.style.display = 'none';
        if (frame) frame.classList.remove('scanning');
        result.style.display = 'block';

        const m = window.MoodMapping.MOOD_CONFIG[resolved.mood] || window.MoodMapping.MOOD_CONFIG.neutral;
        const confPct = Math.round(resolved.confidence * 100);

        // Set mood-colored accent on the result card
        const card = result.querySelector('.result-card');
        if (card) {
            card.style.setProperty('--mood-color', m.color);
            setTimeout(() => card.classList.add('mood-revealed'), 120);
        }

        // Winner emoji with pop animation
        const emojiEl = document.getElementById('result-emoji');
        emojiEl.textContent = m.emoji;
        emojiEl.classList.remove('pop');
        void emojiEl.offsetWidth;
        setTimeout(() => emojiEl.classList.add('pop'), 200);

        // Winner mood label
        document.getElementById('result-text').textContent = m.label;

        // Winner percentage pill
        const pctEl = document.getElementById('winner-pct');
        pctEl.classList.remove('pct-pop');
        void pctEl.offsetWidth;
        pctEl.textContent = `${confPct}%`;
        pctEl.style.background = m.color;
        pctEl.style.boxShadow = `0 6px 24px color-mix(in srgb, ${m.color} 45%, rgba(0,0,0,0.3)), 0 0 0 3px color-mix(in srgb, ${m.color} 20%, transparent)`;
        setTimeout(() => pctEl.classList.add('pct-pop'), 100);

        // Secondary moods as compact chips
        const moodEntries = Object.entries(resolved.moodScores).sort((a, b) => b[1] - a[1]);
        const secondaryEl = document.getElementById('secondary-moods');
        const secondaryMoods = moodEntries.filter(([k, v]) => k !== resolved.mood && v > 0.05);

        if (secondaryMoods.length > 0) {
            secondaryEl.innerHTML = secondaryMoods.map(([moodKey, v]) => {
                const pct = Math.round(v * 100);
                const cfg = window.MoodMapping.MOOD_CONFIG[moodKey];
                if (!cfg) return '';
                return `<span class="secondary-mood-chip" style="--chip-color:${cfg.color}">
                    <span class="chip-emoji">${cfg.emoji}</span>
                    <span class="chip-pct">${pct}%</span>
                </span>`;
            }).join('');
            secondaryEl.style.display = 'flex';
        } else {
            secondaryEl.style.display = 'none';
        }

        // Mood breakdown bars
        const breakdownEl = document.getElementById('mood-breakdown');
        if (breakdownEl) {
            const sortedEntries = moodEntries.filter(([, v]) => v > 0.02);
            breakdownEl.innerHTML = sortedEntries.map(([moodKey, v]) => {
                const pct = Math.round(v * 100);
                const cfg = window.MoodMapping.MOOD_CONFIG[moodKey];
                if (!cfg) return '';
                const isTop = moodKey === resolved.mood;
                return `<div class="mood-bar-row ${isTop ? 'mood-bar-top' : ''}" style="--bar-color:${cfg.color}">
                    <div class="mood-bar-label">
                        <span class="mood-bar-emoji">${cfg.emoji}</span>
                        <span class="mood-bar-name">${cfg.label}</span>
                    </div>
                    <div class="mood-bar-track">
                        <div class="mood-bar-fill" style="width:${pct}%"></div>
                    </div>
                    <span class="mood-bar-pct">${pct}%</span>
                </div>`;
            }).join('');
        }

        // Suggestion
        document.getElementById('result-suggestion').textContent = this.SUGGESTIONS[resolved.mood] || '';

        window.UserStore.addMoodHistory({ mood: resolved.mood, confidence: resolved.confidence, method: 'scan' });
    },

    stopCamera() {
        this.stopFaceGuide();
        if (this.stream) {
            this.stream.getTracks().forEach(track => track.stop());
            this.stream = null;
        }
        const { video } = this.els();
        if (video) video.srcObject = null;
    },

    stopScan() {
        this.stopCamera();
        const { frame, canvas } = this.els();
        if (frame) frame.classList.remove('scanning');
        if (canvas) canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    },

    selectMood(mood) {
        window.APP_STATE.currentMood = mood;
        window.APP_STATE.moodConfidence = 1.0;
        // Fresh mood → fresh recommendations (don't restore a stale snapshot)
        if (window.Recommendations) window.Recommendations.clearCache();
        window.UserStore.addMoodHistory({ mood, confidence: 1.0, method: 'manual' });
        window.navigateTo('#/recommendations');
    },

    unmountPage() {
        this.stopScan();
    }
};
