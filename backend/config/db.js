/* ═══════════════════════════════════════════════════════════
   config/db.js  —  Mongoose connection helper
   ═══════════════════════════════════════════════════════════ */
'use strict';

const mongoose = require('mongoose');
const dns      = require('dns');

/**
 * Connect to MongoDB Atlas
 * Includes DNS hack for Windows Node.js resolution issues
 */
const connectDB = async () => {
  try {
    const uri = process.env.MONGO_URI;
    if (!uri) throw new Error('MONGO_URI is not defined in .env');

    // Fix for Node.js DNS resolution issues on some Windows environments
    dns.setServers(['8.8.8.8', '8.8.4.4']);

    mongoose.set('strictQuery', true);

    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000,
      socketTimeoutMS: 45000,
      family: 4, // Force IPv4 to avoid some resolution lag
    });

    console.log(`✅  MongoDB connected → ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`❌  MongoDB connection error: ${err.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
