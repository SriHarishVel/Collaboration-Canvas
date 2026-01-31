import { useEffect, useRef, useState } from "react";
import { redrawCanvas } from "./canvasLogic";
import { socket, roomName } from "./websocket";

export default function Canvas() {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const strokesRef = useRef([]);
  
  const [ghostCursors, setGhostCursors] = useState({});
  const [userLabels, setUserLabels] = useState({});
  const [undoDisabled, setUndoDisabled] = useState(true);
  const [redoDisabled, setRedoDisabled] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth - 40;
    canvas.height = window.innerHeight - 40;

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
        color: "#000",
        width: 4,
        points: [getPoint(e)]
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
      const hasOwnStrokes = strokesRef.current.some(s => s.userId === socket.id);
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

    socket.on("cursor-move", ({ userId, x, y, label }) => {
      setGhostCursors(prev => ({
        ...prev,
        [userId]: { x, y }
      }));
      
      if (label) {
        setUserLabels(prev => ({
          ...prev,
          [userId]: label
        }));
      }
    });

    socket.on("user-disconnected", (userId) => {
      setGhostCursors(prev => {
        const newCursors = { ...prev };
        delete newCursors[userId];
        return newCursors;
      });
      
      setUserLabels(prev => {
        const newLabels = { ...prev };
        delete newLabels[userId];
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
  }, []);

  function handleUndo() {
    socket.emit("undo");
  }

  function handleRedo() {
    socket.emit("redo");
  }

  return (
    <>
      <div className="controls">
        <button onClick={handleUndo} disabled={undoDisabled}>
          Undo
        </button>
        <button onClick={handleRedo} disabled={redoDisabled}>
          Redo
        </button>
      </div>

      <div className="room-info">
        Room: <strong>{roomName}</strong>
      </div>

      <canvas ref={canvasRef} />

      {Object.entries(ghostCursors).map(([userId, pos]) => (
        <div
          key={userId}
          className="ghost-cursor"
          style={{
            position: 'absolute',
            left: `${pos.x + 20}px`,
            top: `${pos.y + 20}px`,
            pointerEvents: 'none',
            backgroundColor: 'rgba(0, 123, 255, 0.8)',
            color: 'white',
            padding: '4px 8px',
            borderRadius: '4px',
            fontSize: '12px',
            fontWeight: 'bold',
            whiteSpace: 'nowrap',
            zIndex: 1000
          }}
        >
          {userLabels[userId] || 'User'}
        </div>
      ))}
    </>
  );
}