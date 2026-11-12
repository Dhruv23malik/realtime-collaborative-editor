const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI specified in MONGODB_URI environment variable,
 * or falls back to a local MongoDB server for development convenience.
 *
 * FIX: previously this called process.exit(1) on a failed connection, so a
 * missing/expired/unreachable MongoDB killed the whole backend (and Render
 * kept restarting it into the same crash). Now it logs the error, stays up
 * so /health and the socket server still respond, and retries in the
 * background. Socket handlers check mongoose.connection.readyState and
 * serve a degraded in-memory room until the DB comes back.
 */
let retryTimer = null;

const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/collaborative-editor";
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
    if (retryTimer) {
      clearTimeout(retryTimer);
      retryTimer = null;
    }
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    console.error("Backend stays up without a database; retrying MongoDB in 10s.");
    if (!retryTimer) {
      retryTimer = setTimeout(() => {
        retryTimer = null;
        connectDB();
      }, 10000);
      // Don't keep the process alive just for the retry timer.
      if (typeof retryTimer.unref === "function") retryTimer.unref();
    }
  }
};

module.exports = connectDB;
