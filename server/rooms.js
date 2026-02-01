/**
 * Room Manager Module
 * 
 * Manages multiple collaborative drawing rooms. Each room maintains:
 * - Unique room ID
 * - Collection of drawing strokes
 * - Active user connections
 * - Real-time cursor positions
 * - Room creation timestamp
 * 
 * Handles automatic cleanup of empty rooms after 5 minutes of inactivity.
 */

class RoomManager {
  constructor() {
    // Store all rooms: Map<roomId, RoomObject>
    // RoomObject: { id, strokes[], cursors Map, users Set, createdAt }
    this.rooms = new Map();
  }

  /**
   * Get or create a room
   * If room doesn't exist, creates a new one with empty state
   * 
   * @param {string} roomId - Unique identifier for the room
   * @returns {Object} Room object containing id, strokes, cursors, users, and createdAt
   */
  getRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      // Initialize new room with empty state
      this.rooms.set(roomId, {
        id: roomId,
        strokes: [],              // Array of all drawing strokes in this room
        cursors: new Map(),       // Map<userId, {x, y}> - cursor positions
        users: new Set(),         // Set of active user socket IDs
        createdAt: Date.now()     // Room creation timestamp
      });
      console.log(`Created new room: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  /**
   * Add a user to a room
   * Automatically creates room if it doesn't exist
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   */
  addUser(roomId, userId) {
    const room = this.getRoom(roomId);
    room.users.add(userId);
    console.log(`User ${userId} joined room ${roomId} (${room.users.size} total)`);
  }

  /**
   * Remove a user from a room
   * Schedules room cleanup if it becomes empty (5-minute delay)
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   */
  removeUser(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.users.delete(userId);
    room.cursors.delete(userId);
    
    console.log(`User ${userId} left room ${roomId} (${room.users.size} remaining)`);

    // Schedule cleanup for empty rooms
    if (room.users.size === 0) {
      console.log(`Room ${roomId} is empty, scheduling cleanup`);
      
      // Wait 5 minutes before deleting empty room (in case users reconnect)
      setTimeout(() => {
        if (this.rooms.has(roomId) && this.rooms.get(roomId).users.size === 0) {
          this.rooms.delete(roomId);
          console.log(`Deleted empty room: ${roomId}`);
        }
      }, 5 * 60 * 1000); // 5 minutes
    }
  }

  /**
   * Add a drawing stroke to a room
   * Enriches stroke with unique ID, user ID, and timestamp metadata
   * 
   * @param {string} roomId - Room identifier
   * @param {Object} stroke - Stroke object {color, width, points[]}
   * @param {string} userId - User's socket ID who created the stroke
   * @returns {Object} Stroke with added metadata (id, userId, timestamp)
   */
  addStroke(roomId, stroke, userId) {
    const room = this.getRoom(roomId);
    
    // Enrich stroke with metadata for tracking and identification
    const strokeWithMeta = {
      ...stroke,
      id: `${userId}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId: userId,
      timestamp: Date.now()
    };
    
    room.strokes.push(strokeWithMeta);
    console.log(`Stroke added to room ${roomId} (total: ${room.strokes.length})`);
    
    return strokeWithMeta;
  }

  
  /**
   * Get all strokes for a room
   * 
   * @param {string} roomId - Room identifier
   * @returns {Array} Array of stroke objects
   */
  getStrokes(roomId) {
    const room = this.getRoom(roomId);
    return room.strokes;
  }

  /**
   * Update cursor position for a user in a room
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   * @param {Object} position - {x, y} coordinates
   */
  updateCursor(roomId, userId, position) {
    const room = this.getRoom(roomId);
    room.cursors.set(userId, position);
  }

  /**
   * Remove cursor tracking for a user
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   */
  removeCursor(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.cursors.delete(userId);
    }
  }

  /**
   * Get statistics for a specific room
   * 
   * @param {string} roomId - Room identifier
   * @returns {Object|null} Room stats or null if room doesn't exist
   */
  getRoomStats(roomId) {
    const room = this.rooms.get(roomId);
    if (!room) return null;

    return {
      id: roomId,
      userCount: room.users.size,
      strokeCount: room.strokes.length,
      createdAt: room.createdAt,
      ageMinutes: Math.floor((Date.now() - room.createdAt) / 60000)
    };
  }

  /**
   * Get statistics for all active rooms
   * 
   * @returns {Array} Array of room statistics objects
   */
  getAllRoomsStats() {
    return Array.from(this.rooms.keys()).map(roomId => this.getRoomStats(roomId));
  }
}

// Export singleton instance
const roomManager = new RoomManager();
module.exports = roomManager;
