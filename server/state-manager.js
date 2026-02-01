const roomManager = require('./rooms');

class StateManager {
  constructor() {
    // Store undo/redo stacks per user per room: roomId -> userId -> { undoStack: [], redoStack: [] }
    this.userStacks = new Map();
  }

  initializeUserStacks(roomId, userId) {
    if (!this.userStacks.has(roomId)) {
      this.userStacks.set(roomId, new Map());
    }
    if (!this.userStacks.get(roomId).has(userId)) {
      this.userStacks.get(roomId).set(userId, {
        undoStack: [],
        redoStack: []
      });
    }
  }

  undo(roomId, userId) {
    const room = roomManager.getRoom(roomId);
    const strokes = room.strokes;

    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);

    // Find the last stroke by this user
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

  redo(roomId, userId) {
    const room = roomManager.getRoom(roomId);
    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);

    if (userStacks.undoStack.length === 0) {
      console.log(`Redo failed: User ${userId} has no undo history in room ${roomId}`);
      return null;
    }

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

  canUserUndo(roomId, userId) {
    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);
    const room = roomManager.getRoom(roomId);
    
    // Can undo if there's at least one stroke by this user
    const hasUserStroke = room.strokes.some(s => s.userId === userId);
    return hasUserStroke;
  }

  canUserRedo(roomId, userId) {
    this.initializeUserStacks(roomId, userId);
    const userStacks = this.userStacks.get(roomId).get(userId);
    return userStacks.undoStack.length > 0;
  }

  clearRedoHistory(roomId, userId = null) {
    if (!this.userStacks.has(roomId)) return;

    if (userId) {
      const userStacks = this.userStacks.get(roomId).get(userId);
      if (userStacks) {
        userStacks.undoStack = [];
        userStacks.redoStack = [];
        console.log(`Cleared undo/redo history for user ${userId} in room ${roomId}`);
      }
    } else {
      this.userStacks.delete(roomId);
      console.log(`Cleared all undo/redo history for room ${roomId}`);
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
    const redoStack = this.redoHistory.get(roomId) || [];
    const room = roomManager.getRoomStats(roomId);

    return {
      roomId: roomId,
      strokeCount: room ? room.strokeCount : 0,
      redoAvailable: redoStack.length,
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