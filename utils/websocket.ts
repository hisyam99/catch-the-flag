let socket: WebSocket | null = null;

export const connectWebSocket = (
  sessionId: string,
  boardSize: number,
): { socket: WebSocket | null; error: string | null } => {
  try {
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      return { socket, error: null };
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;

    const boardEndpoints: { [key: number]: string } = {
      4: "/api/game/board/size/4x4",
      16: "/api/game/board/size/16x16",
      256: "/api/game/board/size/256x256",
      1024: "/api/game/board/size/1024x1024",
    };

    const endpoint = boardEndpoints[boardSize] || boardEndpoints[4]; // Default ke 4x4 jika ukuran tidak cocok
    const websocketUrl =
      `${protocol}//${host}${endpoint}?sessionId=${sessionId}&boardSize=${boardSize}`;

    socket = new WebSocket(websocketUrl);

    socket.onopen = () => console.log("WebSocket connected");

    return { socket, error: null };
  } catch (error) {
    return { socket: null, error: error.message };
  }
};

export const sendMove = (index: number, playerId: string): void => {
  if (socket?.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "move", index, playerId }));
  }
};
