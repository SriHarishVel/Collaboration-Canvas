import { useEffect, useRef } from "react";

export default function Canvas() {
  const canvasRef = useRef(null);
  const isDrawingRef = useRef(false);
  const lastPointRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    canvas.width = window.innerWidth-40;
    canvas.height = window.innerHeight-40;

    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.lineWidth = 20;
    ctx.strokeStyle = "#000";

    function getPoint(e) {
      return {
        x: e.clientX,
        y: e.clientY
      };
    }

    function handleMouseDown(e) {
      isDrawingRef.current = true;
      lastPointRef.current = getPoint(e);
    }

    function handleMouseMove(e) {
      if (!isDrawingRef.current) return;

      const currentPoint = getPoint(e);

      ctx.beginPath();
      ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
      ctx.lineTo(currentPoint.x, currentPoint.y);
      ctx.stroke();

      lastPointRef.current = currentPoint;
    }

    function handleMouseUp() {
      isDrawingRef.current = false;
      lastPointRef.current = null;
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

  return <canvas ref={canvasRef} />;
}
