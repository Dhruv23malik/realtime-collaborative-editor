const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  user: {
    type: String,
    required: true,
  },
  toUser: {
    type: String, // Target username/ID for DMs
    default: null,
  },
  isPrivate: {
    type: Boolean,
    default: false,
  },
  text: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model("Message", MessageSchema);
