import { io } from "socket.io-client";

const params = new URLSearchParams(window.location.search);
const room = params.get("room") || "default";

console.log("CLIENT connecting to room:", room);

export const socket = io("http://localhost:3001", {
  query: { room }
});
