// DO NOT EDIT. This file is generated by Fresh.
// This file SHOULD be checked into source version control.
// This file is automatically updated during development when running `dev.ts`.

import * as $_404 from "./routes/_404.tsx";
import * as $_app from "./routes/_app.tsx";
import * as $api_game_board_size_1024x1024 from "./routes/api/game/board/size/1024x1024.ts";
import * as $api_game_board_size_16x16 from "./routes/api/game/board/size/16x16.ts";
import * as $api_game_board_size_256x256 from "./routes/api/game/board/size/256x256.ts";
import * as $api_game_board_size_4x4 from "./routes/api/game/board/size/4x4.ts";
import * as $api_game_board_size_old_api from "./routes/api/game/board/size/old_api.ts";
import * as $index from "./routes/index.tsx";
import * as $login from "./routes/login.tsx";
import * as $BoardSizeSelector from "./islands/BoardSizeSelector.tsx";
import * as $GameBoard from "./islands/GameBoard.tsx";
import { type Manifest } from "$fresh/server.ts";

const manifest = {
  routes: {
    "./routes/_404.tsx": $_404,
    "./routes/_app.tsx": $_app,
    "./routes/api/game/board/size/1024x1024.ts": $api_game_board_size_1024x1024,
    "./routes/api/game/board/size/16x16.ts": $api_game_board_size_16x16,
    "./routes/api/game/board/size/256x256.ts": $api_game_board_size_256x256,
    "./routes/api/game/board/size/4x4.ts": $api_game_board_size_4x4,
    "./routes/api/game/board/size/old_api.ts": $api_game_board_size_old_api,
    "./routes/index.tsx": $index,
    "./routes/login.tsx": $login,
  },
  islands: {
    "./islands/BoardSizeSelector.tsx": $BoardSizeSelector,
    "./islands/GameBoard.tsx": $GameBoard,
  },
  baseUrl: import.meta.url,
} satisfies Manifest;

export default manifest;
