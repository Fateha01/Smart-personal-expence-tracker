/* ═══════════════════════════════════════════════════════════
   models/Admin.model.js  —  Admin users stored in 'admins' collection
   ═══════════════════════════════════════════════════════════ */
'use strict';

const mongoose = require('mongoose');
const bcrypt   = require('bcryptjs');

const adminSchema = new mongoose.Schema(
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
      default: 'admin',
      enum:    ['admin'],        // Only admins live in this collection
    },
    avatar: {
      type:    String,
      default: '',
    },
    color: {
      type:    String,
      default: '#fbbf24',        // Gold for admins
    },
    isActive: {
      type:    Boolean,
      default: true,
    },
    lastLogin: { type: Date },
  },
  {
    timestamps: true,
    collection: 'admins',       // Explicit collection name
  }
);

/* ── Pre-save: hash password ─────────────────────────────── */
adminSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  if (!this.avatar) this.avatar = this.name[0].toUpperCase();
  next();
});

/* ── Instance method: compare password ──────────────────── */
adminSchema.methods.matchPassword = async function (entered) {
  return bcrypt.compare(entered, this.password);
};

/* ── Safe public profile ─────────────────────────────────── */
adminSchema.methods.toPublic = function () {
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

module.exports = mongoose.model('Admin', adminSchema, 'admins');
