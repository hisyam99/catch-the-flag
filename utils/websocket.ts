// Declare a WebSocket variable that will be used to maintain the connection
// Initially set to null, indicating no active WebSocket connection
let socket: WebSocket | null = null;

/**
 * Function to establish a WebSocket connection to the game server.
 *
 * @param sessionId - The session ID of the user (used for authentication)
 * @param boardSize - The size of the game board (determines which endpoint to connect to)
 * @returns An object containing the WebSocket instance if successful or an error message if connection fails.
 */
export const connectWebSocket = (
  sessionId: string,
  boardSize: number,
): { socket: WebSocket | null; error: string | null } => {
  try {
    // Check if a WebSocket connection already exists and is either open or in the process of connecting.
    if (
      socket &&
      (socket.readyState === WebSocket.OPEN ||
        socket.readyState === WebSocket.CONNECTING)
    ) {
      // If an active or pending connection exists, return the current socket.
      return { socket, error: null };
    }

    // Determine the protocol based on whether the website is served over HTTPS or HTTP.
    // Use "wss:" for secure WebSocket connection if on HTTPS, otherwise use "ws:".
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";

    // Get the current host (domain and port) from the window location.
    const host = window.location.host;

    // Define endpoints for different board sizes. The key is the board size and the value is the API endpoint.
    const boardEndpoints: { [key: number]: string } = {
      4: "/api/game/board/size/4x4", // Endpoint for 4x4 board
      16: "/api/game/board/size/16x16", // Endpoint for 16x16 board
      256: "/api/game/board/size/256x256", // Endpoint for 256x256 board
      1024: "/api/game/board/size/1024x1024", // Endpoint for 1024x1024 board
    };

    // Select the appropriate endpoint based on the board size, defaulting to 4x4 if not found
    const endpoint = boardEndpoints[boardSize] || boardEndpoints[4];

    // Construct the full WebSocket URL, including the protocol, host, and query parameters (session ID and board size).
    const websocketUrl =
      `${protocol}//${host}${endpoint}?sessionId=${sessionId}&boardSize=${boardSize}`;

    // Create a new WebSocket connection using the constructed URL.
    socket = new WebSocket(websocketUrl);

    // Set up the WebSocket onopen event handler to log a message when the connection is successfully established.
    socket.onopen = () => console.log("WebSocket connected");

    // Return the WebSocket instance and no error message if the connection is successful.
    return { socket, error: null };
  } catch (error) {
    // If any error occurs during connection, return null for the socket and the error message.
    return { socket: null, error: error.message };
  }
};

/**
 * Function to send a player's move to the server via WebSocket.
 *
 * @param index - The index of the cell where the player wants to make a move.
 * @param playerId - The ID of the player making the move.
 */
export const sendMove = (index: number, playerId: string): void => {
  // Check if the WebSocket connection is open before attempting to send a message.
  if (socket?.readyState === WebSocket.OPEN) {
    // Send the move data as a JSON string with the message type, index of the move, and player ID.
    socket.send(JSON.stringify({ type: "move", index, playerId }));
  }
};
