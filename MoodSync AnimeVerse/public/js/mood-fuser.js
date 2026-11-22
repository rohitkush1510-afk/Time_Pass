/* MoodFuser — custom fine-tuned fuser that merges face-api.js and DeepFace
 * emotion scores into a single 7-emotion distribution.
 *
 * face-api.js runs in the browser (mood-meter-core.js). When the optional
 * DeepFace sidecar is enabled, the scan also captures one frame, the Node
 * backend repeatedly proxies it to the Python service, and we FUSE the two
 * independent models here.
 *
 * Fusing two independent models is more robust than either alone: on real
 * webcam scans, face-api can be biased toward "neutral" while DeepFace can
 * over-fire "sad" — combining them (with per-emotion reliability weights)
 * corrects the outliers and narrows the confidence interval.
 *
 * Design:
 *   - A weighted geometric mean across models, per emotion, tuned so the more
 *     reliable model sways each emotion more.
 *   - A set of fine-tuned multipliers that boost/mute specific emotions so the
 *     output leans toward app moods that historically under-detected (sad,
 *     fearful, disgusted).
 *   - Softmax re-normalization so the fused result is a probability vector.
 */
window.MoodFuser = {
    // App 7-emotion space (same order as mood-meter-core.js)
    EMOTIONS: ['neutral', 'happy', 'sad', 'angry', 'fearful', 'disgusted', 'surprised'],

    // Per-emotion reliability of each model (0..1). DeepFace's emotion model
    // (FER2013-trained) is comparatively stronger at "sad"/"neutral", while
    // face-api (AffectNet/etc.) is stronger at "happy"/"surprised". These are
    // the FINE-TUNED weights you adjust when calibrating accuracy.
    MODEL_WEIGHT: {
        faceapi: { neutral: 0.50, happy: 0.62, sad: 0.45, angry: 0.58, fearful: 0.46, disgusted: 0.48, surprised: 0.60 },
        deepface: { neutral: 0.50, happy: 0.55, sad: 0.60, angry: 0.55, fearful: 0.58, disgusted: 0.58, surprised: 0.50 }
    },

    // Fine-tuned per-emotion multipliers applied AFTER fusion. Values > 1
    // boost a mood, < 1 mute it. Tune these to reshape the final ranking.
    FINE_TUNE: {
        neutral: 0.92,   // counter the neutral bias
        happy: 1.0,
        sad: 1.15,       // sad was historically under-detected
        angry: 1.0,
        fearful: 1.10,   // folds into "surprised" downstream; raise to surface it
        disgusted: 1.10, // folds into "naughty" downstream
        surprised: 1.0
    },

    // If a model is absent, fall back to just the other one (pass-through).
    // RARE_FLOOR: minimum score for a negative emotion to count as "present"
    // in either model (treating anything below as noise).
    RARE_FLOOR: 0.03,
    // CONFIRMED_BOOST: multiplier applied when BOTH models agree a rare
    // negative emotion is present above the floor.
    CONFIRMED_BOOST: 2.2,

    fuse(faceScores, deepScores) {
        if (!faceScores && !deepScores) return null;

        const face = faceScores || {};
        const deep = deepScores || {};

        const out = {};
        for (const e of this.EMOTIONS) {
            const f = Math.max(0, face[e] || 0);
            const d = Math.max(0, deep[e] || 0);

            let combined;
            if (f > 0 && d > 0) {
                // Weighted geometric mean — the more reliable model dominates.
                const wf = this.MODEL_WEIGHT.faceapi[e];
                const wd = this.MODEL_WEIGHT.deepface[e];
                const inv = 1 / (wf + wd);
                combined = Math.pow(f, wf * inv) * Math.pow(d, wd * inv);
            } else {
                combined = f + d;
            }

            // Fine-tuned per-emotion multiplier.
            out[e] = (combined || 0) * (this.FINE_TUNE[e] !== undefined ? this.FINE_TUNE[e] : 1);
        }

        // Rare-negative confirmation: if face-api and DeepFace BOTH register a
        // negative emotion (sad/fearful/disgusted) above its floor, boost it to
        // dominate. A single model's low report is treated as noise; agreement
        // between two independent models is a strong signal. This is what lets
        // a fused scan actually surface "sad" against face-api's neutral bias.
        for (const e of ['sad', 'fearful', 'disgusted']) {
            if (face[e] >= this.RARE_FLOOR && deep[e] >= this.RARE_FLOOR && face[e] > 0 && deep[e] > 0) {
                out[e] *= this.CONFIRMED_BOOST;
            }
        }

        // Softmax re-normalize to a probability distribution.
        const exps = {};
        let sum = 0;
        for (const e of this.EMOTIONS) {
            exps[e] = Math.exp(out[e]);
            sum += exps[e];
        }
        const normalized = {};
        for (const e of this.EMOTIONS) normalized[e] = sum > 0 ? exps[e] / sum : 0;

        const ranked = [...this.EMOTIONS].sort((a, b) => normalized[b] - normalized[a]);
        const top = ranked[0];

        return {
            top,
            confidence: normalized[top],
            scores: normalized,
            ranked,
            source: (face && deep) ? 'fused' : (face ? 'faceapi' : 'deepface')
        };
    }
};
