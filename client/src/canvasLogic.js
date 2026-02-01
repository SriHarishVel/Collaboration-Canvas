/**
 * Canvas Drawing Logic Module
 * 
 * Handles all canvas rendering operations including:
 * - Drawing strokes with proper styling
 * - Canvas clearing and redrawing
 */

/**
 * Redraw the entire canvas with all strokes
 *
 * @param {CanvasRenderingContext2D} ctx - Canvas 2D context
 * @param {Array} strokes - Array of stroke objects to draw
 * @param {HTMLCanvasElement} canvas - Canvas element
 */
export function redrawCanvas(ctx, strokes, canvas) {
  // Clear the entire canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  // Save the current context state before applying transformations
  ctx.save();
  

  // Draw each stroke
  strokes.forEach(stroke => {
    // Skip invalid strokes
    if (!stroke.points || stroke.points.length === 0) return;

    // Set stroke styling
    ctx.strokeStyle = stroke.color;
    ctx.lineWidth = stroke.width;
    ctx.lineCap = 'round';    // Rounded end caps for smooth lines
    ctx.lineJoin = 'round';   // Rounded corners for smooth joins

    // Begin drawing the stroke path
    ctx.beginPath();
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y);
    
    // Connect all points in the stroke
    for (let i = 1; i < stroke.points.length; i++) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y);
    }
    
    // Render the stroke
    ctx.stroke();
  });
  
  // Restore the context state (remove transformations)
  ctx.restore();
}