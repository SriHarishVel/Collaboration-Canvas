import { useEffect, useRef } from "react";
import { redrawCanvas } from "./canvasLogic";

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
      return {
        x: e.offsetX,
        y: e.offsetY
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

      strokesRef.current.push(currentStrokeRef.current);
      currentStrokeRef.current = null;
      isDrawingRef.current = false;
    }

    canvas.addEventListener("mousedown", handleMouseDown);
    canvas.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      canvas.removeEventListener("mousedown", handleMouseDown);
      canvas.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
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
