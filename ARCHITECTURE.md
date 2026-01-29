# Architecture Overview

This document describes the high-level design of the
Real-Time Collaborative Drawing Canvas.

## Client
- React is used for UI structure and lifecycle management
- HTML5 Canvas handles all drawing operations
- Canvas access is handled via refs to avoid unnecessary re-renders

## Server
- Node.js backend responsible for real-time coordination
- WebSockets will be used for event broadcasting
- Rooms isolate independent drawing sessions

## Known Limitations
- No authentication
- No persistence beyond the session
