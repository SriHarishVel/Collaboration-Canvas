const roomManager = require('./rooms');

class StateManager {
  constructor() {
    this.undoHistory = new Map();
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
    
    if (!this.redoHistory.has(roomId)) {
      this.redoHistory.set(roomId, []);
    }
    this.redoHistory.get(roomId).push({
      stroke: removedStroke,
      userId: userId,
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
    const redoStack = this.redoHistory.get(roomId);
    
    if (!redoStack || redoStack.length === 0) {
      console.log(`Redo failed: No history for user ${userId} in room ${roomId}`);
      return null;
    }

    let lastRedoIndex = -1;
    for (let i = redoStack.length - 1; i >= 0; i--) {
      if (redoStack[i].userId === userId) {
        lastRedoIndex = i;
        break;
      }
    }

    if (lastRedoIndex === -1) {
      console.log(`Redo failed: User ${userId} has no redo operations in room ${roomId}`);
      return null;
    }

    const redoOp = redoStack.splice(lastRedoIndex, 1)[0];
    const room = roomManager.getRoom(roomId);
    room.strokes.push(redoOp.stroke);

    console.log(`Redo: Restored stroke ${redoOp.stroke.id} to room ${roomId}`);

    return {
      success: true,
      strokes: room.strokes,
      restoredStroke: redoOp.stroke
    };
  }

  canUserRedo(roomId, userId) {
    const redoStack = this.redoHistory.get(roomId);
    if (!redoStack || redoStack.length === 0) {
      return false;
    }
    
    return redoStack.some(op => op.userId === userId);
  }

  clearRedoHistory(roomId, userId = null) {
    if (!this.redoHistory.has(roomId)) return;

    if (userId) {
      const redoStack = this.redoHistory.get(roomId);
      const filtered = redoStack.filter(op => op.userId !== userId);
      this.redoHistory.set(roomId, filtered);
      console.log(`Cleared redo history for user ${userId} in room ${roomId}`);
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