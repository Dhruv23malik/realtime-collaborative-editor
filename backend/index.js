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

const users = new Set();
let currentCode = "";
let messages = [];

io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  users.add(socket.id);
  io.emit("users-update", users.size);

  socket.emit("code-update", currentCode);
  socket.emit("initial-messages", messages);

  socket.on("code-update", (code) => {
    currentCode = code;
    socket.broadcast.emit("code-update", code);
  });

  socket.on("chat-message", (message) => {
    messages.push(message);
    io.emit("chat-message", message);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);
    users.delete(socket.id);
    io.emit("users-update", users.size);
  });
});

server.listen(3001, () => {
  console.log("Server running on http://localhost:3001");
});
