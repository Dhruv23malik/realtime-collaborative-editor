const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" },
});

// ✅ Track unique sockets
const activeSockets = new Set();

io.on("connection", (socket) => {
  activeSockets.add(socket.id);

  // Emit correct user count
  io.emit("users-update", activeSockets.size);

  socket.on("code-change", (code) => {
    socket.broadcast.emit("code-update", code);
  });

  socket.on("disconnect", () => {
    activeSockets.delete(socket.id);
    io.emit("users-update", activeSockets.size);
  });
  
  socket.on("chat-message", (message) => {
  // broadcast chat message to everyone
  io.emit("chat-message", message);
});

});

server.listen(3001, () => {
  console.log("Server running on port 3001");
});
