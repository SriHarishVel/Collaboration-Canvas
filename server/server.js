const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

io.on("connection", (socket) => {
  const roomId = socket.handshake.query.room || "default";

  socket.join(roomId);
  console.log(`User ${socket.id} joined room ${roomId}`);

  socket.on("stroke", (stroke) => {
    // Send the stroke to all other connected clients in the same room
    socket.to(roomId).emit("stroke", stroke);
  });

  socket.on("disconnect", () => {
    console.log(`User disconnected: ${socket.id} from room ${roomId}`);
  });
});

server.listen(3001, () => {
  console.log("Socket.IO server running on port 3001");
});
