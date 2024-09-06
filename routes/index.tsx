import { Head } from "$fresh/runtime.ts";
import GameBoard from "../islands/GameBoard.tsx";

export default function Home() {
  return (
    <>
      <Head>
        <title>Catch the Flag</title>
      </Head>
      <div class="p-4 mx-auto max-w-screen-md">
        <h1 class="text-4xl font-bold">Catch the Flag</h1>
        <GameBoard />
      </div>
    </>
  );
}
