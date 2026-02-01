# 🏗️ Architecture Overview

This document provides a detailed technical overview of the **Collaborative Canvas** application architecture, design decisions, and implementation details.

## 📋 Table of Contents
- [System Overview](#system-overview)
- [Technology Stack](#technology-stack)
- [Client Architecture](#client-architecture)
- [Server Architecture](#server-architecture)
- [Real-time Communication](#real-time-communication)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Performance Considerations](#performance-considerations)
- [Known Limitations](#known-limitations)
- [Future Enhancements](#future-enhancements)

---

## 🌐 System Overview

The Collaborative Canvas is a **real-time web application** that enables multiple users to draw simultaneously on a shared canvas. It follows a **client-server architecture** with WebSocket-based real-time communication.

### High-Level Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                        Browser Clients                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   User A    │  │   User B    │  │   User C    │   ...   │
│  │  (React)    │  │  (React)    │  │  (React)    │         │
│  │  Socket.IO  │  │  Socket.IO  │  │  Socket.IO  │         │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘         │
└─────────┼─────────────────┼─────────────────┼───────────────┘
          │                 │                 │
          └─────────────────┼─────────────────┘
                            │ WebSocket (Socket.IO)
                            ▼
          ┌─────────────────────────────────────┐
          │         Node.js Server              │
          │  ┌───────────────────────────────┐  │
          │  │      Socket.IO Server         │  │
          │  │   (Event Broadcasting)        │  │
          │  └───────────────────────────────┘  │
          │  ┌───────────────────────────────┐  │
          │  │      Room Manager             │  │
          │  │   (Room Lifecycle)            │  │
          │  └───────────────────────────────┘  │
          │  ┌───────────────────────────────┐  │
          │  │     State Manager             │  │
          │  │   (Undo/Redo, Validation)     │  │
          │  └───────────────────────────────┘  │
          │  ┌───────────────────────────────┐  │
          │  │      Express REST API         │  │
          │  │   (Room Statistics)           │  │
          │  └───────────────────────────────┘  │
          └─────────────────────────────────────┘
```

### Design Principles
1. **Real-time First**: All drawing operations sync instantly via WebSockets
2. **Decentralized Undo/Redo**: Each user controls their own undo stack
3. **Optimistic UI**: Client-side rendering before server confirmation
4. **Auto-cleanup**: Empty rooms are automatically garbage collected
5. **Stateless Server**: No persistent storage, all state in memory

---

## 🛠️ Technology Stack

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| React | 18.x | UI framework for component-based architecture |
| Vite | 5.x | Fast build tool and development server |
| Socket.IO Client | 4.x | WebSocket client for real-time communication |
| HTML5 Canvas API | Native | Drawing surface and rendering |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Node.js | 14+ | JavaScript runtime |
| Express | 4.x | Web server framework for REST API |
| Socket.IO | 4.x | WebSocket server for bidirectional communication |

### Development Tools
- **ESLint**: Code linting and style enforcement
- **npm**: Package management
- **Git**: Version control

---

## 🖥️ Client Architecture

### Component Hierarchy
```
App (Root Component)
└── Canvas (Drawing Interface)
    ├── Left Panel (Controls)
    │   ├── Color Picker
    │   ├── Brush Size Slider
    │   ├── Undo/Redo Buttons
    │   └── Clear Button
    │
    ├── Center Panel (Canvas)
    │   ├── HTML5 Canvas Element
    │   ├── User Labels (Fixed Position)
    │   └── Ghost Cursors (Moving)
    │
    └── Right Panel (Users & Sharing)
        ├── Active Users List
        ├── Leave Room Button
        └── Share Room Code
```

### State Management
The client uses **React hooks** for state management:

#### Canvas Component State
```javascript
// Drawing state
const [currentColor, setCurrentColor] = useState('#000000');
const [currentSize, setCurrentSize] = useState(3);

// Undo/Redo state
const [undoDisabled, setUndoDisabled] = useState(true);
const [redoDisabled, setRedoDisabled] = useState(true);

// Zoom & Pan state removed

// Collaboration state
const [users, setUsers] = useState([]);
const [ghostCursors, setGhostCursors] = useState({});
const [userLabels, setUserLabels] = useState({});

// Refs (non-reactive state)
const canvasRef = useRef(null);           // Canvas DOM element
const socketRef = useRef(null);           // WebSocket connection
const isDrawingRef = useRef(false);       // Drawing in progress flag
const currentStrokeRef = useRef(null);    // Current stroke being drawn
const strokesRef = useRef([]);            // All strokes on canvas
```

### Canvas Drawing Logic

#### Drawing Workflow
1. **Mouse Down**: Start stroke, create stroke object
2. **Mouse Move**: Add points to current stroke, redraw canvas
3. **Mouse Up**: Emit completed stroke to server, add to strokes array
4. **Mouse Leave**: Treat as mouse up if drawing

#### Stroke Object Structure
```javascript
{
  id: "userId-timestamp-random",    // Unique identifier
  userId: "socketId",                // Creator's socket ID
  username: "John",                  // Creator's username
  color: "#FF0000",                  // Stroke color (hex)
  width: 5,                          // Brush size in pixels
  points: [                          // Array of coordinate points
    { x: 100, y: 150 },
    { x: 101, y: 152 },
    ...
  ],
  timestamp: 1234567890000           // Creation time (ms)
}
```

<!-- Zoom & Pan implementation intentionally removed -->

### WebSocket Client Integration

#### Connection Setup
```javascript
const socket = io("http://localhost:3001", {
  query: { room: roomId }  // Room ID passed as query parameter
});

// Register user on connection
socket.on("connect", () => {
  socket.emit("register-user", { userId, username });
});
```

#### Event Handlers
- `sync-state`: Receive complete canvas state (for new users)
- `stroke`: Receive new stroke from another user
- `cursor-move`: Update ghost cursor position
- `users-updated`: Update active users list
- `user-disconnected`: Remove ghost cursor for disconnected user
- `redo-state`: Update redo button state

---

## 🖧 Server Architecture

### Module Structure

#### 1. server.js (Main Server & Event Handling)
- **Purpose**: WebSocket server, event routing, connection management
- **Responsibilities**:
  - Handle WebSocket connections
  - Process drawing events (stroke, undo, redo, clear)
  - Broadcast events to room members
  - Manage user registration and disconnection
  - Provide REST API for statistics

#### 2. rooms.js (Room Management)
- **Purpose**: Room lifecycle and state storage
- **Responsibilities**:
  - Create/delete rooms on demand
  - Store room data (strokes, users, cursors)
  - Track user connections per room
  - Auto-cleanup empty rooms (5-minute delay)
  - Provide room statistics

**Room Object Structure**:
```javascript
{
  id: "room-ABC123",           // Unique room identifier
  strokes: [],                 // Array of all drawing strokes
  cursors: Map<userId, {x,y}>, // Current cursor positions
  users: Set<userId>,          // Active user socket IDs
  createdAt: 1234567890000     // Room creation timestamp
}
```

#### 3. drawing-state.js (State Management)
- **Purpose**: Undo/redo logic, state validation, synchronization
- **Responsibilities**:
  - Manage per-user undo/redo stacks
  - Validate stroke data for security
  - Handle undo/redo operations
  - Provide sync state for new users
  - Clear redo history on new strokes

**User Stack Structure**:
```javascript
// Map<roomId, Map<userId, {undoStack, redoStack}>>
{
  "room-ABC123": {
    "user-socket-id-1": {
      undoStack: [stroke1, stroke2, ...],  // Removed strokes (for redo)
      redoStack: []                         // Currently unused
    }
  }
}
```

---

## 🔄 Real-time Communication

### WebSocket Event Flow

#### Drawing Event Flow
```
User A draws stroke:
1. Canvas mouse events → Create stroke object
2. Emit "stroke" event to server
3. Server validates stroke
4. Server adds stroke to room state
5. Server broadcasts stroke to User B, C, D...
6. Users B, C, D receive stroke and render it

Time: ~10-50ms total (including network latency)
```

#### Undo Event Flow
```
User A clicks undo:
1. Emit "undo" event to server
2. Server finds User A's last stroke
3. Server removes stroke from room.strokes
4. Server adds stroke to User A's undoStack
5. Server broadcasts "sync-state" to ALL users
6. All users redraw canvas with updated state

Note: All users see the change, but only User A can redo
```

### Event Throttling & Optimization
- **Cursor movements**: Not throttled (sent on every mousemove for smooth tracking)
- **Drawing strokes**: Sent in real-time as drawn (optimistic rendering)
- **Canvas redraws**: Only on stroke completion or external updates

---

## 📊 Data Flow

### New User Joining Room
```
User → Client                  Client → Server             Server → All Clients
  |                                |                              |
  | Enter room code          Connect to server                   |
  | & username               with room query                      |
  |                          /                                    |
  | ────────────────────────→ emit "register-user"               |
  |                          { userId, username }                 |
  |                                |                              |
  |                          Server validates                     |
  |                          Adds user to room                    |
  |                          Gets sync state                      |
  |                                |                              |
  | ←─────────────────────── emit "sync-state"                   |
  |   Receive all strokes    { strokes[], canRedo }              |
  |   Render canvas                |                              |
  |                                |                              |
  |                                | ──────────────────────────→ |
  |                                broadcast "users-updated"      |
  |                                [usernames...]                 |
  | ←──────────────────────────────────────────────────────────  |
  |   Update user list                                            |
```

### Drawing Stroke
```
User → Client                  Client → Server             Server → Other Clients
  |                                |                              |
  | Mouse down              Start stroke object                  |
  | Mouse move              Add points, render locally           |
  | Mouse move              Add points, render locally           |
  | Mouse up                Complete stroke                      |
  |                          /                                    |
  | ────────────────────────→ emit "stroke"                      |
  |                          { color, width, points[] }          |
  |                                |                              |
  |                          Server validates stroke             |
  |                          Adds to room.strokes                |
  |                          Clears user's redo history          |
  |                                |                              |
  |                                | ──────────────────────────→ |
  |                                broadcast "stroke"             |
  |                                { ...stroke, id, timestamp }   |
  |                                                               |
  | ←──────────────────────────────────────────────────────────  |
  |                          Other users render stroke           |
```

---

## 🧠 State Management

### Client-side State
- **Local State**: Drawing in progress, UI controls
- **Synchronized State**: All completed strokes, user list, cursors
- **Optimistic Updates**: Draw locally immediately, then send to server

### Server-side State
- **In-Memory Only**: No database persistence
- **Per-Room State**: Strokes, users, cursors stored in Map
- **Per-User State**: Undo/redo stacks stored separately
- **Volatile**: State lost on server restart

### State Synchronization
- **New user joins**: Receives complete sync-state
- **User draws**: Stroke broadcast to all
- **User undos**: Updated state sent to all
- **User leaves**: Cursor removed, user list updated

---

## ⚡ Performance Considerations

### Optimizations
1. **Canvas Rendering**
   - Strokes drawn with single path (not individual lines)
   - Transformations applied once per redraw
   - Only redraw on actual changes

2. **WebSocket Communication**
   - Binary serialization not used (JSON overhead acceptable)
   - No compression (low data volume)
   - Broadcast to room only (not all connections)

3. **Memory Management**
   - Empty rooms auto-deleted after 5 minutes
   - Stroke arrays grow unbounded (limitation)
   - User stacks cleared on new strokes

### Scalability Limits
| Metric | Limit | Reason |
|--------|-------|--------|
| Users per room | ~10-20 | Cursor tracking overhead, rendering |
| Strokes per room | ~1000-5000 | Memory consumption, redraw time |
| Concurrent rooms | ~100-500 | Server memory (depends on hardware) |
| Stroke size | ~100-500 points | WebSocket message size |

### Performance Bottlenecks
- **Large stroke count**: Canvas redraw becomes slow (>5000 strokes)
- **High user count**: Cursor tracking network overhead
- **Rapid drawing**: Many WebSocket messages in quick succession

---

## 🚧 Known Limitations

### Functional Limitations
1. **No Persistence**: All drawings lost when room is empty or server restarts
2. **No Authentication**: Anyone with room code can join
3. **No Room Passwords**: Rooms are not private
4. **No Export**: Cannot save drawings as image files
5. **No Eraser Tool**: Can only undo or clear all strokes
6. **No Shape Tools**: Only freehand drawing supported
7. **No Text Tool**: Cannot add text to canvas
8. **No Layers**: Single drawing layer only

### Technical Limitations
1. **In-Memory Storage**: Limited by server RAM
2. **Single Server**: No horizontal scaling (Socket.IO requires sticky sessions)
3. **No Compression**: Stroke data not compressed
4. **No Conflict Resolution**: Last write wins (rarely an issue)
5. **No Partial Sync**: Always sync entire canvas state
6. **Browser Compatibility**: Requires modern browser with Canvas API

### Security Limitations
⚠️ **This is a demonstration project. NOT production-ready!**
- No input sanitization on server
- No rate limiting on events
- No authorization checks
- No HTTPS/WSS enforcement
- No CSRF protection
- No XSS protection
- Vulnerable to DoS attacks

---

## 🚀 Future Enhancements

### Planned Features
1. **Persistence Layer**
   - Database storage (MongoDB/PostgreSQL)
   - Save/load room states
   - Room history and versioning

2. **Advanced Drawing Tools**
   - Eraser tool with configurable size
   - Shape tools (rectangle, circle, line)
   - Text tool with font selection
   - Fill/bucket tool
   - Layer support

3. **Export & Sharing**
   - Export canvas as PNG/JPEG
   - Share via URL with embedded player
   - GIF recording of drawing session

4. **User Experience**
   - Keyboard shortcuts (Ctrl+Z for undo, etc.)
   - Touch device support (mobile/tablet)
   - Tutorial/onboarding flow
   - Dark mode

5. **Collaboration Features**
   - Voice chat integration
   - Video chat (WebRTC)
   - Chat messages
   - Drawing permissions (view-only mode)
   - Room moderation tools

6. **Security & Auth**
   - User authentication (OAuth, email/password)
   - Room passwords
   - Rate limiting
   - Input validation & sanitization
   - HTTPS/WSS enforcement

7. **Performance**
   - Stroke compression
   - Differential sync (only send changes)
   - Canvas viewport rendering (only visible area)
   - WebGL rendering for better performance

8. **Infrastructure**
   - Horizontal scaling with Redis adapter
   - Load balancing
   - CDN for static assets
   - Monitoring & analytics
   - Docker containerization

---

## 🔍 Code Organization

### File Responsibilities

#### Client
- **App.jsx**: Application state (joined/not joined) and renders `Canvas`
- **Canvas.jsx**: Main drawing logic, WebSocket events, UI controls
- **canvasLogic.js**: Pure canvas rendering functions (no state)
- **websocket.js**: Legacy WebSocket setup (not currently used)
- **main.jsx**: React app bootstrap
- **index.css**: All styling (no CSS modules or Tailwind)

#### Server
- **server.js**: Express server, Socket.IO setup, event handlers
- **rooms.js**: Room data structure and lifecycle management
- **drawing-state.js**: Undo/redo stacks, validation, sync logic

---

## 📚 References & Resources

### Documentation
- [Socket.IO Documentation](https://socket.io/docs/)
- [Canvas API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API)
- [React Documentation](https://react.dev/)
- [Vite Documentation](https://vitejs.dev/)

### Inspiration
This project demonstrates real-time collaboration patterns applicable to:
- Collaborative whiteboards
- Multiplayer games
- Shared document editing
- Live polling/voting systems
- Real-time dashboards

---

**Last Updated**: 2026-02-02

For questions or contributions, please refer to the README.md file.
