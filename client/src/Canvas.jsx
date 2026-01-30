import { useEffect, useRef } from "react";
import { redrawCanvas } from "./canvasLogic";
import { socket } from "./websocket";

export default function Canvas() {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const currentStrokeRef = useRef(null);
  const strokesRef = useRef([]);

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
      if (!isDrawingRef.current) return;

      currentStrokeRef.current.points.push(getPoint(e));

      const allStrokes = [
        ...strokesRef.current,
        currentStrokeRef.current
      ];

      redrawCanvas(ctx, allStrokes, canvas);
    }

    function handleMouseUp() {
      if (!isDrawingRef.current) return;

      socket.emit("stroke", currentStrokeRef.current);

      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
    }

    socket.on("stroke", (stroke) => {
      strokesRef.current.push(stroke);
      redrawCanvas(ctx, strokesRef.current, canvas);
    });

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);

      socket.off("stroke");
    };
  }, []);

  function handleUndo() {
    strokesRef.current.pop();
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    redrawCanvas(ctx, strokesRef.current, canvas);
  }

  return (
    <>
      <button
        onClick={handleUndo}
        style={{ position: "absolute", top: 20, left: 20 }}
      >
        Undo
      </button>
      <canvas ref={canvasRef} />
    </>
  );
}
