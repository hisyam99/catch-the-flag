// islands/BoardSizeSelector.tsx
import { useState } from "preact/hooks";

interface BoardSizeSelectorProps {
  initialSize: number;
  onSizeChange: (size: number) => void;
}

export default function BoardSizeSelector({ initialSize, onSizeChange }: BoardSizeSelectorProps) {
  const [boardSize, setBoardSize] = useState(initialSize);

  const handleBoardSizeChange = (e: Event) => {
    const selectedSize = parseInt((e.target as HTMLSelectElement).value, 10);
    setBoardSize(selectedSize);
    onSizeChange(selectedSize);
  };

  return (
    <div class="mb-4">
      <label for="boardSize" class="mr-2 font-bold">Pilih Ukuran Board:</label>
      <select
        id="boardSize"
        class="border p-2 rounded"
        value={boardSize}
        onChange={handleBoardSizeChange}
      >
        <option value={4}>4 x 4</option>
        <option value={16}>16 x 16</option>
        <option value={256}>256 x 256</option>
        <option value={1024}>1024 x 1024</option>
      </select>
    </div>
  );
}
