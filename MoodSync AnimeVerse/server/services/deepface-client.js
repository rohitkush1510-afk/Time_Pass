/**
 * ============================================================================
 *   DEEPFACE CLIENT — proxy to the optional Python DeepFace sidecar
 * ============================================================================
 *
 *   The browser normally runs face-api.js entirely on-device. When the
 *   DeepFace sidecar is enabled (DEEPFACE_ENABLED=true), the browser sends one
 *   captured frame (base64) to the Node backend, which proxies it to the
 *   Python service (server/deepface/deepface_service.py) that runs DeepFace's
 *   emotion model. The returned 7-emotion distribution is then FUSED with the
 *   face-api.js distribution in the browser by the custom fuser.
 *
 *   Config:
 *     DEEPFACE_ENABLED    "true" turns the sidecar on (default: off)
 *     DEEPFACE_API_URL    base URL of the Python service (default localhost:5001)
 *     DEEPFACE_TIMEOUT_MS per-request timeout (default 10000)
 *
 *   Privacy: frames travel only browser -> Node -> localhost Python service.
 * ============================================================================
 */

const BASE_URL = (process.env.DEEPFACE_API_URL || 'http://127.0.0.1:5001').replace(/\/+$/, '');
const ENABLED = String(process.env.DEEPFACE_ENABLED || '').toLowerCase() === 'true';
const TIMEOUT_MS = Number(process.env.DEEPFACE_TIMEOUT_MS || 10000);

// Optional per-emotion fine-tune multipliers, e.g. DEEPFACE_WEIGHTS='sad:1.2,fearful:1.3'
const WEIGHTS = parseWeights(process.env.DEEPFACE_WEIGHTS);

function parseWeights(raw) {
    const out = {};
    if (!raw) return out;
    for (const part of String(raw).split(',')) {
        const [k, v] = part.split(':');
        if (k && v) {
            const n = Number(v);
            if (Number.isFinite(n)) out[k.trim()] = n;
        }
    }
    return out;
}

function isEnabled() {
    return ENABLED;
}

async function analyzeEmotion(base64Image) {
    let lastError;
    for (let attempt = 0; attempt <= 1; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
        try {
            const response = await fetch(`${BASE_URL}/emotion`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
                body: JSON.stringify({ image: base64Image, weights: WEIGHTS }),
                signal: controller.signal
            });
            if (!response.ok) throw new Error(`DeepFace sidecar returned ${response.status}`);
            const data = await response.json();
            if (data && data.success === false) throw new Error(data.error || 'DeepFace analysis failed');
            return {
                available: true,
                enabled: true,
                scores: (data && data.scores) || null,
                top: (data && data.top_emotion) || null
            };
        } catch (error) {
            lastError = error;
            if (attempt < 1) await new Promise(r => setTimeout(r, 300));
        } finally {
            clearTimeout(timer);
        }
    }
    console.warn(`[deepface] sidecar unavailable (${lastError && lastError.message})`);
    return { available: false, enabled: true, scores: null, top: null, error: lastError && lastError.message };
}

/**
 * @param {string} name one of: emotion
 * @param {object} args { image }
 */
async function call(name, args = {}) {
    switch (name) {
        case 'emotion':
            return analyzeEmotion(args.image);
        default:
            throw new Error(`No DeepFace adapter named "${name}"`);
    }
}

module.exports = { isEnabled, call };
