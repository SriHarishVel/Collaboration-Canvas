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

const roomUsers = new Map(); // Track users per room
const userLabels = new Map(); // Track user labels globally

io.on("connection", (socket) => {
  const roomId = socket.handshake.query.room || "default";
  socket.join(roomId);
  
  let userLabel = null;

  // Handle user registration
  socket.on("register-user", ({ userId, username }) => {
    userLabel = username || `User ${socket.id.substring(0, 5)}`;
    userLabels.set(socket.id, userLabel);
    
    // Initialize room users list if needed
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    
    roomUsers.get(roomId).set(socket.id, userLabel);
    roomManager.addUser(roomId, socket.id);
    
    console.log(`${userLabel} (${socket.id}) joined room ${roomId}`);
    
    // Send sync state to new user
    const syncState = stateManager.getSyncState(roomId);
    const canRedo = stateManager.canUserRedo(roomId, socket.id);
    socket.emit("sync-state", {
      strokes: syncState.strokes,
      canRedo: canRedo
    });
    
    // Broadcast updated user list to all in room
    const userList = Array.from(roomUsers.get(roomId).values());
    io.to(roomId).emit("users-updated", userList);
    
    console.log(`Room ${roomId} now has ${userList.length} users: ${userList.join(", ")}`);
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
      io.to(roomId).emit("sync-state", {
        strokes: result.strokes,
        userId: socket.id,
        canUndo: result.canUndo,
        canRedo: result.canRedo
      });
      console.log(`${userLabel} undid stroke in room ${roomId}`);
    } else {
      console.log(`${userLabel} tried to undo but has no strokes`);
    }
  });

  socket.on("redo", () => {
    const result = stateManager.redo(roomId, socket.id);
    
    if (result) {
      io.to(roomId).emit("sync-state", {
        strokes: result.strokes,
        userId: socket.id,
        canUndo: result.canUndo,
        canRedo: result.canRedo
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

  socket.on("clear-canvas", ({ userId }) => {
    // Only clear strokes from the specific user, not the entire canvas
    const room = roomManager.getRoom(roomId);
    const initialLength = room.strokes.length;
    room.strokes = room.strokes.filter(stroke => stroke.userId !== userId);
    const removed = initialLength - room.strokes.length;
    
    // Clear redo history for this user to prevent redo after clear
    stateManager.clearRedoHistory(roomId, socket.id);
    
    io.to(roomId).emit("sync-state", {
      strokes: room.strokes,
      canRedo: false
    });
    console.log(`${userLabel} cleared their strokes in room ${roomId} (removed ${removed} strokes)`);
  });

  socket.on("disconnect", () => {
    roomManager.removeUser(roomId, socket.id);
    socket.to(roomId).emit("user-disconnected", socket.id);
    
    console.log(`${userLabel} left room ${roomId}`);
    userLabels.delete(socket.id);
    
    // Update room users list
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      const userList = Array.from(roomUsers.get(roomId).values());
      io.to(roomId).emit("users-updated", userList);
      
      if (userList.length === 0) {
        roomUsers.delete(roomId);
        console.log(`Room ${roomId} is now empty`);
      } else {
        console.log(`Room ${roomId} now has ${userList.length} users`);
      }
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
