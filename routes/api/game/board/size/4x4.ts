// Import required modules and functions
import { Handlers } from "$fresh/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import {
  getUserProfileFromSession,
  getUserSessionId,
} from "@/plugins/kv_oauth.ts";

// Constants
// Game duration in milliseconds (1 minute)
const GAME_DURATION = 60000;

// Interfaces

/**
 * Represents a player in the game
 */
interface Player {
  id: string;
  profileImage: string;
  socket: WebSocket;
}

/**
 * Represents the overall state of the game
 */
interface GameState {
  players: Map<string, Player>;
  winner: string | null;
  winningCell: number | null;
  gameEndTime: number;
  isGameRunning: boolean;
}

// Game state variables

/**
 * Bitmask representation of the game board
 * Each bit represents a cell, 1 if filled, 0 if empty
 */
let bitmaskBoard: number = 0;

/**
 * Array representation of the game board
 * Each element is either null (empty) or a player's ID
 */
let playerBoard: (string | null)[] = Array(16).fill(null);

/**
 * The current state of the game
 */
const gameState: GameState = {
  players: new Map<string, Player>(),
  winner: null,
  winningCell: null,
  gameEndTime: 0,
  isGameRunning: false,
};

/**
 * Checks if a cell is filled
 * @param index - The index of the cell to check
 * @returns True if the cell is filled, false otherwise
 */
function isCellFilled(index: number): boolean {
  return (bitmaskBoard & (1 << index)) !== 0;
}

/**
 * Fills a cell with a player's move
 * @param index - The index of the cell to fill
 * @param playerId - The ID of the player making the move
 */
function fillCell(index: number, playerId: string) {
  bitmaskBoard |= 1 << index;
  playerBoard[index] = playerId;
}

/**
 * Broadcasts the current game state to all connected players
 */
function broadcastGameState() {
  const message = JSON.stringify({
    type: "boardUpdate",
    board: playerBoard,
    timeLeft: Math.max(
      0,
      Math.floor((gameState.gameEndTime - Date.now()) / 1000),
    ),
    players: Array.from(gameState.players.values()).map((p) => ({
      id: p.id,
      profileImage: p.profileImage,
    })),
    winningCell: gameState.winningCell,
    winner: gameState.winner,
  });

  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

/**
 * Starts a new game
 */
function startNewGame() {
  // Reset game state
  bitmaskBoard = 0;
  playerBoard = Array(16).fill(null);
  gameState.winner = null;
  gameState.winningCell = null;
  gameState.gameEndTime = Date.now() + GAME_DURATION;
  gameState.isGameRunning = true;

  broadcastGameState();

  // Set up interval to broadcast game state every second
  const gameInterval = setInterval(() => {
    const timeLeft = Math.max(
      0,
      Math.floor((gameState.gameEndTime - Date.now()) / 1000),
    );
    if (timeLeft > 0) {
      broadcastGameState();
    } else {
      clearInterval(gameInterval);
      endGame();
    }
  }, 1000);

  // Set up timeout to end the game after GAME_DURATION
  setTimeout(() => {
    clearInterval(gameInterval);
    endGame();
  }, GAME_DURATION);
}

/**
 * Ends the current game
 */
function endGame() {
  const allCellsFilled = bitmaskBoard === 0xFFFF;
  const timeIsUp = Date.now() >= gameState.gameEndTime;

  if (allCellsFilled || timeIsUp) {
    // Get all filled cell indices
    const filledCells = playerBoard.reduce((acc, cell, index) => 
      cell !== null ? [...acc, index] : acc, [] as number[]);
    
    if (filledCells.length > 0) {
      // Randomly select a winning cell from filled cells
      const randomIndex = Math.floor(
        crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 - 1) * filledCells.length
      );
      gameState.winningCell = filledCells[randomIndex];
      gameState.winner = playerBoard[gameState.winningCell];
    } else {
      // If no cells are filled, randomly select any cell
      gameState.winningCell = Math.floor(
        crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 - 1) * 16
      );
      gameState.winner = null;  // No winner if no cells were filled
    }

    // Update the playerBoard to reflect the winning cell
    if (gameState.winningCell !== null) {
      playerBoard[gameState.winningCell] = "winner";
    }

    gameState.isGameRunning = false;
    broadcastGameState();
    broadcastWinner();

    // Start a new game after a 5-second delay
    setTimeout(startNewGame, 5000);
  } else {
    // If not all cells are filled and time is not up, continue the game
    gameState.isGameRunning = true;
    broadcastGameState();
  }
}

/**
 * Broadcasts the winner information to all connected players
 */
function broadcastWinner() {
  const message = JSON.stringify({
    type: "winner",
    winner: gameState.winner,
    winningCell: gameState.winningCell,
  });

  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

/**
 * Handler for WebSocket connections
 */
export const handler: Handlers = {
  async GET(req) {
    // Authenticate the user
    const sessionId = await getUserSessionId(req);

    if (!sessionId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userProfile = await getUserProfileFromSession(sessionId);
    if (!userProfile) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Upgrade the connection to a WebSocket
    const { socket, response } = Deno.upgradeWebSocket(req);
    const playerId = userProfile.id;
    const profileImage = userProfile.picture || "/img/avatar.webp";

    // Create a new player object
    const player: Player = {
      id: playerId,
      profileImage: profileImage,
      socket: socket,
    };

    // Add the player to the game state
    gameState.players.set(playerId, player);

    // WebSocket event handlers
    socket.onopen = () => {
      // Send player info to the client
      socket.send(
        JSON.stringify({
          type: "playerInfo",
          id: playerId,
          profileImage: profileImage,
        }),
      );

      broadcastGameState();

      // Start a new game if this is the first player and no game is running
      if (!gameState.isGameRunning && gameState.players.size === 1) {
        startNewGame();
      }
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (
        data.type === "move" && !gameState.winner && gameState.isGameRunning
      ) {
        const { index, playerId } = data;
        if (!isCellFilled(index)) {
          fillCell(index, playerId);
          if (bitmaskBoard === 0xFFFF) {
            endGame();
          } else {
            broadcastGameState();
          }
        }
      }
    };

    socket.onclose = () => {
      // Remove the player from the game state when they disconnect
      gameState.players.delete(playerId);
      broadcastGameState();
    };

    return response;
  },
};

// Start a new game if there are players and no game is running
if (gameState.players.size > 0 && !gameState.isGameRunning) {
  startNewGame();
}