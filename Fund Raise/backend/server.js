const path = require('path');
const dns = require('dns');
const http = require('http');
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');

require('dotenv').config({ path: path.join(__dirname, '.env') });


const dnsServers = (process.env.DNS_SERVERS || '')
  .split(',')
  .map((server) => server.trim())
  .filter(Boolean);
if (dnsServers.length > 0) dns.setServers(dnsServers);


const configuredOrigins = String(process.env.CORS_ORIGIN || '*')
  .split(',')
  .map((value) => value.trim().replace(/\/+$/, ''))
  .filter(Boolean);
const origin = configuredOrigins.length === 0 || configuredOrigins.includes('*')
  ? '*'
  : configuredOrigins;

const app = express();

app.use(cors({
  origin,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  optionsSuccessStatus: 200
}));

app.use(express.json({ limit: '6mb' }));


app.use('/api/uploads', express.static(path.join(__dirname, 'uploads')));

// API routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/campaigns', require('./routes/campaigns'));
app.use('/api/pledges', require('./routes/pledges'));
app.use('/api/admin', require('./routes/admin'));

app.get('/', (req, res) => res.send('FundRaise API is running'));

app.use('/api', (req, res) => res.status(404).json({ message: 'API route not found' }));


app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({ message: 'Invalid JSON body' });
  }
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request is too large (max 6 MB). Please pick a smaller picture.' });
  }

  console.error(err);
  return res.status(500).json({ message: 'Internal server error' });
});

const server = http.createServer(app);
const io = new Server(server, { cors: { origin } });


app.set('io', io);

io.on('connection', (socket) => {
  console.log('a user connected with socket id: ' + socket.id);
  socket.on('disconnect', () => console.log('user disconnected: ' + socket.id));
});

if (!process.env.MONGO_URL) {
  console.log('MongoDB error: MONGO_URL is missing in backend/.env');
} else {
  mongoose.connect(process.env.MONGO_URL)
    .then(() => console.log('MongoDB connected'))
    .catch((err) => console.log('MongoDB error: ' + err.message));
}

const PORT = process.env.PORT ;
server.listen(PORT, () => console.log('Server running on port ' + PORT));
