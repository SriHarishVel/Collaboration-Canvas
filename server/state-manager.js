const roomManager = require('./rooms');

class StateManager {
  constructor() {
    this.undoHistory = new Map();
    // redoHistory is now a Map of roomId -> Map of userId -> Array of redo ops
    this.redoHistory = new Map();
  }

  undo(roomId, userId) {
    const room = roomManager.getRoom(roomId);
    const strokes = room.strokes;

    let lastStrokeIndex = -1;
    for (let i = strokes.length - 1; i >= 0; i--) {
      if (strokes[i].userId === userId) {
        lastStrokeIndex = i;
        break;
      }
    }

    if (lastStrokeIndex === -1) {
      console.log(`Undo failed: User ${userId} has no strokes in room ${roomId}`);
      return null;
    }

    const removedStroke = strokes.splice(lastStrokeIndex, 1)[0];
    // Ensure redo history structure exists for this room and user
    if (!this.redoHistory.has(roomId)) {
      this.redoHistory.set(roomId, new Map());
    }

    const roomRedo = this.redoHistory.get(roomId);
    if (!roomRedo.has(userId)) {
      roomRedo.set(userId, []);
    }

    roomRedo.get(userId).push({
      stroke: removedStroke,
      timestamp: Date.now()
    });

    console.log(`Undo: Removed stroke ${removedStroke.id} from room ${roomId}`);

    return {
      success: true,
      strokes: room.strokes,
      removedStroke: removedStroke
    };
  }

  redo(roomId, userId) {
    const roomRedo = this.redoHistory.get(roomId);
    if (!roomRedo) {
      console.log(`Redo failed: No history for room ${roomId}`);
      return null;
    }

    const userRedo = roomRedo.get(userId) || [];
    if (userRedo.length === 0) {
      console.log(`Redo failed: User ${userId} has no redo operations in room ${roomId}`);
      return null;
    }

    // Pop the last redo op for this user
    const redoOp = userRedo.pop();
    const room = roomManager.getRoom(roomId);

    // Restore stroke to the room's strokes
    room.strokes.push(redoOp.stroke);

    console.log(`Redo: Restored stroke ${redoOp.stroke.id} to room ${roomId}`);

    return {
      success: true,
      strokes: room.strokes,
      restoredStroke: redoOp.stroke
    };
  }

  canUserRedo(roomId, userId) {
    const roomRedo = this.redoHistory.get(roomId);
    if (!roomRedo) return false;

    const userRedo = roomRedo.get(userId);
    return Array.isArray(userRedo) && userRedo.length > 0;
  }

  clearRedoHistory(roomId, userId = null) {
    if (!this.redoHistory.has(roomId)) return;

    if (userId) {
      const roomRedo = this.redoHistory.get(roomId);
      if (roomRedo && roomRedo.has(userId)) {
        roomRedo.delete(userId);
        console.log(`Cleared redo history for user ${userId} in room ${roomId}`);
      }
    } else {
      this.redoHistory.delete(roomId);
      console.log(`Cleared all redo history for room ${roomId}`);
    }
  }

  getSyncState(roomId) {
    const strokes = roomManager.getStrokes(roomId);
    const room = roomManager.getRoom(roomId);

    return {
      strokes: strokes,
      userCount: room.users.size,
      timestamp: Date.now()
    };
  }

  validateStroke(stroke) {
    if (!stroke || typeof stroke !== 'object') {
      return false;
    }

    if (!stroke.color || !stroke.width || !Array.isArray(stroke.points)) {
      console.log('Invalid stroke: Missing required fields');
      return false;
    }

    if (stroke.points.length === 0) {
      console.log('Invalid stroke: Empty points array');
      return false;
    }

    for (const point of stroke.points) {
      if (typeof point.x !== 'number' || typeof point.y !== 'number') {
        console.log('Invalid stroke: Point has invalid coordinates');
        return false;
      }
      
      if (point.x < -10000 || point.x > 10000 || point.y < -10000 || point.y > 10000) {
        console.log('Invalid stroke: Point coordinates out of bounds');
        return false;
      }
    }

    return true;
  }

  getStateStats(roomId) {
    const roomRedo = this.redoHistory.get(roomId) || new Map();
    let redoAvailable = 0;
    for (const [userId, stack] of roomRedo.entries()) {
      redoAvailable += (Array.isArray(stack) ? stack.length : 0);
    }

    const room = roomManager.getRoomStats(roomId);
    return {
      roomId: roomId,
      strokeCount: room ? room.strokeCount : 0,
      redoAvailable: redoAvailable,
      roomStats: room
    };
  }

  clearRoomState(roomId) {
    const room = roomManager.getRoom(roomId);
    room.strokes = [];
    this.undoHistory.delete(roomId);
    this.redoHistory.delete(roomId);
    
    console.log(`Cleared all state for room ${roomId}`);
  }
}

const stateManager = new StateManager();
module.exports = stateManager;