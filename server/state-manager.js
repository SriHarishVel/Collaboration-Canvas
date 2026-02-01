/**
 * Canvas State Manager Module
 * 
 * Manages canvas state, undo/redo operations, and state synchronization.
 * Each user has their own undo/redo stack, allowing independent undo/redo
 * operations without affecting other users' drawings.
 * 
 * Key features:
 * - Per-user undo/redo stacks
 * - Stroke validation for security
 * - State synchronization for new users
 * - Automatic cleanup
 */

const roomManager = require('./rooms');

class StateManager {
  constructor() {
    // Store undo/redo stacks per user per room
    // Structure: Map<roomId, Map<userId, {undoStack: [], redoStack: []}>>
    this.userStacks = new Map();
  }

  /**
   * Initialize undo/redo stacks for a user in a room
   * Creates empty stacks if they don't exist
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   */
  initializeUserStacks(roomId, userId) {
    if (!this.userStacks.has(roomId)) {
      this.userStacks.set(roomId, new Map());
    }
    if (!this.userStacks.get(roomId).has(userId)) {
      this.userStacks.get(roomId).set(userId, {
        undoStack: [],  // Stores removed strokes for redo
        redoStack: []   // Currently unused (for future enhancement)
      });
    }
  }

  /**
   * Undo the last stroke by a user
   * - Finds and removes the user's most recent stroke
   * - Stores it in undo stack for potential redo
   * - Returns updated canvas state
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   * @returns {Object|null} Result object with strokes and undo/redo states, or null if no strokes to undo
   */
  undo(roomId, userId) {
    const room = roomManager.getRoom(roomId);
    const strokes = room.strokes;

    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);

    // Find the last stroke created by this user (searching backwards for efficiency)
    let lastStrokeIndex = -1;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].userId === userId) {
        lastStrokeIndex = i;
        break;
      }
    }

    // No strokes found for this user
    if (lastStrokeIndex === -1) {
      console.log(`Undo failed: User ${userId} has no strokes in room ${roomId}`);
      return null;
    }

    // Remove stroke from canvas and store in undo stack
    const removedStroke = strokes.splice(lastStrokeIndex, 1)[0];
    userStacks.undoStack.push(removedStroke);

    console.log(`Undo: Removed stroke ${removedStroke.id} from room ${roomId}. Undo stack size: ${userStacks.undoStack.length}`);

    return {
      success: true,
      strokes: room.strokes,
      removedStroke: removedStroke,
      canUndo: this.canUserUndo(roomId, userId),
      canRedo: this.canUserRedo(roomId, userId)
    };
  }

  /**
   * Redo the last undone stroke by a user
   * - Restores the most recently undone stroke
   * - Returns updated canvas state
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   * @returns {Object|null} Result object with strokes and undo/redo states, or null if no undo history
   */
  redo(roomId, userId) {
    const room = roomManager.getRoom(roomId);
    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);

    // Check if there's anything to redo
    if (userStacks.undoStack.length === 0) {
      console.log(`Redo failed: User ${userId} has no undo history in room ${roomId}`);
      return null;
    }

    // Restore stroke from undo stack
    const stroke = userStacks.undoStack.pop();
    room.strokes.push(stroke);
    userStacks.redoStack.push(stroke);

    console.log(`Redo: Restored stroke ${stroke.id} to room ${roomId}. Undo stack size: ${userStacks.undoStack.length}`);

    return {
      success: true,
      strokes: room.strokes,
      restoredStroke: stroke,
      canUndo: this.canUserUndo(roomId, userId),
      canRedo: this.canUserRedo(roomId, userId)
    };
  }

  /**
   * Check if user can undo (has at least one stroke on canvas)
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   * @returns {boolean} True if user has strokes to undo
   */
  canUserUndo(roomId, userId) {
    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);
    const room = roomManager.getRoom(roomId);
    
    // Can undo if there's at least one stroke by this user on the canvas
    const hasUserStroke = room.strokes.some(s => s.userId === userId);
    return hasUserStroke;
  }

  /**
   * Check if user can redo (has undo history)
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID
   * @returns {boolean} True if user has undo history to redo
   */
  canUserRedo(roomId, userId) {
    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);
    return userStacks.undoStack.length > 0;
  }

  /**
   * Clear undo/redo history for a user or entire room
   * Called when new strokes are added or user clears their canvas
   * 
   * @param {string} roomId - Room identifier
   * @param {string} userId - User's socket ID (optional, if null clears entire room)
   */
  clearRedoHistory(roomId, userId = null) {
    if (!this.userStacks.has(roomId)) return;

    if (userId) {
      // Clear history for specific user
      const userStacks = this.userStacks.get(roomId).get(userId);
      if (userStacks) {
        userStacks.undoStack = [];
        userStacks.redoStack = [];
        console.log(`Cleared undo/redo history for user ${userId} in room ${roomId}`);
      }
    } else {
      // Clear history for all users in room
      this.userStacks.delete(roomId);
      console.log(`Cleared all undo/redo history for room ${roomId}`);
    }
  }

  /**
   * Get complete synchronization state for a room
   * Used to sync new users with current canvas state
   * 
   * @param {string} roomId - Room identifier
   * @returns {Object} State object with strokes, userCount, and timestamp
   */
  getSyncState(roomId) {
    const strokes = roomManager.getStrokes(roomId);
    const room = roomManager.getRoom(roomId);

    return {
      strokes: strokes,
      userCount: room.users.size,
      timestamp: Date.now()
    };
  }

  /**
   * Validate stroke data for security and integrity
   * Checks for required fields and valid data ranges
   * 
   * @param {Object} stroke - Stroke object to validate
   * @returns {boolean} True if stroke is valid
   */
  validateStroke(stroke) {
    // Check basic structure
    if (!stroke || typeof stroke !== 'object') {
      return false;
    }

    // Check required fields
    if (!stroke.color || !stroke.width || !Array.isArray(stroke.points)) {
      console.log('Invalid stroke: Missing required fields');
      return false;
    }

    // Check points array is not empty
    if (stroke.points.length === 0) {
      console.log('Invalid stroke: Empty points array');
      return false;
    }

    // Validate each point in the stroke
    for (const point of stroke.points) {
      // Check point has valid x,y coordinates
      if (typeof point.x !== 'number' || typeof point.y !== 'number') {
        console.log('Invalid stroke: Point has invalid coordinates');
        return false;
      }
      
      // Check coordinates are within reasonable bounds (prevent DoS/overflow)
      if (point.x < -10000 || point.x > 10000 || point.y < -10000 || point.y > 10000) {
        console.log('Invalid stroke: Point coordinates out of bounds');
        return false;
      }
    }

    return true;
  }

  /**
   * Get statistics about state for a specific room (for debugging/monitoring)
   * 
   * @param {string} roomId - Room identifier
   * @returns {Object} Statistics object
   */
  getStateStats(roomId) {
    const redoStack = this.redoHistory.get(roomId) || [];
    const room = roomManager.getRoomStats(roomId);

    return {
      roomId: roomId,
      strokeCount: room ? room.strokeCount : 0,
      redoAvailable: redoStack.length,
      roomStats: room
    };
  }

  /**
   * Clear all state for a room (strokes and history)
   * Nuclear option for room reset
   * 
   * @param {string} roomId - Room identifier
   */
  clearRoomState(roomId) {
    const room = roomManager.getRoom(roomId);
    room.strokes = [];
    this.undoHistory.delete(roomId);
    this.redoHistory.delete(roomId);
    
    console.log(`Cleared all state for room ${roomId}`);
  }
}

// Export singleton instance
const stateManager = new StateManager();
module.exports = stateManager;