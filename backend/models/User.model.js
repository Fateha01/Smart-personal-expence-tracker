/* ═══════════════════════════════════════════════════════════
   models/User.model.js  —  Regular users stored in 'users' collection
   ═══════════════════════════════════════════════════════════ */
'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const userSchema = new mongoose.Schema(
  {
    name: {
      type:     String,
      required: [true, 'Full name is required'],
      trim:     true,
      maxlength: [50, 'Name cannot exceed 50 characters'],
    },
    username: {
      type:      String,
      required:  [true, 'Username is required'],
      unique:    true,
      lowercase: true,
      trim:      true,
      minlength: [3,  'Username must be at least 3 characters'],
      maxlength: [20, 'Username cannot exceed 20 characters'],
      match: [/^[a-z0-9_]+$/, 'Username may only contain lowercase letters, numbers, and underscores'],
    },
    password: {
      type:      String,
      required:  [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select:    false,
    },
    role: {
      type:    String,
      default: 'user',
      enum:    ['user'],         // Only regular users live in this collection
    },
    avatar: {
      type:    String,
      default: '',
    },
    color: {
      type:    String,
      default: '#00d4aa',        // Teal for users
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    collection: 'users',         // Explicit collection name
  }
);

/* ── Pre-save hook: hash password ───────────────────────── */
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.avatar) this.avatar = this.name[0].toUpperCase();
  next();
});

/* ── Instance method: compare password ──────────────────── */
userSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

/* ── Safe public profile ─────────────────────────────────── */
userSchema.methods.toPublic = function () {
  return {
    id:        this._id,
    name:      this.name,
    username:  this.username,
    role:      this.role,
    avatar:    this.avatar,
    color:     this.color,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

module.exports = mongoose.model('User', userSchema, 'users');
