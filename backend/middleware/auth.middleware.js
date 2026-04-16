/* ═══════════════════════════════════════════════════════════
   middleware/auth.middleware.js  —  JWT verification
   Looks up token owner in 'admins' first, then 'users'.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const jwt   = require('jsonwebtoken');
const User  = require('../models/User.model');
const Admin = require('../models/Admin.model');

/* ── protect: require valid JWT ─────────────────────────── */
const protect = async (req, res, next) => {
  let token;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    token = authHeader.split(' ')[1];
  }

  if (!token) {
    return res.status(401).json({ success: false, message: 'Not authorised — no token provided.' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Try the 'admins' collection first (role hint in token speeds this up)
    let account = null;
    if (decoded.role === 'admin') {
      account = await Admin.findById(decoded.id).select('-password');
    } else {
      account = await User.findById(decoded.id).select('-password');
    }

    // Fallback: search both if role hint mismatch
    if (!account) {
      account = await Admin.findById(decoded.id).select('-password') ||
                await User.findById(decoded.id).select('-password');
    }

    if (!account) {
      return res.status(401).json({ success: false, message: 'User no longer exists.' });
    }
    if (!account.isActive) {
      return res.status(403).json({ success: false, message: 'Account has been deactivated.' });
    }

    req.user = account;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token.' });
  }
};

/* ── adminOnly: require admin role ─────────────────────── */
const adminOnly = (req, res, next) => {
  if (req.user && req.user.role === 'admin') return next();
  return res.status(403).json({ success: false, message: 'Admin access required.' });
};

module.exports = { protect, adminOnly };
