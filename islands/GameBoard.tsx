import { useEffect, useState } from "preact/hooks";
import { IS_BROWSER } from "$fresh/runtime.ts";
import { connectWebSocket, sendMove } from "../utils/websocket.ts";

interface PlayerInfo {
  id: string;
  color: string;
}

export default function GameBoard() {
  const [board, setBoard] = useState(Array(16).fill(null));
  const [winner, setWinner] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState(60);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [playerColor, setPlayerColor] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerInfo[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (IS_BROWSER) {
      const { socket, error } = connectWebSocket();

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
          } else if (data.type === "playerInfo") {
            setPlayerId(data.id);
            setPlayerColor(data.color);
          }
        };

        // Correctly handle WebSocket errors using a type check
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
  }, []);

  const handleCellClick = (index: number) => {
    if (board[index] === null && !winner && playerId) {
      sendMove(index, playerId);
    }
  };

  const getPlayerColor = (id: string | null) => {
    if (id === null) return "#FFFFFF";
    const player = players.find(p => p.id === id);
    return player ? player.color : "#000000";
  };

  if (error) {
    return <div class="text-red-500">{error}</div>;
  }

  return (
    <div class="mt-4">
      <div class="grid grid-cols-4 gap-2">
        {board.map((cell, index) => (
          <div
            key={index}
            class={`w-16 h-16 border-2 border-gray-300 flex items-center justify-center cursor-pointer ${
              cell === "winner" ? "bg-red-500 animate-pulse" : ""
            }`}
            onClick={() => handleCellClick(index)}
          >
            {cell && cell !== "winner" && (
              <div
                class="w-12 h-12 rounded-full"
                style={{ backgroundColor: getPlayerColor(cell) }}
              ></div>
            )}
          </div>
        ))}
      </div>
      <div class="mt-4">
        {winner ? (
          winner === playerId ? (
            <div class="text-2xl font-bold text-green-500 animate-bounce">You won! 🎉</div>
          ) : (
            <div class="text-xl text-red-500">You didn't win. Try again in the next round.</div>
          )
        ) : (
          <div>Time left: {timeLeft} seconds</div>
        )}
      </div>
      <div class="mt-2">
        Your color: <div class="inline-block w-4 h-4 rounded-full" style={{ backgroundColor: playerColor || "#000000" }}></div>
      </div>
    </div>
  );
}
