import { useState } from 'react';
import Canvas from './Canvas';
import './index.css';

export default function App() {
  const [joined, setJoined] = useState(false);
  const [roomId, setRoomId] = useState('');
  const [userId, setUserId] = useState('');
  const [mode, setMode] = useState(null); // 'create' or 'join'
  const [roomInput, setRoomInput] = useState('');
  const [userInput, setUserInput] = useState('');

  // Generate random room ID
  const generateRoomId = () => {
    return 'room-' + Math.random().toString(36).substring(2, 8).toUpperCase();
  };

  const handleCreateRoom = () => {
    if (userInput.trim()) {
      const newRoomId = generateRoomId();
      setRoomId(newRoomId);
      setUserId(userInput);
      setJoined(true);
    }
  };

  const handleJoinRoom = () => {
    if (roomInput.trim() && userInput.trim()) {
      setRoomId(roomInput);
      setUserId(userInput);
      setJoined(true);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      if (mode === 'create') {
        handleCreateRoom();
      } else if (mode === 'join') {
        handleJoinRoom();
      }
    }
  };

  return (
    <div className="app-container">
      {!joined ? (
        <div className="modal-overlay">
          <div className="modal-content">
            <h1>🎨 Collaboration Canvas</h1>
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
      ) : (
        <Canvas roomId={roomId} userId={userId} />
      )}
    </div>
  );
}
