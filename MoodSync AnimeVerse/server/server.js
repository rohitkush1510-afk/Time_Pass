require('dotenv').config();
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const path = require('path');

const animeRoutes = require('./routes/anime');
const moodRoutes = require('./routes/mood');

const app = express();
const PORT = process.env.PORT ;

// Middleware
app.use(cors());
app.use(express.json({ limit: '5mb' }));
app.use(compression());

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
});

// API Routes
app.use('/api/anime', animeRoutes);
app.use('/api/mood', moodRoutes);

// Serve static files from public directory
const publicPath = path.join(__dirname, '../public');

app.use(express.static(publicPath, {
    etag: true,
    lastModified: true,
    setHeaders(res, filePath) {
        // index.html must revalidate each visit so new ?v= bumps get picked up.
        if (filePath.endsWith('index.html')) {
            res.setHeader('Cache-Control', 'no-cache');
            return;
        }
        // Everything else is content-addressable via the ?v= tag in index.html,
        // so once fetched it can live in the browser cache forever.
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    }
}));

// SPA Fallback: serve index.html for non-API routes
app.get('*', (req, res) => {
    if (!req.path.startsWith('/api/')) {
        res.setHeader('Cache-Control', 'no-cache');
        res.sendFile(path.join(publicPath, 'index.html'));
    } else {
        res.status(404).json({ error: 'API endpoint not found' });
    }
});

app.listen(PORT, () => {
    console.log(`MoodSync AnimeVision server running at http://localhost:${PORT}`);
});
