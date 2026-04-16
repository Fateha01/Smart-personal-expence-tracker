/* ═══════════════════════════════════════════════════════════
   controllers/auth.controller.js
   Handles login for both 'users' and 'admins' collections.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const jwt   = require('jsonwebtoken');
const User  = require('../models/User.model');
const Admin = require('../models/Admin.model');

const signToken = (id, role) =>
  jwt.sign({ id, role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '7d' });

const sendToken = (account, statusCode, res) => {
  const token = signToken(account._id, account.role);
  res.status(statusCode).json({ success: true, token, user: account.toPublic() });
};

/* ── POST /api/auth/register  (regular users only) ──────── */
exports.register = async (req, res, next) => {
  try {
    const { name, username, password } = req.body;
    // Registration always creates a regular user in the 'users' collection
    const user = await User.create({ name, username, password, role: 'user' });
    sendToken(user, 201, res);
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/auth/login  (checks both collections) ────── */
exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;
    if (!username || !password)
      return res.status(400).json({ success: false, message: 'Username and password are required.' });

    const uname = username.toLowerCase();

    // 1. Try the 'admins' collection first
    let account = await Admin.findOne({ username: uname }).select('+password');
    // 2. Fall back to 'users' collection
    if (!account) account = await User.findOne({ username: uname }).select('+password');

    if (!account || !(await account.matchPassword(password)))
      return res.status(401).json({ success: false, message: 'Invalid username or password.' });

    if (!account.isActive)
      return res.status(403).json({ success: false, message: 'Account is deactivated. Contact admin.' });

    account.lastLogin = new Date();
    await account.save({ validateBeforeSave: false });

    sendToken(account, 200, res);
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/auth/me ───────────────────────────────────── */
exports.getMe = async (req, res, next) => {
  try {
    res.json({ success: true, user: req.user.toPublic() });
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/auth/me ───────────────────────────────────── */
exports.updateMe = async (req, res, next) => {
  try {
    const { name, color, avatar } = req.body;
    const account = req.user;
    if (name)   account.name   = name;
    if (color)  account.color  = color;
    if (avatar) account.avatar = avatar;
    await account.save();
    res.json({ success: true, user: account.toPublic() });
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/auth/change-password ─────────────────────── */
exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword)
      return res.status(400).json({ success: false, message: 'Both current and new passwords are required.' });
    if (newPassword.length < 6)
      return res.status(400).json({ success: false, message: 'New password must be at least 6 characters.' });

    // Re-fetch with password field
    const Model   = req.user.role === 'admin' ? Admin : User;
    const account = await Model.findById(req.user._id).select('+password');
    if (!(await account.matchPassword(currentPassword)))
      return res.status(401).json({ success: false, message: 'Current password is incorrect.' });

    account.password = newPassword;
    await account.save();
    sendToken(account, 200, res);
  } catch (err) {
    next(err);
  }
};
