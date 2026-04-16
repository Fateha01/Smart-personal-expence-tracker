/* ═══════════════════════════════════════════════════════════
   controllers/budget.controller.js
   Spending calculation now queries all category collections.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const Budget   = require('../models/Budget.model');
const { queryAll } = require('../models/categoryModels');

/* ── GET /api/budgets?month=&year= ─────────────────────── */
exports.get = async (req, res, next) => {
  try {
    const now   = new Date();
    const month = req.query.month !== undefined ? parseInt(req.query.month) : now.getMonth();
    const year  = req.query.year  !== undefined ? parseInt(req.query.year)  : now.getFullYear();

    let budget = await Budget.findOne({ user: req.user._id, month, year });
    if (!budget) budget = { user: req.user._id, month, year, categories: {} };

    // Calculate actual spending from all category collections for that month
    const startDate = new Date(year, month, 1);
    const endDate   = new Date(year, month + 1, 0, 23, 59, 59);

    const allSpend = await queryAll({
      user: req.user._id,
      type: 'expense',
      date: { $gte: startDate, $lte: endDate },
    });

    const spentMap = {};
    allSpend.forEach(t => {
      spentMap[t.category] = (spentMap[t.category] || 0) + t.amount;
    });

    res.json({
      success: true,
      data: { month, year, categories: budget.categories || {}, spent: spentMap },
    });
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/budgets ───────────────────────────────────── */
exports.upsert = async (req, res, next) => {
  try {
    const now        = new Date();
    const month      = req.body.month !== undefined ? parseInt(req.body.month) : now.getMonth();
    const year       = req.body.year  !== undefined ? parseInt(req.body.year)  : now.getFullYear();
    const categories = req.body.categories || {};

    for (const key of Object.keys(categories)) {
      categories[key] = Math.max(0, Number(categories[key]) || 0);
    }

    const budget = await Budget.findOneAndUpdate(
      { user: req.user._id, month, year },
      { $set: { categories } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );

    res.json({ success: true, data: budget });
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/budgets?month=&year= ──────────────────── */
exports.remove = async (req, res, next) => {
  try {
    const { month, year } = req.query;
    await Budget.findOneAndDelete({ user: req.user._id, month: parseInt(month), year: parseInt(year) });
    res.json({ success: true, message: 'Budget cleared.' });
  } catch (err) {
    next(err);
  }
};
