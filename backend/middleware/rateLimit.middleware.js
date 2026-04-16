/* ═══════════════════════════════════════════════════════════
   middleware/rateLimit.middleware.js
   ═══════════════════════════════════════════════════════════ */
'use strict';

const rateLimit = require('express-rate-limit');

/* ── General API limiter ────────────────────────────────── */
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,  // 15 minutes
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many requests. Please try again later.' },
});

/* ── Strict auth limiter ────────────────────────────────── */
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'Too many login attempts. Please wait 15 minutes.' },
});

module.exports = { apiLimiter, authLimiter };
