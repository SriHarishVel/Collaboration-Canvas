/**
 * Main Application Component
 * 
 * Manages the entire application state and renders the Canvas component.
 * The app starts directly on the canvas page where users can create or join rooms.
 */

import Canvas from './Canvas';
import './index.css';

export default function App() {
  return <Canvas />;
}
