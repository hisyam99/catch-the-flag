// routes/api/game.ts
import { Handlers } from "$fresh/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";

const GAME_DURATION = 60000; // 60 seconds
const COLORS = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#FF00FF", "#00FFFF", "#FFA500", "#800080"];

interface Player {
  id: string;
  color: string;
  socket: WebSocket;
}

let gameState = {
  board: Array(16).fill(null),
  players: new Map<string, Player>(),
  winner: null as string | null,
  gameEndTime: 0,
  isGameRunning: false,
};

function broadcastGameState() {
  const message = JSON.stringify({
    type: "boardUpdate",
    board: gameState.board,
    timeLeft: Math.max(0, Math.floor((gameState.gameEndTime - Date.now()) / 1000)),
  });
  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

function startNewGame() {
  gameState.board = Array(16).fill(null);
  gameState.winner = null;
  gameState.gameEndTime = Date.now() + GAME_DURATION;
  gameState.isGameRunning = true;
  broadcastGameState();

  const gameInterval = setInterval(() => {
    const timeLeft = Math.max(0, Math.floor((gameState.gameEndTime - Date.now()) / 1000));
    if (timeLeft > 0) {
      broadcastGameState();
    } else {
      clearInterval(gameInterval);
      endGame();
    }
  }, 1000);

  setTimeout(() => {
    clearInterval(gameInterval);
    endGame();
  }, GAME_DURATION);
}

function endGame() {
  if (!gameState.winner) {
    const emptyIndexes = gameState.board
      .map((cell, index) => cell === null ? index : -1)
      .filter(index => index !== -1);

    let winningIndex: number;
    if (emptyIndexes.length > 0) {
      winningIndex = emptyIndexes[Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (2**32 - 1) * emptyIndexes.length)];
    } else {
      winningIndex = Math.floor(crypto.getRandomValues(new Uint32Array(1))[0] / (2**32 - 1) * 16);
    }

    gameState.winner = gameState.board[winningIndex] || "empty";
    gameState.board[winningIndex] = "winner";
  }
  
  gameState.isGameRunning = false;
  broadcastGameState();
  broadcastWinner();
  setTimeout(startNewGame, 5000); // Start a new game after 5 seconds
}

function broadcastWinner() {
  const message = JSON.stringify({
    type: "winner",
    winner: gameState.winner,
  });
  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

function generatePlayerId(): string {
  return crypto.randomUUID();
}

export const handler: Handlers = {
  GET(req) {
    const { socket, response } = Deno.upgradeWebSocket(req);
    const playerId = generatePlayerId();
    const playerColor = COLORS[gameState.players.size % COLORS.length];

    const player: Player = {
      id: playerId,
      color: playerColor,
      socket: socket,
    };

    gameState.players.set(playerId, player);

    socket.onopen = () => {
      socket.send(JSON.stringify({ type: "playerInfo", id: playerId, color: playerColor }));
      socket.send(JSON.stringify({
        type: "boardUpdate",
        board: gameState.board,
        timeLeft: Math.max(0, Math.floor((gameState.gameEndTime - Date.now()) / 1000)),
      }));

      // Start a new game if there isn't one running and we have at least one player
      if (!gameState.isGameRunning && gameState.players.size === 1) {
        startNewGame();
      }
    };

    socket.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "move" && !gameState.winner && gameState.isGameRunning) {
        const { index, playerId } = data;
        if (gameState.board[index] === null) {
          gameState.board[index] = playerId;
          broadcastGameState();

          if (gameState.board.every(cell => cell !== null)) {
            endGame();
          }
        }
      }
    };

    socket.onclose = () => {
      gameState.players.delete(playerId);
    };

    return response;
  },
};

// Start the first game if we have players
if (gameState.players.size > 0 && !gameState.isGameRunning) {
  startNewGame();
}