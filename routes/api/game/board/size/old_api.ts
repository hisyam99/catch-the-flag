import { Handlers } from "$fresh/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import {
  getUserProfileFromSession,
  getUserSessionId,
} from "@/plugins/kv_oauth.ts";

// Game duration in milliseconds (1 minute)
const GAME_DURATION = 60000;

// Interface representing a player object
interface Player {
  id: string;              // Unique ID for the player (from OAuth profile)
  profileImage: string;    // URL to the player's profile image
  socket: WebSocket;       // WebSocket connection for real-time communication
}

// Interface representing the overall state of the game
interface GameState {
  players: Map<string, Player>;  // Collection of connected players, keyed by their ID
  winner: string | null;         // ID of the winning player (or null if no winner yet)
  gameEndTime: number;           // Timestamp indicating when the current game ends
  isGameRunning: boolean;        // Flag to track if a game is currently active
}

// Bitmask representing the game board, where each bit corresponds to a cell in the 16x16 grid (16 * 16 cells total)
let bitmaskBoard: number = 0;

// Array representing player ownership for each cell on the board (16 * 16 cells), initialized to null (no ownership)
let playerBoard: (string | null)[] = Array(16 * 16).fill(null);

// Initial state of the game
const gameState: GameState = {
  players: new Map<string, Player>(),  // No players initially connected
  winner: null,                        // No winner initially
  gameEndTime: 0,                      // Game end time not set initially
  isGameRunning: false,                // Game is not running initially
};

// Function to check if a specific cell on the board has already been filled
function isCellFilled(index: number): boolean {
  return (bitmaskBoard & (1 << index)) !== 0;  // Use bitmask to check if the cell is occupied
}

// Function to fill a specific cell on the board with a player's ID
function fillCell(index: number, playerId: string) {
  bitmaskBoard |= 1 << index;           // Set the corresponding bit in the bitmask
  playerBoard[index] = playerId;        // Mark the cell with the player's ID
}

// Function to broadcast the current game state to all connected players via WebSocket
function broadcastGameState() {
  const message = JSON.stringify({
    type: "boardUpdate",  // Message type indicating a board update
    board: playerBoard,   // The current state of the board (which player owns which cell)
    timeLeft: Math.max(
      0,
      Math.floor((gameState.gameEndTime - Date.now()) / 1000),  // Remaining game time in seconds
    ),
    players: Array.from(gameState.players.values()).map((p) => ({
      id: p.id,             // Player ID
      profileImage: p.profileImage,  // Player's profile image
    })),
  });

  // Send the game state to all connected players
  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

// Function to start a new game
function startNewGame() {
  // Reset game board and state
  bitmaskBoard = 0;                         // Reset the bitmask board to 0 (no cells filled)
  playerBoard = Array(16 * 16).fill(null);       // Clear the player ownership board
  gameState.winner = null;                  // No winner initially
  gameState.gameEndTime = Date.now() + GAME_DURATION;  // Set the game end time to current time + game duration
  gameState.isGameRunning = true;           // Mark that the game is running

  // Broadcast the updated game state to all players
  broadcastGameState();

  // Set up a periodic interval to update and broadcast the game state every second
  const gameInterval = setInterval(() => {
    const timeLeft = Math.max(
      0,
      Math.floor((gameState.gameEndTime - Date.now()) / 1000),  // Calculate time left in seconds
    );
    if (timeLeft > 0) {
      broadcastGameState();  // Broadcast the game state if time is remaining
    } else {
      clearInterval(gameInterval);  // Clear interval if time has run out
      endGame();  // End the game
    }
  }, 1000);

  // Ensure the game ends after the full game duration, even if no one has won
  setTimeout(() => {
    clearInterval(gameInterval);  // Clear interval to stop updates
    endGame();  // End the game
  }, GAME_DURATION);
}

// Function to end the game and declare a winner (if any)
function endGame() {
  // If no winner has been declared, randomly select a winner
  if (!gameState.winner) {
    const winningIndex = Math.floor(
      crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 - 1) * (16 * 16),  // Randomly pick a winning cell index
    );
    gameState.winner = playerBoard[winningIndex];  // Set the winner to the player who owns the selected cell
    playerBoard[winningIndex] = "winner";          // Mark the winning cell on the board
  }

  // Mark the game as no longer running
  gameState.isGameRunning = false;

  // Broadcast the final game state to all players
  broadcastGameState();

  // Broadcast the winner to all players
  broadcastWinner();

  // Start a new game after a 5-second delay
  setTimeout(startNewGame, 5000);
}

// Function to broadcast the winner of the game to all players
function broadcastWinner() {
  const message = JSON.stringify({
    type: "winner",          // Message type indicating a winner has been declared
    winner: gameState.winner,  // The winner's ID (or null if no winner)
  });

  // Send the winner message to all connected players
  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

// WebSocket handler for the game
export const handler: Handlers = {
  async GET(req) {
    // Get the current user's session ID (from cookies or other session storage)
    const sessionId = await getUserSessionId(req);

    // If no session ID is found, respond with unauthorized status
    if (!sessionId) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Fetch the user's profile based on the session ID
    const userProfile = await getUserProfileFromSession(sessionId);
    if (!userProfile) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Upgrade the HTTP request to a WebSocket connection
    const { socket, response } = Deno.upgradeWebSocket(req);
    const playerId = userProfile.id;  // Get the player ID from the user's profile
    const profileImage = userProfile.picture || "/img/avatar.webp";  // Use profile picture or a default avatar

    // Create a player object representing the connected user
    const player: Player = {
      id: playerId,
      profileImage: profileImage,
      socket: socket,
    };

    // Add the player to the game state
    gameState.players.set(playerId, player);

    // Set up WebSocket event handlers
    socket.onopen = () => {
      // Send player info to the client upon connection
      socket.send(
        JSON.stringify({
          type: "playerInfo",
          id: playerId,
          profileImage: profileImage,
        }),
      );

      // Broadcast the updated game state to all players
      broadcastGameState();

      // If no game is running and this is the first player, start a new game
      if (!gameState.isGameRunning && gameState.players.size === 1) {
        startNewGame();
      }
    };

    // Handle incoming messages from the client (e.g., player moves)
    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      // If the player sends a "move" message, handle the move
      if (
        data.type === "move" && !gameState.winner && gameState.isGameRunning
      ) {
        const { index, playerId } = data;
        // If the selected cell is not filled, mark it with the player's ID
        if (!isCellFilled(index)) {
          fillCell(index, playerId);
          broadcastGameState();

          // If all cells are filled (bitmask 0xFFFF), end the game
          if (bitmaskBoard === 0xFFFF) {
            endGame();
          }
        }
      }
    };

    // Handle WebSocket disconnection (when a player leaves)
    socket.onclose = () => {
      // Remove the player from the game state
      gameState.players.delete(playerId);
      // Broadcast the updated game state to all players
      broadcastGameState();
    };

    // Return the upgraded WebSocket response
    return response;
  },
};

// If there are players in the game but no game is running, start a new game
if (gameState.players.size > 0 && !gameState.isGameRunning) {
  startNewGame();
}
