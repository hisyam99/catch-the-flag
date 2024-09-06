import { Head } from "$fresh/runtime.ts";

export default function Login() {
  return (
    <>
      <Head>
        <title>Login - Catch the Flag</title>
      </Head>
      <div class="p-4 mx-auto max-w-screen-md">
        <h1 class="text-4xl font-bold mb-8">Login to Catch the Flag</h1>
        <div class="flex flex-col space-y-4">
          <a href="/signin/google" class="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded text-center">
            Login with Google
          </a>
          <a href="/signin/facebook" class="bg-blue-800 hover:bg-blue-900 text-white font-bold py-2 px-4 rounded text-center">
            Login with Facebook
          </a>
        </div>
      </div>
    </>
  );
}