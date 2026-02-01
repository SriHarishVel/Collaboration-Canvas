/**
 * Collaborative Canvas - Server Entry Point
 * 
 * This server manages real-time collaborative drawing sessions using WebSockets.
 * It handles multiple rooms, user connections, drawing state, and undo/redo operations.
 */

const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const roomManager = require("./rooms");
const stateManager = require("./drawing-state");

// Initialize Express application
const app = express();
const server = http.createServer(app);

// Initialize Socket.IO with CORS enabled for all origins
const io = new Server(server, {
  cors: {
    origin: "*" // Allow connections from any origin (configure appropriately for production)
  }
});

// Track users per room: Map<roomId, Map<socketId, username>>
const roomUsers = new Map();

// Track user labels/usernames globally: Map<socketId, username>
const userLabels = new Map();

/**
 * Handle new WebSocket connection
 * - Automatically joins user to specified room from query params
 * - Sets up all event listeners for this socket connection
 */
io.on("connection", (socket) => {
  // Extract room ID from connection query params, default to "default" room
  const roomId = socket.handshake.query.room || "default";
  socket.join(roomId);
  
  // Store user label for this connection
  let userLabel = null;

  /**
   * Handle user registration when they join a room
   * - Assigns username/label to the user
   * - Syncs current drawing state to the new user
   * - Broadcasts updated user list to all room members
   */
  socket.on("register-user", ({ userId, username }) => {
    // Set user label, fallback to shortened socket ID if not provided
    userLabel = username || `User ${socket.id.substring(0, 5)}`;
    userLabels.set(socket.id, userLabel);
    
    // Initialize room users list if this is the first user in the room
    if (!roomUsers.has(roomId)) {
      roomUsers.set(roomId, new Map());
    }
    
    // Register user in both tracking maps
    roomUsers.get(roomId).set(socket.id, userLabel);
    roomManager.addUser(roomId, socket.id);
    
    console.log(`${userLabel} (${socket.id}) joined room ${roomId}`);
    
    // Send current canvas state (all strokes) to the newly joined user
    const syncState = stateManager.getSyncState(roomId);
    const canRedo = stateManager.canUserRedo(roomId, socket.id);
    socket.emit("sync-state", {
      strokes: syncState.strokes,
      canRedo: canRedo
    });
    
    // Broadcast updated user list to all users in the room
    const userList = Array.from(roomUsers.get(roomId).values());
    io.to(roomId).emit("users-updated", userList);
    
    console.log(`Room ${roomId} now has ${userList.length} users: ${userList.join(", ")}`);
  });

  /**
   * Handle drawing stroke events
   * - Validates stroke data for security and integrity
   * - Clears redo history (new stroke invalidates redo)
   * - Broadcasts stroke to all other users in the room
   */
  socket.on("stroke", (stroke) => {
    // Validate stroke data before processing
    if (!stateManager.validateStroke(stroke)) {
      console.log(`Invalid stroke from ${userLabel}, ignoring`);
      return;
    }

    // New stroke clears redo history for this user
    stateManager.clearRedoHistory(roomId, socket.id);
    
    // Add stroke to room's drawing state with metadata
    const strokeWithMeta = roomManager.addStroke(roomId, stroke, socket.id);
    
    // Broadcast the stroke to all other users in the room (not the sender)
    socket.to(roomId).emit("stroke", strokeWithMeta);
    
    // Notify all users that redo is no longer available
    io.to(roomId).emit("redo-state", false);
  });

  /**
   * Handle undo action
   * - Removes user's most recent stroke from canvas
   * - Syncs updated canvas state to all users
   * - Updates undo/redo button states
   */
  socket.on("undo", () => {
    const result = stateManager.undo(roomId, socket.id);
    
    if (result) {
      // Broadcast updated canvas state to all users in the room
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

  /**
   * Handle redo action
   * - Restores user's most recently undone stroke to canvas
   * - Syncs updated canvas state to all users
   * - Updates undo/redo button states
   */
  socket.on("redo", () => {
    const result = stateManager.redo(roomId, socket.id);
    
    if (result) {
      // Broadcast updated canvas state to all users in the room
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

  /**
   * Handle cursor movement tracking
   * - Updates cursor position for this user
   * - Broadcasts cursor position to other users for ghost cursor display
   */
  socket.on("cursor-move", ({ x, y }) => {
    // Update cursor position in room state
    roomManager.updateCursor(roomId, socket.id, { x, y });
    
    // Broadcast cursor position to all other users (not the sender)
    socket.to(roomId).emit("cursor-move", {
      userId: socket.id,
      x,
      y,
      label: userLabel
    });
  });

  /**
   * Handle canvas clear action
   * - Only removes strokes created by the requesting user
   * - Preserves other users' drawings
   * - Syncs updated state to all users
   */
  socket.on("clear-canvas", ({ userId }) => {
    const room = roomManager.getRoom(roomId);
    const initialLength = room.strokes.length;
    
    // Filter out only the requesting user's strokes
    room.strokes = room.strokes.filter(stroke => stroke.userId !== userId);
    const removed = initialLength - room.strokes.length;
    
    // Clear redo history for this user since their strokes are gone
    stateManager.clearRedoHistory(roomId, socket.id);
    
    // Sync updated canvas to all users in the room
    io.to(roomId).emit("sync-state", {
      strokes: room.strokes,
      canRedo: false
    });
    console.log(`${userLabel} cleared their strokes in room ${roomId} (removed ${removed} strokes)`);
  });

  /**
   * Handle user disconnection
   * - Removes user from room
   * - Notifies other users about disconnection
   * - Cleans up empty rooms
   * - Updates user list for remaining users
   */
  socket.on("disconnect", () => {
    // Remove user from room manager
    roomManager.removeUser(roomId, socket.id);
    
    // Notify other users about the disconnection (for cursor cleanup)
    socket.to(roomId).emit("user-disconnected", socket.id);
    
    console.log(`${userLabel} left room ${roomId}`);
    userLabels.delete(socket.id);
    
    // Update room users list and clean up if room is empty
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      const userList = Array.from(roomUsers.get(roomId).values());
      
      // Broadcast updated user list to remaining users
      io.to(roomId).emit("users-updated", userList);
      
      if (userList.length === 0) {
        // Clean up empty room tracking
        roomUsers.delete(roomId);
        console.log(`Room ${roomId} is now empty`);
      } else {
        console.log(`Room ${roomId} now has ${userList.length} users`);
      }
    }
  });
});

/**
 * REST API Endpoint: Get all rooms statistics
 * Returns information about all active rooms including user counts and stroke counts
 */
app.get("/api/rooms", (req, res) => {
  const stats = roomManager.getAllRoomsStats();
  res.json({
    totalRooms: stats.length,
    rooms: stats
  });
});

/**
 * REST API Endpoint: Get specific room statistics
 * Returns detailed information about a specific room by ID
 */
app.get("/api/rooms/:roomId", (req, res) => {
  const stats = roomManager.getRoomStats(req.params.roomId);
  if (stats) {
    res.json(stats);
  } else {
    res.status(404).json({ error: "Room not found" });
  }
});

// Start the server on port 3001
server.listen(3001, () => {
  console.log("Socket.IO server running on port 3001");
});
