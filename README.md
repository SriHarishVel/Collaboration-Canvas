# 🎨 Collaborative Canvas

A **real-time collaborative drawing application** where multiple users can draw together on a shared canvas. Built with **React**, **HTML5 Canvas**, **Socket.IO**, and **Node.js**.

## ✨ Features

### 🖌️ Drawing Capabilities
- **Free-hand drawing** with customizable brush colors and sizes
- **Color picker** with live preview
- **Brush size selector** (1-30px) with visual preview
- **Smooth drawing** with rounded line caps and joins

### 👥 Real-time Collaboration
- **Multi-user rooms** - Create or join rooms with unique room codes
- **Live cursor tracking** - See other users' cursors in real-time
- **User presence** - View all active users in the room
- **Color-coded users** - Each user gets a unique color for identification
- **Instant synchronization** - All drawings sync across users in milliseconds

### 🔄 Canvas Operations
- **Undo/Redo** - Per-user undo/redo for your own strokes
- **Clear canvas** - Remove only your drawings (preserves others' work)
- **Auto-sync** - New users see all existing drawings when joining

### 🚪 Room Management
- **Create rooms** - Generate unique room codes automatically
- **Join rooms** - Enter existing rooms with room code
- **Share rooms** - Copy room code to invite others
- **User labels** - Set custom username when joining

## 🚀 Quick Start

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd drawtool
   ```

2. **Install server dependencies**
   ```bash
   cd server
   npm install
   ```

3. **Install client dependencies**
   ```bash
   cd ../client
   npm install
   ```

### Running the Application

1. **Start the server** (Terminal 1)
   ```bash
   cd server
   npm start
   ```
   Server will run on `http://localhost:3001`

2. **Start the client** (Terminal 2)
   ```bash
   cd client
   npm run dev
   ```
   Client will run on `http://localhost:5173` (or another port shown in terminal)

3. **Open in browser**
   - Navigate to the client URL (e.g., `http://localhost:5173`)
   - Create a new room or join an existing one
   - Start drawing!

## 📖 How to Use

### Creating a Room
1. Click **"Create New Room"**
2. Enter your username
3. Click **"Create & Enter"**
4. Share the generated room code with others

### Joining a Room
1. Click **"Join Existing Room"**
2. Enter the room code (e.g., `room-ABC123`)
3. Enter your username
4. Click **"Join Room"**

### Drawing
- **Draw**: Click and drag on canvas
- **Change color**: Use color picker in left panel
- **Change size**: Adjust brush size slider
- **Undo**: Click "Undo" button (or press shortcut if implemented)
- **Redo**: Click "Redo" button
- **Clear**: Click "Clear Canvas" to remove your drawings

## 🏗️ Architecture

### Project Structure
```
collaborative-canvas/
├── client/                 # React frontend
│   ├── src/
│   │   ├── App.jsx        # Main app component (renders the Canvas)
│   │   ├── Canvas.jsx     # Canvas component with drawing & WebSocket logic
│   │   ├── canvasLogic.js # Canvas drawing and rendering functions
│   │   ├── websocket.js   # WebSocket client setup (legacy)
│   │   ├── main.jsx       # React app entry point
│   │   └── index.css      # Comprehensive styling
│   ├── index.html         # HTML entry point
│   ├── package.json       # Client dependencies
│   └── vite.config.js     # Vite bundler configuration
│
├── server/                # Node.js backend
│   ├── server.js          # Express + WebSocket server & event handlers
│   ├── rooms.js           # Room management logic
│   ├── state-manager.js   # Canvas state & undo/redo management
│   └── package.json       # Server dependencies
│
├── README.md              # This file
└── ARCHITECTURE.md        # Detailed architecture documentation
```

### Technology Stack

#### Frontend
- **React** - UI framework
- **Vite** - Fast build tool and dev server
- **Socket.IO Client** - WebSocket client for real-time communication
- **HTML5 Canvas** - Drawing surface

#### Backend
- **Node.js** - JavaScript runtime
- **Express** - Web server framework
- **Socket.IO** - WebSocket server for real-time communication

## 🔌 WebSocket Events

### Client → Server
| Event | Description | Payload |
|-------|-------------|---------|
| `register-user` | Register user when joining room | `{ userId, username }` |
| `stroke` | Send drawing stroke | `{ color, width, points[], userId }` |
| `cursor-move` | Update cursor position | `{ x, y }` |
| `undo` | Undo last stroke | - |
| `redo` | Redo last undone stroke | - |
| `clear-canvas` | Clear user's strokes | `{ userId }` |

### Server → Client
| Event | Description | Payload |
|-------|-------------|---------|
| `sync-state` | Sync canvas state | `{ strokes[], canUndo, canRedo, userId? }` |
| `stroke` | Broadcast new stroke | `{ ...stroke, id, userId, timestamp }` |
| `cursor-move` | Broadcast cursor position | `{ userId, x, y, label }` |
| `users-updated` | Update active users list | `[username1, username2, ...]` |
| `user-disconnected` | User left room | `userId` |
| `redo-state` | Update redo availability | `boolean` |

## 🛠️ Key Features Explained

### Per-User Undo/Redo
Each user has their own undo/redo stack. When you click undo, only YOUR most recent stroke is removed. This prevents conflicts in collaborative drawing.

### Real-time Synchronization
- When you draw, the stroke is immediately sent to all other users via WebSocket
- New users joining a room automatically receive all existing strokes
- Cursor movements are throttled and broadcast for performance

### Room Lifecycle
- Rooms are created on-demand when first user joins
- Rooms persist until all users leave
- Empty rooms are automatically deleted after 5 minutes

### Stroke Validation
All strokes are validated on the server to ensure:
- Required fields are present (color, width, points)
- Coordinates are within valid bounds (-10000 to 10000)
- Points array is not empty

## 📊 API Endpoints

### GET /api/rooms
Get statistics for all active rooms.

**Response:**
```json
{
  "totalRooms": 3,
  "rooms": [
    {
      "id": "room-ABC123",
      "userCount": 2,
      "strokeCount": 45,
      "createdAt": 1234567890000,
      "ageMinutes": 5
    }
  ]
}
```

### GET /api/rooms/:roomId
Get statistics for a specific room.

**Response:**
```json
{
  "id": "room-ABC123",
  "userCount": 2,
  "strokeCount": 45,
  "createdAt": 1234567890000,
  "ageMinutes": 5
}
```

## 🎨 Customization

### Change Port
**Server:** Edit `server/server.js`, line: `server.listen(3001, ...)`

**Client:** Edit `client/src/Canvas.jsx`, line: `io("http://localhost:3001", ...)`

### Add More Colors
Edit the `userColorPalette` array in `client/src/Canvas.jsx`:
```javascript
const userColorPalette = ['#FF6B6B', '#4ECDC4', /* add more colors */];
```

## 🐛 Troubleshooting

### Clear Button Not Working
- Ensure the clear button has the correct `id` or selector
- Verify a click event listener is attached to the clear button
- Verify undo/redo state is updated after clearing (clear undoStack/redoStack if needed)
- Check browser console for JavaScript errors

### Socket Connected but Username Not Displayed
- User successfully connects to the room
- Room ID is valid
- Realtime connection is active
- Username does not appear in UI or logs

