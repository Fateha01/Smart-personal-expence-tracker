/* ═══════════════════════════════════════════════════════════
   controllers/admin.controller.js  —  Admin-only endpoints
   Uses separate 'users' and 'admins' collections.
   Uses per-category transaction collections.
   ═══════════════════════════════════════════════════════════ */
'use strict';

const User                                 = require('../models/User.model');
const Admin                                = require('../models/Admin.model');
const Budget                               = require('../models/Budget.model');
const { categoryModels, CATEGORIES, queryAll } = require('../models/categoryModels');

/* ── GET /api/admin/stats ───────────────────────────────── */
exports.getStats = async (req, res, next) => {
  try {
    // Count docs across all category collections
    const counts = await Promise.all(CATEGORIES.map(cat => categoryModels[cat].countDocuments()));
    const totalTransactions = counts.reduce((s, c) => s + c, 0);

    // Sum income/expense across all collections
    const [totalUsers, totalAdmins, allTx] = await Promise.all([
      User.countDocuments(),
      Admin.countDocuments(),
      queryAll({}),
    ]);

    let totalIncome = 0, totalExpense = 0;
    allTx.forEach(t => {
      if (t.type === 'income')  totalIncome  += t.amount;
      if (t.type === 'expense') totalExpense += t.amount;
    });

    res.json({
      success: true,
      data: {
        totalUsers:       totalUsers + totalAdmins,
        regularUsers:     totalUsers,
        adminUsers:       totalAdmins,
        totalTransactions,
        totalIncome,
        totalExpense,
        netBalance: totalIncome - totalExpense,
      },
    });
  } catch (err) {
    next(err);
  }
};

/* ── GET /api/admin/users ───────────────────────────────── */
exports.getUsers = async (req, res, next) => {
  try {
    // Fetch from both collections and merge
    const [users, admins] = await Promise.all([
      User.find().sort({ createdAt: -1 }).lean(),
      Admin.find().sort({ createdAt: -1 }).lean(),
    ]);

    const format = u => ({
      id:        u._id,
      name:      u.name,
      username:  u.username,
      role:      u.role,
      avatar:    u.avatar,
      color:     u.color,
      isActive:  u.isActive,
      lastLogin: u.lastLogin,
      createdAt: u.createdAt,
    });

    const all = [...admins.map(format), ...users.map(format)]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({ success: true, count: all.length, total: all.length, data: all });
  } catch (err) {
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/role ────────────────────── */
exports.changeRole = async (req, res, next) => {
  try {
    const { role } = req.body;
    if (!['user', 'admin'].includes(role))
      return res.status(400).json({ success: false, message: 'Role must be "user" or "admin".' });

    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'You cannot change your own role.' });

    // Try both collections
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true }) ||
                 await Admin.findByIdAndUpdate(req.params.id, { role }, { new: true });
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    res.json({ success: true, data: user.toPublic() });
  } catch (err) {
    next(err);
  }
};

/* ── PATCH /api/admin/users/:id/toggle-active ───────────── */
exports.toggleActive = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot deactivate yourself.' });

    let account = await User.findById(req.params.id) || await Admin.findById(req.params.id);
    if (!account) return res.status(404).json({ success: false, message: 'User not found.' });

    account.isActive = !account.isActive;
    await account.save({ validateBeforeSave: false });

    res.json({ success: true, data: { id: account._id, isActive: account.isActive } });
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/admin/users/:id ────────────────────────── */
exports.deleteUser = async (req, res, next) => {
  try {
    if (req.params.id === req.user._id.toString())
      return res.status(400).json({ success: false, message: 'Cannot delete yourself.' });

    const user = await User.findByIdAndDelete(req.params.id) ||
                 await Admin.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: 'User not found.' });

    // Cascade delete from all category collections
    await Promise.all(
      CATEGORIES.map(cat => categoryModels[cat].deleteMany({ user: req.params.id }))
    );
    await Budget.deleteMany({ user: req.params.id });

    res.json({ success: true, message: `User "${user.username}" and all their data deleted.` });
  } catch (err) {
    next(err);
  }
};

/* ── DELETE /api/admin/reset-all ────────────────────────── */
exports.resetAll = async (req, res, next) => {
  try {
    await Promise.all([
      ...CATEGORIES.map(cat => categoryModels[cat].deleteMany({})),
      Budget.deleteMany({}),
    ]);
    res.json({ success: true, message: 'All transactions and budgets wiped from all collections.' });
  } catch (err) {
    next(err);
  }
};
