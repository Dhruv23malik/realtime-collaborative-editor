const mongoose = require("mongoose");

const FileSchema = new mongoose.Schema({
  roomId: {
    type: String,
    required: true,
    index: true,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  path: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    default: "",
  },
  isFolder: {
    type: Boolean,
    default: false,
  },
  parentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "File",
    default: null,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to guarantee name uniqueness per folder directory within a room
FileSchema.index({ roomId: 1, parentId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model("File", FileSchema);
