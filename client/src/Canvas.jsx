/**
 * Canvas Component
 * 
 * Main collaborative drawing interface with integrated room management.
 * Handles room creation, joining, drawing, and real-time collaboration.
 */

import { useEffect, useRef, useState } from "react";
import { redrawCanvas } from "./canvasLogic";
import { io } from "socket.io-client";

function Canvas() {
  // Generate random IDs
  const generateRoomId = () => 'room-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  const generateUserId = () => 'User-' + Math.random().toString(36).substring(2, 6).toUpperCase();

  // Room state management - start with NO room
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [roomInput, setRoomInput] = useState('');
  const [userInput, setUserInput] = useState('');

  // Canvas and drawing state
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const strokesRef = useRef([]);
  const [ghostCursors, setGhostCursors] = useState({});
  const [userLabels, setUserLabels] = useState({});
  const [users, setUsers] = useState([]);
  const [currentColor, setCurrentColor] = useState('#000000');
  const [currentSize, setCurrentSize] = useState(3);
  const [undoDisabled, setUndoDisabled] = useState(true);
  const [redoDisabled, setRedoDisabled] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [panX, setPanX] = useState(0);
  const [panY, setPanY] = useState(0);

  // Predefined color palette for users
  const userColorPalette = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E2'];
  const userColorMapRef = useRef({});
  const colorIndexMapRef = useRef({});

  /**
   * Assign a unique color to each user based on their username
   */
  const getColorForUser = (username) => {
    if (!username) return '#000000';
    
    if (!userColorMapRef.current[username]) {
      // Assign colors in order based on when they're first seen
      const assignedCount = Object.keys(userColorMapRef.current).length;
      const colorIndex = assignedCount % userColorPalette.length;
      userColorMapRef.current[username] = userColorPalette[colorIndex];
      colorIndexMapRef.current[username] = colorIndex;
    }
    return userColorMapRef.current[username];
  };

  /**
   * Handle creating a new room
   */
  const handleCreateRoom = () => {
    if (userInput.trim()) {
      socketRef.current?.disconnect();
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      setUserId(userInput);
      setJoined(true);
      setUsers([]);
      setGhostCursors({});
      setUserLabels({});
      strokesRef.current = [];
      setUserInput('');
    }
  };

  /**
   * Handle joining an existing room
   */
  const handleJoinRoom = () => {
    if (roomInput.trim() && userInput.trim()) {
      socketRef.current?.disconnect();
      setRoomId(roomInput);
      setUserId(userInput);
      setJoined(true);
      setUsers([]);
      setGhostCursors({});
      setUserLabels({});
      strokesRef.current = [];
      setRoomInput('');
      setUserInput('');
    }
  };

  /**
   * Handle leaving the current room
   */
  const handleLeaveRoom = () => {
    socketRef.current?.disconnect();
    setJoined(false);
    setRoomId('');
    setUserId('');
    setUsers([]);
    setGhostCursors({});
    setUserLabels({});
    strokesRef.current = [];
  };

  /**
   * Handle keyboard shortcuts for room forms
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleJoinRoom();
    }
  };

  /**
   * Initialize WebSocket connection when room is joined
   */
  useEffect(() => {
    if (!joined || !roomId || !userId) return;

    socketRef.current = io("http://localhost:3001", {
      query: { room: roomId }
    });

    const socket = socketRef.current;
    
    socket.on("connect", () => {
      console.log("Connected to server:", socket.id);
      socket.emit("register-user", { userId, username: userId });
    });

    return () => {
      socket.off("connect");
    };
  }, [roomId, userId, joined]);

  useEffect(() => {
    if (!joined || !canvasRef.current || !socketRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const socket = socketRef.current;

    // Set canvas size to match the container
    const centerPanel = canvas.parentElement;
    const rect = centerPanel.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    function getPoint(e) {
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      // Account for zoom and pan
      return {
        x: ((e.clientX - rect.left) * scaleX - panX) / zoom,
        y: ((e.clientY - rect.top) * scaleY - panY) / zoom
      };
    }


    function handleMouseDown(e) {
      isDrawingRef.current = true;
      currentStrokeRef.current = {
        color: currentColor,
        width: currentSize,
        points: [getPoint(e)],
        userId: userId,
        timestamp: Date.now()
      };
    }

    function handleMouseMove(e) {
      const point = getPoint(e);
      socket.emit("cursor-move", point);

      if (!isDrawingRef.current) return;

      currentStrokeRef.current.points.push(point);
      const allStrokes = [...strokesRef.current, currentStrokeRef.current];
      redrawCanvas(ctx, allStrokes, canvas, zoom, panX, panY);
    }

    function handleMouseUp() {
      if (!isDrawingRef.current) return;

      socket.emit("stroke", currentStrokeRef.current);
      strokesRef.current.push(currentStrokeRef.current);
      
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
      
      updateUndoRedoButtons();
    }

    function handleMouseLeave() {
      if (isDrawingRef.current) {
        handleMouseUp();
      }
    }

    function handleWheel(e) {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;
      
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = zoom * delta;
      
      // Clamp zoom between 0.5x and 5x
      if (newZoom >= 0.5 && newZoom <= 5) {
        const newPanX = mouseX - (mouseX - panX) * (newZoom / zoom);
        const newPanY = mouseY - (mouseY - panY) * (newZoom / zoom);
        
        setZoom(newZoom);
        setPanX(newPanX);
        setPanY(newPanY);
      }
    }

    function updateUndoRedoButtons() {
      const hasOwnStrokes = strokesRef.current.some(s => s.userId === userId);
      setUndoDisabled(!hasOwnStrokes);
    }

    socket.on("stroke", (stroke) => {
      strokesRef.current.push(stroke);
      redrawCanvas(ctx, strokesRef.current, canvas, zoom, panX, panY);
      updateUndoRedoButtons();
    });

    socket.on("sync-state", (data) => {
      const strokes = data.strokes || data;
      strokesRef.current = strokes;
      redrawCanvas(ctx, strokesRef.current, canvas, zoom, panX, panY);
      updateUndoRedoButtons();
      
      // Update button states only for current user
      if (data.userId === socketRef.current.id) {
        if (data.canUndo !== undefined) {
          setUndoDisabled(!data.canUndo);
        }
        if (data.canRedo !== undefined) {
          setRedoDisabled(!data.canRedo);
        }
      }
    });

    socket.on("users-updated", (userList) => {
      setUsers(userList);
    });

    socket.on("cursor-move", ({ userId: movingUserId, x, y, label }) => {
      setGhostCursors(prev => ({
        ...prev,
        [movingUserId]: { x, y }
      }));
      
      if (label) {
        setUserLabels(prev => ({
          ...prev,
          [movingUserId]: label
        }));
      }
    });

    socket.on("user-disconnected", (disconnectedUserId) => {
      setGhostCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[disconnectedUserId];
        return newCursors;
      });
      
      setUserLabels(prev => {
        const newLabels = { ...prev };
        delete newLabels[disconnectedUserId];
        return newLabels;
      });
    });

    socket.on("redo-state", (canRedo) => {
      setRedoDisabled(!canRedo);
    });

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    canvas.addEventListener("mouseleave", handleMouseLeave);
    canvas.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("mouseleave", handleMouseLeave);
      canvas.removeEventListener("wheel", handleWheel);
      window.removeEventListener("mouseup", handleMouseUp);

      socket.off("stroke");
      socket.off("sync-state");
      socket.off("cursor-move");
      socket.off("user-disconnected");
      socket.off("redo-state");
    };
  }, [currentColor, currentSize, roomId, userId, zoom, panX, panY, joined]);

  function handleUndo() {
    console.log("Undo clicked by user:", userId);
    socketRef.current?.emit("undo");
  }

  function handleRedo() {
    console.log("Redo clicked by user:", userId);
    socketRef.current?.emit("redo");
  }

  function handleClear() {
    if (window.confirm('Are you sure you want to clear YOUR drawings from this canvas?')) {
      socketRef.current?.emit("clear-canvas", { userId });
    }
  }

  const copyToClipboard = () => {
    const text = `Join me in Collaboration Canvas! Room Code: ${roomId}`;
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const getShareLink = () => {
    return `${window.location.origin}?room=${roomId}`;
  };

  return (
    <>
    <div className="canvas-container">
      {/* Left Panel - Controls */}
      <div className="left-panel">
        <div className="control-card">
          <h3 className="card-title">🎨 Canvas Controls</h3>
          
          <div className="control-group">
            <label className="label-text">Brush Color</label>
            <div className="color-picker-wrapper">
              <input
                type="color"
                value={currentColor}
                onChange={(e) => setCurrentColor(e.target.value)}
                className="color-picker"
              />
              <span className="color-code">{currentColor}</span>
            </div>
          </div>

          <div className="control-group">
            <label className="label-text">Brush Size: <strong>{currentSize}px</strong></label>
            <input
              type="range"
              min="1"
              max="30"
              value={currentSize}
              onChange={(e) => setCurrentSize(parseInt(e.target.value))}
              className="slider"
            />
            <div className="size-preview">
              <div 
                style={{
                  width: currentSize,
                  height: currentSize,
                  borderRadius: '50%',
                  backgroundColor: currentColor,
                  margin: '0 auto'
                }}
              ></div>
            </div>
          </div>

          <div className="button-group">
            <button 
              onClick={handleUndo} 
              disabled={undoDisabled}
              className="btn btn-undo"
              title="Undo last stroke"
            >
              ↶ Undo
            </button>
            <button 
              onClick={handleRedo} 
              disabled={redoDisabled}
              className="btn btn-redo"
              title="Redo last action"
            >
              ↷ Redo
            </button>
          </div>

          <div className="zoom-controls">
            <label className="label-text">🔍 Zoom: {(zoom * 100).toFixed(0)}%</label>
            <div className="zoom-buttons">
              <button 
                onClick={() => setZoom(Math.max(0.5, zoom - 0.2))}
                className="btn btn-zoom"
                title="Zoom out"
              >
                −
              </button>
              <button 
                onClick={() => setZoom(1)}
                className="btn btn-zoom"
                title="Reset zoom"
              >
                1x
              </button>
              <button 
                onClick={() => setZoom(Math.min(5, zoom + 0.2))}
                className="btn btn-zoom"
                title="Zoom in"
              >
                +
              </button>
            </div>
            <input 
              type="range" 
              min="50" 
              max="500" 
              value={zoom * 100} 
              onChange={(e) => setZoom(parseInt(e.target.value) / 100)}
              className="slider"
              title="Adjust zoom level"
            />
          </div>

          <button onClick={handleClear} className="btn btn-clear">
            🗑 Clear Canvas
          </button>

          <div className="room-badge">
            <span className="badge-label">Room:</span>
            <span className="badge-value">{roomId}</span>
          </div>
        </div>
      </div>

      {/* Center - Canvas */}
      <div className="center-panel">
        <div className="canvas-wrapper">
          <canvas
            ref={canvasRef}
            className="drawing-canvas"
          />
          
          {/* Fixed guest name labels at top-right */}
          {Object.entries(userLabels)
            .filter(([uid]) => uid !== userId)
            .map(([cursorUserId, label], index) => (
              <div
                key={`label-${cursorUserId}`}
                className="guest-label-fixed"
                style={{
                  position: 'absolute',
                  top: `${20 + index * 30}px`,
                  right: '15px',
                  pointerEvents: 'none',
                  backgroundColor: getColorForUser(label),
                  color: 'white',
                  padding: '8px 14px',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 'bold',
                  whiteSpace: 'nowrap',
                  zIndex: 1001,
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)'
                }}
              >
                ● {label}
              </div>
            ))}
          
          {/* Moving ghost cursors */}
          {Object.entries(ghostCursors).map(([cursorUserId, pos]) => (
            <div
              key={cursorUserId}
              className="ghost-cursor"
              style={{
                position: 'absolute',
                left: `${pos.x + 15}px`,
                top: `${pos.y + 15}px`,
                pointerEvents: 'none',
                backgroundColor: getColorForUser(userLabels[cursorUserId]),
                color: 'white',
                padding: '4px 6px',
                borderRadius: '4px',
                fontSize: '9px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                zIndex: 999,
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.15)',
                transition: 'left 0.05s ease-out, top 0.05s ease-out',
                opacity: 0.8
              }}
            >
              {userLabels[cursorUserId] || 'User'}
            </div>
          ))}
        </div>
      </div>

      {/* Right Panel - Users */}
      <div className="right-panel">
        <div className="users-card">
          <h3 className="card-title">👥 Active Users ({users.length})</h3>
          <div className="users-list">
            {users.length === 0 ? (
              <p className="no-users">Waiting for users...</p>
            ) : (
              users.map((user, idx) => (
                <div key={idx} className="user-item">
                  <div
                    className="user-color-dot"
                    style={{ backgroundColor: getColorForUser(user) }}
                    title={user}
                  ></div>
                  <span className="user-name">{user}</span>
                  {user === userId && <span className="badge-current">You</span>}
                </div>
              ))
            )}
          </div>
          
          
          <button 
            onClick={handleLeaveRoom} 
            className="btn btn-leave"
            title="Leave the room"
          >
            🚪 Leave Room
          </button>
        </div>

        {/* Share Room Card */}
        <div className="share-card">
          <h3 className="card-title">🔗 Share Room</h3>
          <p className="share-info">Invite friends with this code:</p>
          
          <div className="room-code-display">
            <span className="room-code">{roomId}</span>
            <button className="copy-btn" onClick={copyToClipboard} title="Copy room code">
              📋
            </button>
          </div>

          <p className="share-text">Share this code with your friends</p>
          
          <div className="share-badges">
            <span className="share-icon">📱</span>
            <span className="share-icon">💬</span>
            <span className="share-icon">📧</span>
          </div>
        </div>

        {/* Room Management Card */}
        <div className="share-card">
          <h3 className="card-title">🚪 Room Management</h3>
          
          <div className="room-management">
            <div className="input-group">
              <label>Your Username</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleCreateRoom()}
              />
            </div>
            <button 
              onClick={handleCreateRoom}
              className="btn btn-create-room"
              disabled={!userInput.trim()}
              title="Create a new room with your username"
            >
              ➕ Create New Room
            </button>

            <div className="divider-line">OR</div>

            <div className="input-group">
              <label>Room Code</label>
              <input
                type="text"
                placeholder="e.g., room-ABC123"
                value={roomInput}
                onChange={(e) => setRoomInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <div className="input-group">
              <label>Your Username</label>
              <input
                type="text"
                placeholder="Enter your name"
                value={userInput}
                onChange={(e) => setUserInput(e.target.value)}
                onKeyPress={handleKeyPress}
              />
            </div>
            <button 
              onClick={handleJoinRoom}
              className="btn btn-join-room"
              disabled={!roomInput.trim() || !userInput.trim()}
              title="Join an existing room"
            >
              🔗 Join Existing Room
            </button>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}

export default Canvas;
