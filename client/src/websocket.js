import { io } from "socket.io-client";

const params = new URLSearchParams(window.location.search);
const room = params.get("room") || "default";

export const socket = io("http://localhost:3001", {
  query: { room }
});

export const roomName = room;

socket.on("connect", () => {
  console.log("Connected to server:", socket.id);
});

socket.on("disconnect", () => {
  console.log("Disconnected from server");
});

socket.on("connect_error", (error) => {
  console.error("Connection error:", error);
});