class RoomManager {
  constructor() {
    this.rooms = new Map();
  }

  getRoom(roomId) {
    if (!this.rooms.has(roomId)) {
      this.rooms.set(roomId, {
        id: roomId,
        strokes: [],
        cursors: new Map(),
        users: new Set(),
        createdAt: Date.now()
      });
      console.log(`Created new room: ${roomId}`);
    }
    return this.rooms.get(roomId);
  }

  addUser(roomId, userId) {
    const room = this.getRoom(roomId);
    room.users.add(userId);
    console.log(`User ${userId} joined room ${roomId} (${room.users.size} total)`);
  }

  removeUser(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (!room) return;

    room.users.delete(userId);
    room.cursors.delete(userId);
    
    console.log(`User ${userId} left room ${roomId} (${room.users.size} remaining)`);

    if (room.users.size === 0) {
      console.log(`Room ${roomId} is empty, scheduling cleanup`);
      setTimeout(() => {
        if (this.rooms.has(roomId) && this.rooms.get(roomId).users.size === 0) {
          this.rooms.delete(roomId);
          console.log(`Deleted empty room: ${roomId}`);
        }
      }, 5 * 60 * 1000);
    }
  }

  addStroke(roomId, stroke, userId) {
    const room = this.getRoom(roomId);
    
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

  getStrokes(roomId) {
    const room = this.getRoom(roomId);
    return room.strokes;
  }

  updateCursor(roomId, userId, position) {
    const room = this.getRoom(roomId);
    room.cursors.set(userId, position);
  }

  removeCursor(roomId, userId) {
    const room = this.rooms.get(roomId);
    if (room) {
      room.cursors.delete(userId);
    }
  }

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

  getAllRoomsStats() {
    return Array.from(this.rooms.keys()).map(roomId => this.getRoomStats(roomId));
  }
}

const roomManager = new RoomManager();
module.exports = roomManager;