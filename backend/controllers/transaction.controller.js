/* ═══════════════════════════════════════════════════════════
   controllers/transaction.controller.js
   Each category has its own MongoDB collection.
   Routes CRUD operations to the correct category model.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const { getModel, queryAll, findAcrossAll, CATEGORIES } = require('../models/categoryModels');

/* ── GET /api/transactions ──────────────────────────────── */
exports.getAll = async (req, res, next) => {
  try {
    const { type, category, from, to, search } = req.query;

    // Base filter for this user
    const filter = { user: req.user._id };
    if (type) filter.type = type;
    if (from || to) {
      filter.date = {};
      if (from) filter.date.$gte = new Date(from);
      if (to)   filter.date.$lte = new Date(to + 'T23:59:59');
    }
    if (search) filter.description = { $regex: search, $options: 'i' };

    let txs;

    if (category && CATEGORIES.includes(category.toLowerCase())) {
      // Query only the specific category collection
      const Model = getModel(category);
      txs = await Model.find(filter).sort({ date: -1, createdAt: -1 }).lean();
      txs = txs.map(t => ({ ...t, category: category.toLowerCase() }));
    } else {
      // Query all 10 category collections and merge
      txs = await queryAll(filter);
    }

    res.json({
      success: true,
      count: txs.length,
      total: txs.length,
      data:  txs,
    });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/transactions/:id ──────────────────────────── */
exports.getOne = async (req, res, next) => {
  try {
    // category hint via query param speeds up lookup: ?category=food
    const { category } = req.query;
    let tx;

    if (category && CATEGORIES.includes(category.toLowerCase())) {
      const Model = getModel(category);
      tx = await Model.findOne({ _id: req.params.id, user: req.user._id }).lean();
      if (tx) tx.category = category.toLowerCase();
    } else {
      tx = await findAcrossAll(req.params.id, req.user._id);
    }

    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    res.json({ success: true, data: tx });
  } catch (err) {
    next(err);
  }
};

/* ── POST /api/transactions ─────────────────────────────── */
exports.create = async (req, res, next) => {
  try {
    const { amount, type, category, description, date, tags } = req.body;

    if (!category || !CATEGORIES.includes(category.toLowerCase()))
      return res.status(400).json({ success: false, message: `Invalid category. Choose from: ${CATEGORIES.join(', ')}` });

    const Model = getModel(category);
    const tx = await Model.create({
      user:        req.user._id,
      amount:      Number(amount),
      type,
      category:    category.toLowerCase(),
      description: description || '',
      date:        date ? new Date(date) : new Date(),
      tags:        tags || [],
    });

    res.status(201).json({ success: true, data: { ...tx.toObject(), category: category.toLowerCase() } });
  } catch (err) {
    next(err);
  }
};

/* ── PUT /api/transactions/:id ──────────────────────────── */
exports.update = async (req, res, next) => {
  try {
    const { amount, type, category, description, date, tags } = req.body;

    // category is required to know which collection to update in
    if (!category || !CATEGORIES.includes(category.toLowerCase()))
      return res.status(400).json({ success: false, message: 'Category is required for update.' });

    const Model = getModel(category);
    const update = {};
    if (amount      !== undefined) update.amount      = Number(amount);
    if (type        !== undefined) update.type        = type;
    if (description !== undefined) update.description = description;
    if (date        !== undefined) update.date        = new Date(date);
    if (tags        !== undefined) update.tags        = tags;

    const tx = await Model.findOneAndUpdate(
      { _id: req.params.id, user: req.user._id },
      update,
      { new: true, runValidators: true }
    ).lean();

    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });
    res.json({ success: true, data: { ...tx, category: category.toLowerCase() } });
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/transactions/:id ───────────────────────── */
exports.remove = async (req, res, next) => {
  try {
    const { category } = req.query;

    if (!category || !CATEGORIES.includes(category.toLowerCase()))
      return res.status(400).json({ success: false, message: 'Category query param is required for delete.' });

    const Model = getModel(category);
    const tx = await Model.findOneAndDelete({ _id: req.params.id, user: req.user._id });
    if (!tx) return res.status(404).json({ success: false, message: 'Transaction not found.' });

    res.json({ success: true, message: 'Transaction deleted.' });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/transactions/summary ─────────────────────── */
exports.summary = async (req, res, next) => {
  try {
    const allTx = await queryAll({ user: req.user._id });
    const summary = { income: 0, expense: 0, incomeCount: 0, expenseCount: 0 };
    allTx.forEach(t => {
      if (t.type === 'income')  { summary.income  += t.amount; summary.incomeCount++;  }
      if (t.type === 'expense') { summary.expense += t.amount; summary.expenseCount++; }
    });
    summary.balance     = summary.income - summary.expense;
    summary.safeToSpend = Math.max(0, summary.balance);
    res.json({ success: true, data: summary });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/transactions/by-category ─────────────────── */
exports.byCategory = async (req, res, next) => {
  try {
    const allTx = await queryAll({ user: req.user._id, type: 'expense' });
    const map = {};
    allTx.forEach(t => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    const result = Object.entries(map)
      .map(([_id, total]) => ({ _id, total }))
      .sort((a, b) => b.total - a.total);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/transactions/monthly?year= ───────────────── */
exports.monthly = async (req, res, next) => {
  try {
    const year = parseInt(req.query.year) || new Date().getFullYear();
    const allTx = await queryAll({
      user: req.user._id,
      date: { $gte: new Date(`${year}-01-01`), $lte: new Date(`${year}-12-31T23:59:59`) },
    });

    const monthly = Array.from({ length: 12 }, (_, i) => ({ month: i + 1, income: 0, expense: 0 }));
    allTx.forEach(t => {
      const m = new Date(t.date).getMonth(); // 0-indexed
      monthly[m][t.type] += t.amount;
    });

    res.json({ success: true, year, data: monthly });
  } catch (err) {
    next(err);
  }
};
