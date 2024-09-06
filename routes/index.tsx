import { Head } from "$fresh/runtime.ts";
import GameBoard from "../islands/GameBoard.tsx";
import { Handlers, PageProps } from "$fresh/server.ts";
import { getUserProfileFromSession, getUserSessionId } from "../plugins/kv_oauth.ts";

export const handler: Handlers = {
  async GET(req, ctx) {
    const sessionId = await getUserSessionId(req);

    if (!sessionId) {
      return new Response("Redirect", {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    const userProfile = await getUserProfileFromSession(sessionId);
    if (!userProfile) {
      return new Response("Redirect", {
        status: 302,
        headers: { Location: "/login" },
      });
    }

    return ctx.render({ sessionId, userProfile });
  },
};

export default function Home({ data }: PageProps) {
  const { sessionId, userProfile } = data;

  return (
    <>
      <Head>
        <title>Catch the Flag</title>
      </Head>
      <div class="p-4 mx-auto max-w-screen-md">
        <div class="flex justify-between items-center mb-4">
          <h1 class="text-4xl font-bold">Catch the Flag</h1>
          <div class="flex items-center">
            <img src={userProfile.picture || "/api/placeholder/32/32"} alt={userProfile.name} class="w-8 h-8 rounded-full mr-2" />
            <span class="mr-4">{userProfile.name}</span>
            <a href="/signout" class="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded">Sign Out</a>
          </div>
        </div>
        <GameBoard sessionId={sessionId} />
      </div>
    </>
  );
}