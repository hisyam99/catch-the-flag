let socket: WebSocket | null = null;

export function connectWebSocket(): { socket: WebSocket | null; error: string | null } {
  try {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return { socket, error: null };
    }

    socket = new WebSocket(`ws://${window.location.host}/api/game`);
    
    socket.onopen = () => {
      console.log("WebSocket connected");
    };

    return { socket, error: null };
  } catch (error) {
    console.error("WebSocket connection error:", error);
    return { socket: null, error: error.message };
  }
}

export function sendMove(index: number, playerId: string) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "move", index, playerId }));
  } else {
    console.error("WebSocket is not open. Cannot send move.");
  }
}