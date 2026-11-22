const express = require('express');
const router = express.Router();
const deepface = require('../services/deepface-client');

// POST /api/mood/deepface
// Body: { image: "<base64 data URI>" }
// Proxies one captured frame to the Python DeepFace sidecar and returns the
// normalized 7-emotion distribution for the browser fuser to merge with
// face-api.js. Returns 503 ({ available:false }) when the sidecar is not
// enabled or unreachable, so the browser falls back gracefully.
router.post('/deepface', async (req, res) => {
    if (!deepface.isEnabled()) {
        return res.status(503).json({ available: false, enabled: false, scores: null, top: null });
    }

    const image = req.body && req.body.image;
    if (!image || typeof image !== 'string') {
        return res.status(400).json({ error: 'Missing "image" (base64) in request body' });
    }

    try {
        const result = await deepface.call('emotion', { image });
        if (!result.available || !result.scores) {
            return res.status(503).json({ available: false, enabled: true, scores: null, top: null, error: result.error });
        }
        res.json({ available: true, enabled: true, scores: result.scores, top: result.top });
    } catch (error) {
        console.warn(`[mood] DeepFace proxy failed (${error.message})`);
        res.status(503).json({ available: false, enabled: true, scores: null, top: null, error: error.message });
    }
});

// GET /api/mood/deepface-status — tells the browser whether fusion is possible
router.get('/deepface-status', (req, res) => {
    res.json({ enabled: deepface.isEnabled() });
});

module.exports = router;
