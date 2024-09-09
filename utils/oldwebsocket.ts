let socket: WebSocket | null = null;

export const connectWebSocket = (sessionId: string, boardSize: number): { socket: WebSocket | null; error: string | null } => {
  try {
    if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      return { socket, error: null };
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;

    const websocketUrl = `${protocol}//${host}/api/game?sessionId=${sessionId}&boardSize=${boardSize}`;

    socket = new WebSocket(websocketUrl);

    socket.onopen = (): void => {
      console.log('WebSocket connected');
    };

    return { socket, error: null };
  } catch (error) {
    return { socket: null, error: error.message };
  }
};

export const sendMove = (index: number, playerId: string): void => {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "move", index, playerId }));
  }
};
