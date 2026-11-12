require("dotenv").config();
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const connectDB = require("./config/db");
const Room = require("./models/Room");
const Message = require("./models/Message");
const User = require("./models/User");
const File = require("./models/File");
const authRoutes = require("./routes/auth");
const runRoutes = require("./routes/run");

const app = express();

// FIX: previously this reflected ANY origin back with credentials: true,
// so any website could make credentialed requests to the API on a logged-in
// user's behalf. Now only trusted origins are allowed: the CORS_ORIGIN env
// var (comma-separated, set on Render), the deployed Vercel frontend and its
// preview deployments, and localhost for development. Requests with no
// Origin header (curl, server-to-server, /health checks) are still allowed.
const allowedOrigins = new Set(
  (process.env.CORS_ORIGIN || "https://realtime-collaborative-editor-flame.vercel.app,http://localhost:5173,http://localhost:3000")
    .split(",")
    .map((o) => o.trim())
    .filter(Boolean)
);

const corsOriginCheck = (origin, callback) => {
  if (!origin) return callback(null, true);
  try {
    const url = new URL(origin);
    const isLocalhost = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const isVercelPreview =
      url.hostname === "realtime-collaborative-editor-flame.vercel.app" ||
      url.hostname.endsWith(".vercel.app");
    if (allowedOrigins.has(origin) || isLocalhost || isVercelPreview) {
      return callback(null, true);
    }
  } catch (_) {
    // fall through to rejection below
  }
  callback(new Error(`CORS blocked origin: ${origin}`));
};

app.use(
  cors({
    origin: corsOriginCheck,
    methods: ["GET", "POST"],
    credentials: true,
  })
);
app.use(express.json()); // Mount JSON body parser

app.get("/health", (_req, res) => {
  const mongoose = require("mongoose");
  res.status(200).json({
    ok: true,
    db: mongoose.connection.readyState === 1 ? "connected" : "disconnected",
  });
});

// In-memory fallback room state, used only while MongoDB is unavailable so
// a visitor still gets an editor instead of an endless loading screen.
// keyed by roomId -> { files: [...], language, messages: [] }
const fallbackRooms = {};
const fallbackWelcomeFile = (roomId) => ({
  _id: `fallback-welcome-${roomId}`,
  roomId,
  name: "welcome.js",
  path: "/welcome.js",
  content: `// 🚀 Welcome to Collaborative Studio!\n\n// The database is unreachable right now, so this room is running\n// in temporary mode — your edits will sync live, but they won't be\n// saved. Check back once the database is back online.\n\nfunction welcomeCollaborator() {\n  console.log("Happy coding!");\n}\n\nwelcomeCollaborator();\n`,
  isFolder: false,
  parentId: null,
});
const getFallbackRoom = (roomId) => {
  if (!fallbackRooms[roomId]) {
    fallbackRooms[roomId] = {
      files: [fallbackWelcomeFile(roomId)],
      language: "javascript",
      messages: [],
    };
  }
  return fallbackRooms[roomId];
};

// Escape user-controlled file paths before they are used in a RegExp.
// FIX: a file named e.g. "a.js" made `^/a.js/` match "/aXjs/" too, so a
// rename/delete/move could touch the wrong files.
const escapeRegExp = (str) => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const isDbUp = () => require("mongoose").connection.readyState === 1;

// Mount REST auth routes
app.use("/api/auth", authRoutes);
app.use("/api/run", runRoutes);

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: corsOriginCheck,
    methods: ["GET", "POST"],
    credentials: true,
  },
});

// Establish MongoDB connection
if (!process.env.MONGODB_URI) {
  console.warn("⚠️ MONGODB_URI environment variable is missing. Falling back to local MongoDB: mongodb://127.0.0.1:27017/collaborative-editor");
}
connectDB();

