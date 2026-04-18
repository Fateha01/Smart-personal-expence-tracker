/* ═══════════════════════════════════════════════════════════
   EXPENSIO — server.js
   Entry point: Express app + MongoDB connection
   ═══════════════════════════════════════════════════════════ */
'use strict';

require('dotenv').config({ path: require('path').join(__dirname, '.env') });
const express  = require('express');
const mongoose = require('mongoose');
const cors     = require('cors');
const helmet   = require('helmet');
const morgan   = require('morgan');

const authRoutes        = require('./routes/auth.routes');
const transactionRoutes = require('./routes/transaction.routes');
const budgetRoutes      = require('./routes/budget.routes');
const adminRoutes       = require('./routes/admin.routes');
const { notFound, errorHandler } = require('./middleware/error.middleware');

const app  = express();
const PORT = process.env.PORT || 5000;

/* ── Security & Logging ─────────────────────────────────── */
app.use(helmet());
app.use(morgan(process.env.NODE_ENV === 'development' ? 'dev' : 'combined'));

/* ── CORS ───────────────────────────────────────────────── */
app.use(cors({
  origin: function (origin, callback) {
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

/* ── Body Parsing ───────────────────────────────────────── */
app.use(express.json({ limit: '1mb' }));
app.use(express.urlencoded({ extended: true }));

/* ── Health Check ───────────────────────────────────────── */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    app: 'Expensio API',
    version: '1.0.0',
    environment: process.env.NODE_ENV,
    dbStatus: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

/* ── API Routes ─────────────────────────────────────────── */
app.use('/api/auth',         authRoutes);
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets',      budgetRoutes);
app.use('/api/admin',        adminRoutes);

/* ── Error Handlers ─────────────────────────────────────── */
app.use(notFound);
app.use(errorHandler);

const connectDB = require('./config/db');

/* ── ...existing middleware... ── */

/* ── Start Server ───────────────────────────────────────── */
connectDB().then(() => {
  app.listen(PORT, () => {
    console.log(`\n🚀  Expensio API running on http://localhost:${PORT}`);
    console.log(`🌍  Environment: ${process.env.NODE_ENV}`);
    console.log(`📊  Health: http://localhost:${PORT}/api/health\n`);
  });
});

/* ── Graceful Shutdown ──────────────────────────────────── */
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  console.log('\n🛑  MongoDB disconnected. Server shutdown.');
  process.exit(0);
});
