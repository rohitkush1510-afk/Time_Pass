/* MoodMeter core — emotion detection pipeline using face-api.js.
   Uses face-api's pre-trained neural nets (trained on the standard emotion
   corpora FER2013 / AffectNet / RAF-DB / CK+):
     - TinyFaceDetector   : finds faces
     - FaceLandmark68Tiny : 68-point landmarks for alignment
     - FaceExpressionNet  : 7 basic expressions
                             (happy, sad, angry, fearful, disgusted, surprised, neutral)

   Pipeline:
   1. Detect face with TinyFaceDetector
   2. Track 68-point landmarks
   3. Read the 7 raw expression probabilities per frame   <-- all on-device
   4. Median-average across the best frames for stability
   5. Rank by confidence */
window.MoodMeter = {
    MODEL_URL: '/models/',
    SCAN_SAMPLES: 12,
    SAMPLE_INTERVAL_MS: 130,
    // The 7 expressions face-api's FaceExpressionNet reports.
    // These are later merged into the app's 6 moods by MoodMapping.
    EMOTIONS: ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'],

    // face-api's expression net is strongly biased toward "neutral" and rarely
    // fires the subtle "negative" emotions on their own. These tuning knobs
    // correct that bias so sad / fearful / disgusted survive real scans.
    // A signal at or above this is treated as genuinely present (not noise).
    RARE_BOOST_FLOOR: 0.04,
    RARE_BOOST_FACTOR: 1.5,
    // A negative emotion wins when it clears this absolute floor AND is this
    // many times stronger than the best competing happy/angry/surprised.
    RARE_WIN_FLOOR: 0.12,
    RARE_MARGIN: 1.4,

    INPUT_SIZE: 416,
    SCORE_THRESHOLD: 0.35,
    MIN_HITS: 4,

    modelsReady: false,
    _modelPromise: null,

    // face-api.min.js (~1.3MB) is NOT loaded in index.html anymore — it only
    // matters on the scanner/home pages that need the neural nets, so pull it
    // in on demand just before model weights load.
    _loadFaceApiScript() {
        return new Promise((resolve, reject) => {
            if (typeof faceapi !== 'undefined') return resolve();
            const existing = document.getElementById('face-api-script');
            if (existing) {
                existing.addEventListener('load', resolve, { once: true });
                existing.addEventListener('error', () => reject(new Error('face-api failed to load')), { once: true });
                return;
            }
            const script = document.createElement('script');
            script.id = 'face-api-script';
            script.src = '/vendor/face-api.min.js';
            script.async = true;
            script.addEventListener('load', resolve, { once: true });
            script.addEventListener('error', () => reject(new Error('face-api failed to load')), { once: true });
            document.head.appendChild(script);
        });
    },

    async loadModels() {
        if (this.modelsReady) return true;
        if (this._modelPromise) return this._modelPromise;

        this._modelPromise = (async () => {
            try {
                await this._loadFaceApiScript();
                if (typeof faceapi === 'undefined') throw new Error('face-api not available');

                await Promise.all([
                    faceapi.nets.tinyFaceDetector.loadFromUri(this.MODEL_URL),
                    faceapi.nets.faceLandmark68TinyNet.loadFromUri(this.MODEL_URL),
                    faceapi.nets.faceExpressionNet.loadFromUri(this.MODEL_URL)
                ]);

                console.log('[MoodMeter] models loaded — face detection + expression net ready');
                this.modelsReady = true;
                return true;
            } catch (error) {
                console.error('[MoodMeter] model loading failed:', error);
                return false;
            } finally {
                this._modelPromise = null;
            }
        })();

        return this._modelPromise;
    },

    assessFrameQuality(video) {
        const w = video.videoWidth;
        const h = video.videoHeight;
        if (!w || !h) return 0;

        const off = new OffscreenCanvas(w, h);
        const ctx = off.getContext('2d');
        ctx.drawImage(video, 0, 0, w, h);

        const cx = w / 2, cy = h / 2;
        const sw = Math.floor(w * 0.4);
        const sh = Math.floor(h * 0.5);
        const sx = Math.floor(cx - sw / 2);
        const sy = Math.floor(cy - sh / 2);

        try {
            const imgData = ctx.getImageData(sx, sy, sw, sh);
            const d = imgData.data;
            let sum = 0, count = 0;
            let min = 255, max = 0;

            for (let i = 0; i < d.length; i += 16) {
                const gray = d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114;
                sum += gray;
                count++;
                if (gray < min) min = gray;
                if (gray > max) max = gray;
            }

            const mean = sum / count;
            const contrast = max - min;

            let score = 1;
            if (mean < 40) score *= mean / 40;
            if (mean > 230) score *= (255 - mean) / 25;
            if (contrast < 30) score *= contrast / 30;

            return Math.max(0, Math.min(1, score));
        } catch (e) {
            return 0.5;
        }
    },

    // face-api already aligns faces internally for the nets it ships, so we
    // don't need to crop/equalize manually — the expression net outputs are
    // used directly and normalized below.
    normalizeExpressions(expressions) {
        if (!expressions) return null;

        const scores = {};
        let sum = 0;
        for (const e of this.EMOTIONS) {
            scores[e] = Math.max(0, expressions[e] || 0);
            sum += scores[e];
        }

        if (sum === 0) return null;

        for (const e of this.EMOTIONS) {
            scores[e] /= sum;
        }

        return scores;
    },

    medianAverage(frameData) {
        if (frameData.length === 0) return null;

        const result = {};
        for (const e of this.EMOTIONS) {
            const values = frameData.map(f => f.scores[e] || 0).sort((a, b) => a - b);
            const mid = Math.floor(values.length / 2);
            if (values.length % 2 === 0) {
                result[e] = (values[mid - 1] + values[mid]) / 2;
            } else {
                result[e] = values[mid];
            }
        }

        let sum = 0;
        for (const e of this.EMOTIONS) sum += result[e];
        if (sum > 0) {
            for (const e of this.EMOTIONS) result[e] /= sum;
        }

        return result;
    },

    // Correct for face-api's neutral bias so the subtle negative emotions
    // (sad, fearful, disgusted) actually survive a scan instead of being
    // drowned by the model's constant high "neutral" reading.
    //
    // face-api rarely fires these on their own and keeps neutral high by
    // default, so we compare each negative emotion against the OTHER
    // non-neutral emotions (not against neutral). If a specific negative
    // emotion clearly stands out from the rest, it is treated as the real
    // reading even when neutral's raw probability is nominally higher.
    //
    // Returns { scores, top } — "top" is the corrected winner's emotion key.
    refineExpressions(scores) {
        if (!scores) return { scores, top: null };

        const out = { ...scores };

        // Promote the three rare negatives if they pass the noise floor.
        for (const e of ['sad', 'fearful', 'disgusted']) {
            if (out[e] >= this.RARE_BOOST_FLOOR) {
                out[e] *= this.RARE_BOOST_FACTOR;
            }
        }

        // The strongest competing non-neutral emotion.
        const competition = {
            happy: out.happy,
            angry: out.angry,
            surprised: out.surprised,
            sad: 0, fearful: 0, disgusted: 0 // excluded — they're the candidates
        };
        const runnerUp = Math.max(competition.happy, competition.angry, competition.surprised);

        let decided = null;
        for (const e of ['sad', 'fearful', 'disgusted']) {
            if (out[e] >= this.RARE_WIN_FLOOR && out[e] >= runnerUp * this.RARE_MARGIN) {
                if (!decided || out[e] > out[decided]) decided = e;
            }
        }

        let top;
        if (decided) {
            top = decided;
            // Reinforce the winner so it surfaces as clearly dominant/ranked.
            out[decided] += (1 - out[decided]) * 0.5;
        } else {
            top = [...this.EMOTIONS].sort((a, b) => out[b] - out[a])[0];
        }

        // Re-normalize to a probability distribution.
        let sum = 0;
        for (const e of this.EMOTIONS) sum += out[e];
        if (sum > 0) {
            for (const e of this.EMOTIONS) out[e] /= sum;
        }

        return { scores: out, top };
    },

    drawOverlay(canvas, video, detection) {
        if (!canvas || !video.videoWidth) return;
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (!detection) return;
        const rect = canvas.getBoundingClientRect();
        const s = rect.width ? canvas.width / rect.width : 1;
        const r = Math.min(4, Math.max(2, 1.6 * s));
        ctx.fillStyle = 'rgba(139, 92, 246, 0.9)';
        for (const p of detection.landmarks.positions) {
            ctx.beginPath();
            ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    async scan(video, overlayCanvas) {
        const options = new faceapi.TinyFaceDetectorOptions({
            inputSize: this.INPUT_SIZE,
            scoreThreshold: this.SCORE_THRESHOLD
        });

        let hits = 0;
        const frameData = [];

        for (let i = 0; i < this.SCAN_SAMPLES; i++) {
            let det = null;
            if (video.readyState >= 2) {
                det = await faceapi
                    .detectSingleFace(video, options)
                    .withFaceLandmarks(true)
                    .withFaceExpressions();
            }

            if (det) {
                const quality = this.assessFrameQuality(video);
                if (quality > 0.2) {
                    const normalized = this.normalizeExpressions(det.expressions);
                    if (normalized) {
                        hits++;
                        frameData.push({
                            scores: normalized,
                            confidence: det.detection.score,
                            quality
                        });
                    }
                }
            }

            this.drawOverlay(overlayCanvas, video, det);
            await new Promise(r => setTimeout(r, this.SAMPLE_INTERVAL_MS));
        }

        this.drawOverlay(overlayCanvas, video, null);

        if (hits < this.MIN_HITS) throw new Error('NO_FACE');

        frameData.sort((a, b) => b.quality - a.quality);
        const keepCount = Math.max(Math.floor(frameData.length * 0.8), this.MIN_HITS);
        const bestFrames = frameData.slice(0, keepCount);

        const avgScores = this.medianAverage(bestFrames);
        if (!avgScores) throw new Error('NO_FACE');

        // Correct neutral bias + boost the rare negative emotions before ranking.
        const { scores: refined, top } = this.refineExpressions(avgScores);

        const ranked = [...this.EMOTIONS].sort((a, b) => refined[b] - refined[a]);
        const winner = top || ranked[0];
        const confidence = refined[winner];

        return {
            top: winner,
            confidence,
            scores: refined,
            ranked,
            hits,
            totalSamples: this.SCAN_SAMPLES
        };
    }
};
