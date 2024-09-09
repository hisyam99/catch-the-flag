import { assertEquals, assertNotEquals } from "https://deno.land/std@0.177.0/testing/asserts.ts";
import { connectWebSocket, sendMove } from "./websocket.ts";

class MockWebSocket {
  readyState: number = WebSocket.CONNECTING;
  sentMessages: string[] = [];

  constructor(public url: string) {
    setTimeout(() => {
      this.readyState = WebSocket.OPEN;
      this.onopen?.();
    }, 10);
  }

  onopen: (() => void) | null = null;

  send(message: string) {
    if (this.readyState === WebSocket.OPEN) {
      this.sentMessages.push(message);
    }
  }

  close() {
    this.readyState = WebSocket.CLOSED;
  }
}

// deno-lint-ignore no-explicit-any
(globalThis as any).WebSocket = MockWebSocket;

Deno.test("connectWebSocket establishes WebSocket connection", async () => {
  const sessionId = "testSessionId";
  const boardSize = 4;

  const { socket, error } = connectWebSocket(sessionId, boardSize);

  assertEquals(error, null);

  assertNotEquals(socket, null);
  assertEquals((socket as unknown as MockWebSocket).url.includes(`sessionId=${sessionId}`), true);
  assertEquals((socket as unknown as MockWebSocket).url.includes(`boardSize=${boardSize}`), true);

  await new Promise((resolve) => setTimeout(resolve, 20));

  assertEquals(socket?.readyState, WebSocket.OPEN);
});

Deno.test("sendMove sends correct move data via WebSocket", async () => {
  const sessionId = "testSessionId";
  const boardSize = 4;

  const { socket } = connectWebSocket(sessionId, boardSize);

  await new Promise((resolve) => setTimeout(resolve, 20));

  const testIndex = 5;
  const testPlayerId = "testPlayer";

  sendMove(testIndex, testPlayerId);

  const expectedMessage = JSON.stringify({ type: "move", index: testIndex, playerId: testPlayerId });
  assertEquals((socket as unknown as MockWebSocket).sentMessages.includes(expectedMessage), true);
});

// deno-lint-ignore require-await
Deno.test("sendMove does not send move if WebSocket is not open", async () => {
  const sessionId = "testSessionId";
  const boardSize = 4;

  const { socket } = connectWebSocket(sessionId, boardSize);

  const testIndex = 2;
  const testPlayerId = "testPlayer2";

  sendMove(testIndex, testPlayerId);

  assertEquals((socket as unknown as MockWebSocket).sentMessages.length, 0);
});
