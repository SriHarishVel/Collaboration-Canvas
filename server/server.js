const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const roomManager = require("./rooms");
const stateManager = require("./state-manager");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*"
  }
});

let userCounter = 0;
const userLabels = new Map();

io.on("connection", (socket) => {
  const roomId = socket.handshake.query.room || "default";
  socket.join(roomId);
  
  userCounter++;
  const userLabel = `User ${String.fromCharCode(64 + (userCounter % 26 || 26))}`;
  userLabels.set(socket.id, userLabel);
  
  roomManager.addUser(roomId, socket.id);
  
  console.log(`${userLabel} (${socket.id}) joined room ${roomId}`);
  console.log(`Room ${roomId} now has ${io.sockets.adapter.rooms.get(roomId)?.size || 0} users`);

  const syncState = stateManager.getSyncState(roomId);
  const canRedo = stateManager.canUserRedo(roomId, socket.id);
  socket.emit("sync-state", {
    strokes: syncState.strokes,
    canRedo: canRedo
  });

  socket.on("stroke", (stroke) => {
    if (!stateManager.validateStroke(stroke)) {
      console.log(`Invalid stroke from ${userLabel}, ignoring`);
      return;
    }

    stateManager.clearRedoHistory(roomId, socket.id);
    const strokeWithMeta = roomManager.addStroke(roomId, stroke, socket.id);
    
    socket.to(roomId).emit("stroke", strokeWithMeta);
    
    io.to(roomId).emit("redo-state", false);
  });

  socket.on("undo", () => {
    const result = stateManager.undo(roomId, socket.id);
    
    if (result) {
      const canRedo = stateManager.canUserRedo(roomId, socket.id);
      io.to(roomId).emit("sync-state", {
        strokes: result.strokes,
        canRedo: canRedo
      });
      console.log(`${userLabel} undid stroke in room ${roomId}`);
    } else {
      console.log(`${userLabel} tried to undo but has no strokes`);
    }
  });

  socket.on("redo", () => {
    const result = stateManager.redo(roomId, socket.id);
    
    if (result) {
      const canRedo = stateManager.canUserRedo(roomId, socket.id);
      io.to(roomId).emit("sync-state", {
        strokes: result.strokes,
        canRedo: canRedo
      });
      console.log(`${userLabel} redid stroke in room ${roomId}`);
    } else {
      console.log(`${userLabel} tried to redo but has no redo history`);
    }
  });

  socket.on("cursor-move", ({ x, y }) => {
    roomManager.updateCursor(roomId, socket.id, { x, y });
    
    socket.to(roomId).emit("cursor-move", {
      userId: socket.id,
      x,
      y,
      label: userLabel
    });
  });

  socket.on("clear-canvas", () => {
    stateManager.clearRoomState(roomId);
    io.to(roomId).emit("sync-state", {
      strokes: [],
      canRedo: false
    });
    console.log(`${userLabel} cleared canvas in room ${roomId}`);
  });

  socket.on("disconnect", () => {
    roomManager.removeUser(roomId, socket.id);
    socket.to(roomId).emit("user-disconnected", socket.id);
    
    console.log(`${userLabel} left room ${roomId}`);
    userLabels.delete(socket.id);
    
    const room = io.sockets.adapter.rooms.get(roomId);
    if (room) {
      console.log(`Room ${roomId} now has ${room.size} users`);
    } else {
      console.log(`Room ${roomId} is now empty`);
    }
  });
});

app.get("/api/rooms", (req, res) => {
  const stats = roomManager.getAllRoomsStats();
  res.json({
    totalRooms: stats.length,
    rooms: stats
  });
});

app.get("/api/rooms/:roomId", (req, res) => {
  const stats = roomManager.getRoomStats(req.params.roomId);
  if (stats) {
    res.json(stats);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

server.listen(3001, () => {
  console.log("Socket.IO server running on port 3001");
});
