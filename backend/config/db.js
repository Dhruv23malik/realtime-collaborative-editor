const mongoose = require("mongoose");

/**
 * Connects to MongoDB using the URI specified in MONGODB_URI environment variable,
 * or falls back to a local MongoDB server for development convenience.
 */
const connectDB = async () => {
  try {
    const uri = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/collaborative-editor";
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
