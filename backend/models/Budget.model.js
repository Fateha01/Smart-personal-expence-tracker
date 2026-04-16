/* ═══════════════════════════════════════════════════════════
   models/Budget.model.js
   ═══════════════════════════════════════════════════════════ */
'use strict';

const mongoose = require('mongoose');

const budgetSchema = new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
    month: {
      type:     Number,     // 0-11  (JS month index)
      required: true,
      min: 0, max: 11,
    },
    year: {
      type:     Number,
      required: true,
    },
    categories: {
      food:          { type: Number, default: 0, min: 0 },
      transport:     { type: Number, default: 0, min: 0 },
      rent:          { type: Number, default: 0, min: 0 },
      bills:         { type: Number, default: 0, min: 0 },
      shopping:      { type: Number, default: 0, min: 0 },
      health:        { type: Number, default: 0, min: 0 },
      education:     { type: Number, default: 0, min: 0 },
      entertainment: { type: Number, default: 0, min: 0 },
      other:         { type: Number, default: 0, min: 0 },
    },
  },
  {
    timestamps: true,
  }
);

/* ── Unique budget per user per month/year ───────────────── */
budgetSchema.index({ user: 1, month: 1, year: 1 }, { unique: true });

module.exports = mongoose.model('Budget', budgetSchema);
