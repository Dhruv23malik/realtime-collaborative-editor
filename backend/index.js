const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");

const app = express();
app.use(cors());

const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
  },
});

// In-memory room storage
// rooms = { [roomId]: { code, language, users: Set, messages: [] } }
const rooms = {};

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  socket.on("join-room", (roomId) => {
    if (!roomId) return;

    // Leave previous room if any
    const previousRoom = socket.data.roomId;
    if (previousRoom && rooms[previousRoom]) {
      socket.leave(previousRoom);
      rooms[previousRoom].users.delete(socket.id);
      io.to(previousRoom).emit(
        "users-update",
        rooms[previousRoom].users.size
      );
      if (rooms[previousRoom].users.size === 0) {
        delete rooms[previousRoom];
      }
    }

    socket.join(roomId);
    socket.data.roomId = roomId;

    if (!rooms[roomId]) {
      rooms[roomId] = {
        code: "",
        language: "javascript",
        users: new Set(),
        messages: [],
      };
    }

    const room = rooms[roomId];
    room.users.add(socket.id);

    // Send current room state to the new user
    socket.emit("code-update", room.code);
    socket.emit("initial-messages", room.messages);
    socket.emit("language-change", room.language);

    io.to(roomId).emit("users-update", room.users.size);
  });

  socket.on("code-change", (code) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].code = code;
    socket.to(roomId).emit("code-update", code);
  });

  socket.on("language-change", (language) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].language = language;
    socket.to(roomId).emit("language-change", language);
  });

  socket.on("chat-message", (message) => {
    const roomId = socket.data.roomId;
    if (!roomId || !rooms[roomId]) return;

    rooms[roomId].messages.push(message);
    io.to(roomId).emit("chat-message", message);
  });

  socket.on("disconnect", () => {
    const roomId = socket.data.roomId;
    if (roomId && rooms[roomId]) {
      rooms[roomId].users.delete(socket.id);
      io.to(roomId).emit("users-update", rooms[roomId].users.size);
      if (rooms[roomId].users.size === 0) {
        delete rooms[roomId];
      }
    }
    console.log("User disconnected:", socket.id);
  });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
