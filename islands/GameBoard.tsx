import { useEffect, useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { connectWebSocket, sendMove } from "../utils/websocket.ts";

interface PlayerInfo {
  id: string;
  profileImage: string;
}

interface GameBoardProps {
  sessionId: string;
  boardSize: number;
}

export default function GameBoard({ sessionId }: GameBoardProps) {
  const [boardSize, setBoardSize] = useState(4); // Default size 4x4
  const [board, setBoard] = useState(Array(boardSize * boardSize).fill(null));
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerProfileImage, setPlayerProfileImage] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  useEffect(() => {
    if (IS_BROWSER) {
      const { socket, error } = connectWebSocket(sessionId, boardSize);

      if (error) {
        setError(`WebSocket connection failed: ${error}`);
        return;
      }

      if (socket) {
        socket.onmessage = (event: MessageEvent) => {
          const data = JSON.parse(event.data);
          if (data.type === "boardUpdate") {
            setBoard(data.board);
            setTimeLeft(data.timeLeft);
            setPlayers(data.players);
          } else if (data.type === "winner") {
            setWinner(data.winner);
            setTimeout(() => {
              globalThis.location.reload();
            }, 5000);
          } else if (data.type === "playerInfo") {
            setPlayerId(data.id);
            setPlayerProfileImage(data.profileImage);
          } else if (data.type === "loggedInElsewhere") {
            setShowLoginPopup(true);
          }
        };

        socket.onerror = (e: Event) => {
          if (e instanceof ErrorEvent) {
            setError(`WebSocket error: ${e.message}`);
          } else {
            setError("An unknown WebSocket error occurred.");
          }
        };

        return () => socket.close();
      }
    }
  }, [sessionId, boardSize]);

  const handleCellClick = (index: number) => {
    // Simplify the click handler - only check if the cell is empty and the game is still active
    if (board[index] === null && !winner && playerId) {
      sendMove(index, playerId);
    }
  };

  const handleBoardSizeChange = (event: Event) => {
    const newSize = parseInt((event.target as HTMLSelectElement).value, 10);
    setBoardSize(newSize);
    setBoard(Array(newSize * newSize).fill(null));
  };

  const getPlayerProfileImage = (id: string | null) => {
    if (id === null) return "/img/avatar.webp";
    const player = players.find((p) => p.id === id);
    return player ? player.profileImage : "/img/avatar.webp";
  };

  if (error) {
    return <div class="text-red-500">{error}</div>;
  }

  if (showLoginPopup) {
    return (
      <div class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center">
        <div class="bg-white p-8 rounded-lg text-center">
          <h2 class="text-2xl font-bold mb-4">Logged in from Another Device</h2>
          <p class="mb-4">
            You have been logged in from another device. This session will be
            terminated.
          </p>
          <button
            onClick={() => globalThis.location.href = "/login"}
            class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded"
          >
            Go to Login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="mt-4">
      {/* Dropdown for selecting board size */}
      <div class="mb-4">
        <label for="boardSize" class="mr-2 font-bold">Board Size:</label>
        <select
          id="boardSize"
          value={boardSize}
          onChange={handleBoardSizeChange}
          class="border rounded p-2"
        >
          <option value="4">4x4 (16)</option>
          <option value="16">16x16 (256)</option>
          <option value="256">256x256 (65536)</option>
          <option value="1024">1024x1024 (1048576)</option>
        </select>
      </div>

      <div
        class="grid gap-2"
        style={`
          grid-template-columns: repeat(${boardSize === 4 ? 4 : 16}, 1fr); 
          grid-template-rows: repeat(${
            boardSize === 4 ? 4 : Math.ceil(boardSize / 16)
          }, 1fr);
        `}
      >
        {board.map((cell, index) => {
          const isClickable = cell === null && !winner;

          return (
            <div
              key={index}
              class={`border-2 border-gray-300 flex items-center justify-center 
                ${isClickable ? 'cursor-pointer hover:bg-gray-100' : ''} 
                ${cell === "winner" ? "bg-red-500 animate-pulse" : ""}`}
              onClick={() => isClickable && handleCellClick(index)}
              style="aspect-ratio: 1;"
            >
              {cell && cell !== "winner" && (
                <img
                  src={getPlayerProfileImage(cell)}
                  alt="Player"
                  class="w-3/4 h-3/4 rounded-full"
                />
              )}
            </div>
          );
        })}
      </div>

      <div class="mt-4">
        {winner ? (
          winner === playerId ? (
            <div class="text-2xl font-bold text-green-500 animate-bounce">
              You won! 🎉
            </div>
          ) : (
            <div class="text-xl text-red-500">
              You didn't win. Try again in the next round.
            </div>
          )
        ) : (
          <div>Time left: {timeLeft} seconds</div>
        )}
      </div>

      <div class="mt-2">
        Your profile image:{" "}
        <img
          src={playerProfileImage || "/img/avatar.webp"}
          alt="Your profile"
          class="inline-block w-8 h-8 rounded-full"
        />
      </div>
    </div>
  );
}