// In-memory registry for socket presence tracking (who is currently online where)
// rooms = { [roomId]: { users: Map(socketId -> user) } }
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", async (data) => {
    let roomId = "";
    let clientUser = null;

    // Support both payload objects { roomId, user } and legacy roomId string
    if (data && typeof data === "object") {
      roomId = data.roomId;
      clientUser = data.user;
    } else {
      roomId = data;
    }

    if (!roomId) return;

    // Presence management: leave previous room if any
    const previousRoom = socket.data.roomId;
    if (previousRoom && rooms[previousRoom]) {
      socket.leave(previousRoom);
      rooms[previousRoom].users.delete(socket.id);
      io.to(previousRoom).emit("users-update", Array.from(rooms[previousRoom].users.values()));
      if (rooms[previousRoom].users.size === 0) {
        delete rooms[previousRoom];
      }
    }

    // Join new room socket
    socket.join(roomId);
    socket.data.roomId = roomId;

    // Assign Guest account if unauthenticated
    if (!clientUser) {
      const randId = Math.floor(Math.random() * 1000);
      clientUser = {
        userId: `guest_${socket.id}`,
        username: `Guest-${randId}`,
        avatar: `https://avatar.iran.liara.run/public/${randId % 100}`,
      };
    }
    clientUser.socketId = socket.id;
    socket.data.user = clientUser;

    // Track active presence in-memory (Map: socket.id -> user object)
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: new Map(),
      };
    }
    const roomPresence = rooms[roomId];
    roomPresence.users.set(socket.id, clientUser);

    try {
      // FIX: previously this fast-failed with only an error-message and no
      // file-tree, so the frontend (which only clears its loading screen on
      // file-tree) sat on "Connecting Workspace" forever. Now a DB outage
      // serves a temporary in-memory room instead: the editor loads, live
      // sync still works, and the user is told edits won't be saved.
      const mongoose = require("mongoose");
      if (mongoose.connection.readyState !== 1) {
        const fallback = getFallbackRoom(roomId);
        socket.emit("file-tree", fallback.files);
        socket.emit("language-change", fallback.language);
        socket.emit("chat-history", fallback.messages);
        io.to(roomId).emit("users-update", Array.from(roomPresence.users.values()));
        socket.emit(
          "error-message",
          "Database is not connected — running in temporary mode, edits won't be saved. Please check MONGODB_URI on Render."
        );
        return;
      }

      // 1. Fetch or create Room record from MongoDB
      let room = await Room.findOne({ roomId });
      if (!room) {
        room = await Room.create({
          roomId,
          code: "",
          language: "javascript",
          updatedAt: new Date(),
        });
      }

      // 2. Fetch or create File Tree in MongoDB
      let files = await File.find({ roomId });
      if (files.length === 0) {
        // Bootstrap a default starter project structure
        const welcomeFile = await File.create({
          roomId,
          name: "welcome.js",
          path: "/welcome.js",
          content: `// 🚀 Welcome to Collaborative Studio!\n\n// Create files and folders inside the explorer sidebar.\n// Code edits and operations sync in real time across the room.\n\nfunction welcomeCollaborator() {\n  console.log("Happy coding!");\n}\n\nwelcomeCollaborator();\n`,
          isFolder: false,
          parentId: null,
        });
        files = [welcomeFile];
      }

      // 3. Fetch last 50 chat messages from Message model (private or public)
      const username = clientUser ? clientUser.username : "";
      const messageHistory = await Message.find({
        roomId,
        $or: [
          { isPrivate: { $ne: true } },
          { user: username },
          { toUser: username }
        ]
      })
        .sort({ timestamp: -1 })
        .limit(50);

      // Emit room states to the joining client
      socket.emit("file-tree", files);
      socket.emit("language-change", room.language);
      socket.emit("chat-history", messageHistory.reverse());

      // Update room presence for all room members
      io.to(roomId).emit("users-update", Array.from(roomPresence.users.values()));
    } catch (err) {
      console.error("Error loading room data from MongoDB:", err);
    }
  });

  socket.on("file-create", async ({ name, isFolder, parentId, content }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!isDbUp()) return socket.emit("error-message", "Database is not connected — cannot create files in temporary mode.");

    try {
      let parentPath = "";
      if (parentId) {
        const parent = await File.findById(parentId);
        if (parent) {
          parentPath = parent.path;
        }
      }
      const filePath = `${parentPath}/${name}`;

      const newFile = await File.create({
        roomId,
        name,
        path: filePath,
        isFolder,
        parentId: parentId || null,
        content: content || "",
      });

      io.to(roomId).emit("file-created", newFile);
    } catch (err) {
      console.error("Error creating file in database:", err);
      socket.emit("error-message", "Failed to create file/folder (duplicate name?).");
    }
  });

  // Dynamic File Renaming (including recursive path relocations for nested assets)
  socket.on("file-rename", async ({ fileId, newName }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!isDbUp()) return socket.emit("error-message", "Database is not connected — cannot rename in temporary mode.");

    try {
      const file = await File.findById(fileId);
      if (!file) return;

      const oldPath = file.path;
      const pathParts = file.path.split("/");
      pathParts[pathParts.length - 1] = newName;
      const newPath = pathParts.join("/");

      file.name = newName;
      file.path = newPath;
      file.updatedAt = new Date();
      await file.save();

      // If a folder has been renamed, recalculate paths of all children recursively
      if (file.isFolder) {
        const children = await File.find({ roomId, path: new RegExp(`^${escapeRegExp(oldPath)}/`) });
        for (const child of children) {
          child.path = child.path.replace(new RegExp(`^${escapeRegExp(oldPath)}`), newPath);
          await child.save();
        }
      }

      // Re-emit updated tree to all participants
      const updatedTree = await File.find({ roomId });
      io.to(roomId).emit("file-tree", updatedTree);
    } catch (err) {
      console.error("Error renaming file in database:", err);
      socket.emit("error-message", "Failed to rename file/folder.");
    }
  });

  // Dynamic File Deletion (recursively cleaning up child assets)
  socket.on("file-delete", async ({ fileId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!isDbUp()) return socket.emit("error-message", "Database is not connected — cannot delete in temporary mode.");

    try {
      const file = await File.findById(fileId);
      if (!file) return;

      const oldPath = file.path;

      // Recursive deletions if folder node
      if (file.isFolder) {
        await File.deleteMany({ roomId, path: new RegExp(`^${escapeRegExp(oldPath)}/`) });
      }
      await File.findByIdAndDelete(fileId);

      io.to(roomId).emit("file-deleted", fileId);
    } catch (err) {
      console.error("Error deleting file from database:", err);
      socket.emit("error-message", "Failed to delete file/folder.");
    }
  });

  // Scoped Code Edits (updates individual file document contents)
  socket.on("code-change", async (data) => {
    const roomId = socket.data.roomId;
    let fileId = data?.fileId;
    let code = data?.code;

    // Handles older payload formats for safety
    if (data && typeof data === "object" && data.fileId === undefined) {
      console.warn("Received legacy code-change payload without fileId scoping.");
      return;
    }

    if (!roomId || !fileId) return;

    // Scoped broadcast: notify other room users
    socket.to(roomId).emit("code-update", { fileId, code });

    // In temporary (no-DB) mode, live sync still works — just skip persisting.
    if (!isDbUp()) return;

    // Asynchronously commit changes to MongoDB
    try {
      await File.findByIdAndUpdate(fileId, { content: code, updatedAt: new Date() });
    } catch (err) {
      console.error("Failed to persist code to MongoDB File record:", err);
    }
  });

  socket.on("language-change", async (data) => {
    let roomId = socket.data.roomId;
    let language = data;

    if (data && typeof data === "object" && data.language !== undefined) {
      if (data.roomId) roomId = data.roomId;
      language = data.language;
    }

    if (!roomId) return;

    socket.to(roomId).emit("language-change", language);

    if (!isDbUp()) return;

    try {
      await Room.findOneAndUpdate(
        { roomId },
        { language, updatedAt: new Date() },
        { upsert: true, new: true }
      );
    } catch (err) {
      console.error("Failed to persist language to MongoDB:", err);
    }
  });

  socket.on("chat-message", async (data) => {
    let roomId = socket.data.roomId;
    let user = data.user;
    let text = data.text;
    let toUser = data.toUser || null;
    let isPrivate = data.isPrivate || false;

    if (data && data.roomId) {
      roomId = data.roomId;
      user = data.user;
      text = data.text;
    }

    if (!roomId || !user || !text) return;

    // Temporary (no-DB) mode: keep chat working in memory instead of
    // buffering a Mongoose save that will never complete.
    if (!isDbUp()) {
      const fallback = getFallbackRoom(roomId);
      const msg = { user, toUser, isPrivate, text, timestamp: new Date() };
      fallback.messages.push(msg);
      if (fallback.messages.length > 50) fallback.messages.shift();
      if (isPrivate && toUser) {
        const sockets = await io.in(roomId).fetchSockets();
        sockets.forEach((s) => {
          const sUsername = s.data.user ? s.data.user.username : "";
          if (sUsername === toUser || sUsername === user) s.emit("chat-message", msg);
        });
      } else {
        io.to(roomId).emit("chat-message", msg);
      }
      return;
    }

    try {
      // 1. Create and save the message in Mongoose model
      const newMessage = new Message({
        roomId,
        user,
        toUser,
        isPrivate,
        text,
        timestamp: new Date(),
      });
      await newMessage.save();

      // 2. Broadcast/send the message to target user or all users in the room
      if (isPrivate && toUser) {
        const sockets = await io.in(roomId).fetchSockets();
        sockets.forEach((s) => {
          const sUser = s.data.user;
          const sUsername = sUser ? sUser.username : "";
          if (sUsername === toUser || sUsername === user) {
            s.emit("chat-message", {
              user: newMessage.user,
              toUser: newMessage.toUser,
              isPrivate: newMessage.isPrivate,
              text: newMessage.text,
              timestamp: newMessage.timestamp,
            });
          }
        });
      } else {
        io.to(roomId).emit("chat-message", {
          user: newMessage.user,
          toUser: newMessage.toUser,
          isPrivate: newMessage.isPrivate,
          text: newMessage.text,
          timestamp: newMessage.timestamp,
        });
      }
    } catch (err) {
      console.error("Failed to save chat message to MongoDB:", err);
    }
  });

  socket.on("file-move", async ({ fileId, newParentId }) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    if (!isDbUp()) return socket.emit("error-message", "Database is not connected — cannot move files in temporary mode.");

    try {
      const file = await File.findById(fileId);
      if (!file) return;

      let parentPath = "";
      if (newParentId) {
        const parent = await File.findById(newParentId);
        if (parent && parent.isFolder) {
          parentPath = parent.path;
        } else {
          return socket.emit("error-message", "Invalid parent folder selected.");
        }
      }

      const oldPath = file.path;
      const newPath = `${parentPath}/${file.name}`;

      file.parentId = newParentId || null;
      file.path = newPath;
      file.updatedAt = new Date();
      await file.save();

      // Recalculate paths of nested files/folders recursively
      if (file.isFolder) {
        const children = await File.find({ roomId, path: new RegExp(`^${escapeRegExp(oldPath)}/`) });
        for (const child of children) {
          child.path = child.path.replace(new RegExp(`^${escapeRegExp(oldPath)}`), newPath);
          await child.save();
        }
      }

      // Re-emit updated tree to all participants
      const updatedTree = await File.find({ roomId });
      io.to(roomId).emit("file-tree", updatedTree);
    } catch (err) {
      console.error("Error moving file in database:", err);
      socket.emit("error-message", "Failed to move file/folder.");
    }
  });

  socket.on("cursor-activity", (data) => {
    const roomId = socket.data.roomId;
    if (!roomId) return;
    socket.to(roomId).emit("cursor-update", {
      socketId: socket.id,
      user: socket.data.user || { username: "Guest" },
      ...data,
    });
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users.delete(socket.id);
      
      // Emit updated active collaborator list
      io.to(roomId).emit("users-update", Array.from(rooms[roomId].users.values()));

      // Clean up in-memory registry when empty
      if (rooms[roomId].users.size === 0) {
        delete rooms[roomId];
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

