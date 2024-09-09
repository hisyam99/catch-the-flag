import { Handlers } from "$fresh/server.ts";
import { crypto } from "https://deno.land/std@0.177.0/crypto/mod.ts";
import {
  getUserProfileFromSession,
  getUserSessionId,
} from "@/plugins/kv_oauth.ts";

const GAME_DURATION = 60000; // 60 seconds

interface Player {
  id: string;
  profileImage: string;
  socket: WebSocket;
}

interface GameState {
  board: (string | null)[];
  players: Map<string, Player>;
  winner: string | null;
  gameEndTime: number;
  isGameRunning: boolean;
}

let gameState: GameState = {
  board: Array(1024 * 1024).fill(null),
  players: new Map<string, Player>(),
  winner: null,
  gameEndTime: 0,
  isGameRunning: false,
};

function broadcastGameState() {
  const message = JSON.stringify({
    type: "boardUpdate",
    board: gameState.board,
    timeLeft: Math.max(
      0,
      Math.floor((gameState.gameEndTime - Date.now()) / 1000),
    ),
    players: Array.from(gameState.players.values()).map((p) => ({
      id: p.id,
      profileImage: p.profileImage,
    })),
  });
  for (const player of gameState.players.values()) {
    player.socket.send(message);
  }
}

function startNewGame() {
  gameState.board = Array(1024 * 1024).fill(null);
  gameState.winner = null;
  gameState.gameEndTime = Date.now() + GAME_DURATION;
  gameState.isGameRunning = true;
  broadcastGameState();

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

  setTimeout(() => {
    clearInterval(gameInterval);
    endGame();
  }, GAME_DURATION);
}

function endGame() {
  if (!gameState.winner) {
    const emptyIndexes = gameState.board
      .map((cell, index) => cell === null ? index : -1)
      .filter((index) => index !== -1);

    let winningIndex: number;
    if (emptyIndexes.length > 0) {
      winningIndex = emptyIndexes[
        Math.floor(
          crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 - 1) *
            emptyIndexes.length,
        )
      ];
    } else {
      winningIndex = Math.floor(
        crypto.getRandomValues(new Uint32Array(1))[0] / (2 ** 32 - 1) *
          (1024 * 1024),
      );
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

export const handler: Handlers = {
  async GET(req) {
    const sessionId = await getUserSessionId(req);

    if (!sessionId) {
      return new Response("Unauthorized", { status: 401 });
    }

    const userProfile = await getUserProfileFromSession(sessionId);
    if (!userProfile) {
      return new Response("Unauthorized", { status: 401 });
    }

    const { socket, response } = Deno.upgradeWebSocket(req);
    const playerId = userProfile.id;
    const profileImage = userProfile.picture || "/api/placeholder/32/32";

    const player: Player = {
      id: playerId,
      profileImage: profileImage,
      socket: socket,
    };

    gameState.players.set(playerId, player);

    socket.onopen = () => {
      socket.send(
        JSON.stringify({
          type: "playerInfo",
          id: playerId,
          profileImage: profileImage,
        }),
      );
      broadcastGameState();

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
        if (gameState.board[index] === null) {
          gameState.board[index] = playerId;
          broadcastGameState();

          if (gameState.board.every((cell) => cell !== null)) {
            endGame();
          }
        }
      }
    };

    socket.onclose = () => {
      gameState.players.delete(playerId);
      broadcastGameState();
    };

    return response;
  },
};

// Start the first game if we have players
if (gameState.players.size > 0 && !gameState.isGameRunning) {
  startNewGame();
}
