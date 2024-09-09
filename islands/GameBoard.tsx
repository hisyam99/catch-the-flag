import { useEffect, useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { connectWebSocket, sendMove } from "../utils/websocket.ts";

interface PlayerInfo {
  id: string;
  profileImage: string;
}

interface GameBoardProps {
  sessionId: string;
  boardSize: number; // Add this new prop for board size
}

export default function GameBoard({ sessionId, boardSize }: GameBoardProps) {
  const [board, setBoard] = useState(Array(boardSize * boardSize).fill(null)); // Adjust board size dynamically
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerProfileImage, setPlayerProfileImage] = useState<string | null>(
    null,
  );
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showLoginPopup, setShowLoginPopup] = useState(false);

  useEffect(() => {
    if (IS_BROWSER) {
      const { socket, error } = connectWebSocket(sessionId);

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
              window.location.reload();
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
  }, [sessionId]);

  const handleCellClick = (index: number) => {
    if (board[index] === null && !winner && playerId) {
      sendMove(index, playerId);
    }
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
            onClick={() => window.location.href = "/login"}
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
      <div
        class="grid gap-2"
        style={`grid-template-columns: repeat(${boardSize}, minmax(0, 1fr));`} // Dinamis untuk membentuk grid persegi
      >
        {board.map((cell, index) => (
          <div
            key={index}
            class={`w-16 h-16 border-2 border-gray-300 flex items-center justify-center cursor-pointer ${
              cell === "winner" ? "bg-red-500 animate-pulse" : ""
            }`}
            onClick={() => handleCellClick(index)}
          >
            {cell && cell !== "winner" && (
              <img
                src={getPlayerProfileImage(cell)}
                alt="Player"
                class="w-12 h-12 rounded-full"
              />
            )}
          </div>
        ))}
      </div>
      <div class="mt-4">
        {winner
          ? (
            winner === playerId
              ? (
                <div class="text-2xl font-bold text-green-500 animate-bounce">
                  You won! 🎉
                </div>
              )
              : (
                <div class="text-xl text-red-500">
                  You didn't win. Try again in the next round.
                </div>
              )
          )
          : <div>Time left: {timeLeft} seconds</div>}
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
