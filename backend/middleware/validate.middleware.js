/* ═══════════════════════════════════════════════════════════
   middleware/validate.middleware.js  —  Input sanitisation
   ═══════════════════════════════════════════════════════════ */
'use strict';

const validator = require('validator');

/* ── Sanitise string fields to prevent XSS ──────────────── */
const sanitiseBody = (req, res, next) => {
  const sanitise = (obj) => {
    for (const key of Object.keys(obj)) {
      if (typeof obj[key] === 'string') {
        obj[key] = validator.escape(obj[key].trim());
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        sanitise(obj[key]);
      }
    }
  };
  if (req.body) sanitise(req.body);
  next();
};

/* ── Validate transaction body ───────────────────────────── */
const validateTransaction = (req, res, next) => {
  const { amount, type, category, date } = req.body;
  const errors = [];

  if (!amount || isNaN(Number(amount)) || Number(amount) <= 0)
    errors.push('Amount must be a positive number.');
  if (!type || !['income', 'expense'].includes(type))
    errors.push('Type must be "income" or "expense".');
  if (!category)
    errors.push('Category is required.');
  if (!date || isNaN(Date.parse(date)))
    errors.push('A valid date is required.');

  if (errors.length) {
    return res.status(400).json({ success: false, message: errors.join(' ') });
  }
  next();
};

/* ── Validate budget body ────────────────────────────────── */
const validateBudget = (req, res, next) => {
  const { month, year } = req.body;
  if (month === undefined || year === undefined) {
    return res.status(400).json({ success: false, message: 'Month and year are required.' });
  }
  if (month < 0 || month > 11) {
    return res.status(400).json({ success: false, message: 'Month must be between 0 and 11.' });
  }
  next();
};

module.exports = { sanitiseBody, validateTransaction, validateBudget };
