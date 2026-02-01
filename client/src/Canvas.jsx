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
  // Room state management
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [showJoinModal, setShowJoinModal] = useState(false);
  const [mode, setMode] = useState(null); // 'create' or 'join'
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
   * Generate a random room ID
   */
  const generateRoomId = () => {
    return 'room-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  /**
   * Handle creating a new room
   */
  const handleCreateRoom = () => {
    if (userInput.trim()) {
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      setUserId(userInput);
      setJoined(true);
      setShowJoinModal(false);
      setMode(null);
      setUserInput('');
    }
  };

  /**
   * Handle joining an existing room
   */
  const handleJoinRoom = () => {
    if (roomInput.trim() && userInput.trim()) {
      setRoomId(roomInput);
      setUserId(userInput);
      setJoined(true);
      setShowJoinModal(false);
      setMode(null);
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
    setShowJoinModal(false);
    setMode(null);
  };

  /**
   * Handle keyboard shortcuts for room forms
   */
  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (mode === 'create') {
        handleCreateRoom();
      } else if (mode === 'join') {
        handleJoinRoom();
      }
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

      return {
        x: (e.clientX - rect.left) * scaleX,
        y: (e.clientY - rect.top) * scaleY
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
      redrawCanvas(ctx, allStrokes, canvas);
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

    

    function updateUndoRedoButtons() {
      const hasOwnStrokes = strokesRef.current.some(s => s.userId === userId);
      setUndoDisabled(!hasOwnStrokes);
    }

    socket.on("stroke", (stroke) => {
      strokesRef.current.push(stroke);
      redrawCanvas(ctx, strokesRef.current, canvas);
      updateUndoRedoButtons();
    });

    socket.on("sync-state", (data) => {
      const strokes = data.strokes || data;
      strokesRef.current = strokes;
      redrawCanvas(ctx, strokesRef.current, canvas);
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
  }, [currentColor, currentSize, roomId, userId, joined]);

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
    navigator.clipboard.writeText(roomId);
    alert('Copied to clipboard!');
  };

  // If not joined, show the join/create modal overlay
  if (!joined) {
    return (
      <div className="app-container">
        <div className="modal-overlay">
          <div className="modal-content">
            <h1>🎨 Collaborative Canvas</h1>
            <p className="modal-subtitle">Real-time collaborative drawing</p>

            {!mode ? (
              <div className="mode-selection">
                <button className="mode-btn create-btn" onClick={() => setMode('create')}>
                  ➕ Create New Room
                </button>
                <div className="divider-text">OR</div>
                <button className="mode-btn join-btn" onClick={() => setMode('join')}>
                  🔗 Join Existing Room
                </button>
              </div>
            ) : (
              <div className="room-form">
                {mode === 'create' ? (
                  <>
                    <p className="form-info">Create a new room for your team</p>
                    <div className="input-group">
                      <label>Your Username</label>
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        autoFocus
                      />
                    </div>
                    <button className="action-button create-btn" onClick={handleCreateRoom}>
                      Create & Enter
                    </button>
                  </>
                ) : (
                  <>
                    <p className="form-info">Join a room with the room code</p>
                    <div className="input-group">
                      <label>Room Code</label>
                      <input
                        type="text"
                        placeholder="e.g., room-ABC123"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        autoFocus
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
                    <button className="action-button join-btn" onClick={handleJoinRoom}>
                      Join Room
                    </button>
                  </>
                )}

                <button className="back-button" onClick={() => {
                  setMode(null);
                  setRoomInput('');
                  setUserInput('');
                }}>
                  ← Back
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Join Another Room Modal */}
      {showJoinModal && (
        <div className="modal-overlay" onClick={() => setShowJoinModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>🚪 Join Another Room</h2>
            <p className="modal-subtitle">Switch to a different room</p>

            {!mode ? (
              <div className="mode-selection">
                <button className="mode-btn create-btn" onClick={() => setMode('create')}>
                  ➕ Create New Room
                </button>
                <div className="divider-text">OR</div>
                <button className="mode-btn join-btn" onClick={() => setMode('join')}>
                  🔗 Join Existing Room
                </button>
              </div>
            ) : (
              <div className="room-form">
                {mode === 'create' ? (
                  <>
                    <p className="form-info">Create a new room</p>
                    <div className="input-group">
                      <label>Your Username</label>
                      <input
                        type="text"
                        placeholder="Enter your name"
                        value={userInput}
                        onChange={(e) => setUserInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        autoFocus
                      />
                    </div>
                    <button className="action-button create-btn" onClick={() => {
                      handleLeaveRoom();
                      handleCreateRoom();
                    }}>
                      Create & Switch
                    </button>
                  </>
                ) : (
                  <>
                    <p className="form-info">Enter room code to join</p>
                    <div className="input-group">
                      <label>Room Code</label>
                      <input
                        type="text"
                        placeholder="e.g., room-ABC123"
                        value={roomInput}
                        onChange={(e) => setRoomInput(e.target.value)}
                        onKeyPress={handleKeyPress}
                        autoFocus
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
                    <button className="action-button join-btn" onClick={() => {
                      handleLeaveRoom();
                      handleJoinRoom();
                    }}>
                      Switch Room
                    </button>
                  </>
                )}

                <button className="back-button" onClick={() => {
                  setMode(null);
                  setRoomInput('');
                  setUserInput('');
                }}>
                  ← Back
                </button>
              </div>
            )}

            <button className="back-button" onClick={() => setShowJoinModal(false)} style={{marginTop: '10px'}}>
              ✕ Cancel
            </button>
          </div>
        </div>
      )}

    <div className="canvas-container">{/* Left Panel - Controls */}
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
        </div>

        {/* Join Another Room Card */}
        <div className="share-card">
          <h3 className="card-title">🚪 Switch Room</h3>
          <p className="share-info">Want to join a different room?</p>
          
          <button 
            onClick={() => setShowJoinModal(true)} 
            className="btn btn-join-another"
            title="Join or create another room"
          >
            🔗 Join Another Room
          </button>
        </div>
      </div>
    </div>
    </>
  );
}

export default Canvas;