/* ═══════════════════════════════════════════════════════════
   models/categoryModels.js
   One MongoDB collection per transaction category.
   Collections: food_transactions, transport_transactions, etc.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const mongoose = require('mongoose');

/* ── Shared base schema for every category collection ────── */
const makeTxSchema = (categoryName) => new mongoose.Schema(
  {
    user: {
      type:     mongoose.Schema.Types.ObjectId,
      ref:      'User',
      required: true,
      index:    true,
    },
    amount: {
      type:     Number,
      required: [true, 'Amount is required'],
      min:      [0.01, 'Amount must be greater than 0'],
    },
    type: {
      type:     String,
      enum:     ['income', 'expense'],
      required: [true, 'Transaction type is required'],
    },
    // Category is fixed per collection — stored for convenience in responses
    category: {
      type:    String,
      default: categoryName,
      enum:    [categoryName],
    },
    description: {
      type:      String,
      trim:      true,
      default:   '',
      maxlength: [120, 'Description cannot exceed 120 characters'],
    },
    date: {
      type:     Date,
      required: [true, 'Date is required'],
      default:  Date.now,
    },
    tags: {
      type:    [String],
      default: [],
    },
  },
  {
    timestamps: true,
    toJSON:     { virtuals: true },
    toObject:   { virtuals: true },
  }
);

/* ── Category list (must match frontend CATEGORIES array) ── */
const CATEGORIES = [
  'food',
  'transport',
  'rent',
  'bills',
  'shopping',
  'health',
  'education',
  'entertainment',
  'salary',
  'gifts',
];

/* ── Build a Mongoose model for each category ───────────── */
const categoryModels = {};

CATEGORIES.forEach((cat) => {
  const schema = makeTxSchema(cat);

  // Compound indexes for fast per-user queries
  schema.index({ user: 1, date: -1 });
  schema.index({ user: 1, type: 1 });

  const modelName     = cat.charAt(0).toUpperCase() + cat.slice(1) + 'Transaction';
  const collectionName = cat + '_transactions';   // e.g. food_transactions

  categoryModels[cat] = mongoose.model(modelName, schema, collectionName);
});

/* ── Helper: get model by category string ───────────────── */
function getModel(category) {
  const model = categoryModels[category?.toLowerCase()];
  if (!model) throw new Error(`Unknown category: "${category}"`);
  return model;
}

/* ── Helper: query ALL category collections ─────────────── */
async function queryAll(filter = {}, sort = { date: -1 }) {
  const results = await Promise.all(
    CATEGORIES.map((cat) =>
      categoryModels[cat]
        .find(filter)
        .sort(sort)
        .lean()
        .then((docs) => docs.map((d) => ({ ...d, category: cat })))
    )
  );
  // Flatten and sort by date desc
  return results
    .flat()
    .sort((a, b) => new Date(b.date) - new Date(a.date));
}

/* ── Helper: find a single doc across all collections ──── */
async function findAcrossAll(docId, userId) {
  const searches = CATEGORIES.map((cat) =>
    categoryModels[cat]
      .findOne({ _id: docId, user: userId })
      .lean()
      .then((doc) => (doc ? { ...doc, category: cat } : null))
  );
  const results = await Promise.all(searches);
  return results.find((r) => r !== null) || null;
}

module.exports = { categoryModels, CATEGORIES, getModel, queryAll, findAcrossAll };
