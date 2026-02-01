import { useEffect, useRef, useState } from "react";
import { redrawCanvas } from "./canvasLogic";
import { io } from "socket.io-client";

function Canvas({ roomId, userId }) {
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

  const userColors = {
    'User A': '#FF6B6B',
    'User B': '#4ECDC4',
    'User C': '#45B7D1',
    'User D': '#FFA07A',
    'User E': '#98D8C8',
    'User F': '#F7DC6F',
    'User G': '#BB8FCE',
    'User H': '#85C1E2'
  };

  const getColorForUser = (username) => {
    return userColors[username] || `#${Math.floor(Math.random()*16777215).toString(16)}`;
  };

  useEffect(() => {
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
  }, [roomId, userId]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const socket = socketRef.current;

    // Set canvas size accounting for the three-panel layout
    const centerPanel = canvas.parentElement;
    canvas.width = centerPanel.clientWidth;
    canvas.height = centerPanel.clientHeight;

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
        userId: userId
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
      
      if (data.canRedo !== undefined) {
        setRedoDisabled(!data.canRedo);
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
      window.removeEventListener("mouseup", handleMouseUp);

      socket.off("stroke");
      socket.off("sync-state");
      socket.off("cursor-move");
      socket.off("user-disconnected");
      socket.off("redo-state");
    };
  }, [currentColor, currentSize, userId]);

  function handleUndo() {
    socketRef.current?.emit("undo");
  }

  function handleRedo() {
    socketRef.current?.emit("redo");
  }

  function handleClear() {
    if (window.confirm('Are you sure you want to clear the entire canvas?')) {
      socketRef.current?.emit("clear-canvas");
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(roomId);
    alert('Copied to clipboard!');
  };

  const getShareLink = () => {
    return `${window.location.origin}?room=${roomId}`;
  };

  return (
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
                padding: '6px 10px',
                borderRadius: '6px',
                fontSize: '11px',
                fontWeight: 'bold',
                whiteSpace: 'nowrap',
                zIndex: 1000,
                boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                transition: 'left 0.05s ease-out, top 0.05s ease-out'
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
      </div>
    </div>
  );
}

export default Canvas;