// backend/server.js

const express = require('express');
const dotenv = require('dotenv');
const cors = require('cors');
const morgan = require('morgan');
const path = require('path');
const connectDB = require('./config/db');

// Load environment variables from .env file
dotenv.config();

// Connect to MongoDB
connectDB();

const app = express();

// ✅ Middleware
app.use(cors());
app.use(express.json());
app.use(morgan('dev')); // Optional: logs all requests

// 📥 Global Debug Logger (for all requests)
app.use((req, res, next) => {
  console.log(`📥 ${req.method} ${req.originalUrl}`);
  if (req.method !== 'GET') {
    console.log('📦 Request Body:', JSON.stringify(req.body, null, 2));
  }
  next();
});

// 📡 API Routes
app.use('/api/player', require('./routes/playerRoutes'));
app.use('/api/matches', require('./routes/matchRoutes'));
app.use('/api/tournament', require('./routes/tournamentRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/round', require('./routes/roundRoutes'));
app.use('/api/knockout', require('./routes/knockoutRoutes'));

// ✅ Serve frontend from public folder
app.use(express.static(path.join(__dirname, '../public')));

// 🏠 Root route – health check
app.get('/', (req, res) => {
  res.send('🎉 Chess Tournament Backend is Live!');
});

// ❌ 404 Not Found Handler
app.use((req, res) => {
  res.status(404).json({ message: 'Endpoint not found 🚫' });
});

// 🔥 Global Error Handler
app.use((err, req, res, next) => {
  console.error('❌ Server Error:', err.message);
  res.status(500).json({ message: 'Something went wrong on the server.' });
});

// 🚀 Start server with 0.0.0.0 host for Render compatibility
const PORT = process.env.PORT || 5000;
const HOST = '0.0.0.0';

app.listen(PORT, HOST, () => {
  console.log(`🚀 Server is running at http://${HOST}:${PORT}`);
});
