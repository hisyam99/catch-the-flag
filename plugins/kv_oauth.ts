import {
    createFacebookOAuthConfig,
    createGoogleOAuthConfig,
    createHelpers,
    handleCallback,
} from "@deno/kv-oauth";
import type { Plugin } from "$fresh/server.ts";
import { load } from "https://deno.land/std@0.224.0/dotenv/mod.ts";

// Memuat Environment Variable dari file .env
const _env = await load();

// Mengatur Environment Variable untuk kredensial OAuth
// Deno.env.set("GOOGLE_CLIENT_ID", env["GOOGLE_CLIENT_ID"]);
// Deno.env.set("GOOGLE_CLIENT_SECRET", env["GOOGLE_CLIENT_SECRET"]);
// Deno.env.set("FACEBOOK_CLIENT_ID", env["FACEBOOK_CLIENT_ID"]);
// Deno.env.set("FACEBOOK_CLIENT_SECRET", env["FACEBOOK_CLIENT_SECRET"]);
// Deno.env.set("REDIRECT_URI", env["REDIRECT_URI"]);

// Konfigurasi OAuth untuk Google
const googleOAuthConfig = createGoogleOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/google/callback`,
    scope:
        "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
});

// Konfigurasi OAuth untuk Facebook
const facebookOAuthConfig = createFacebookOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/facebook/callback`,
    scope: "public_profile,email",
});

// Membuat helper OAuth untuk Google dan Facebook
const googleHelpers = createHelpers(googleOAuthConfig);
const facebookHelpers = createHelpers(facebookOAuthConfig);

// Fungsi untuk mengambil profil pengguna dari provider OAuth
async function getUserProfile(
    provider: "google" | "facebook",
    accessToken: string,
) {
    let url;
    if (provider === "google") {
        url = "https://www.googleapis.com/oauth2/v2/userinfo";
    } else {
        url = "https://graph.facebook.com/me?fields=id,name,email";
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error("Failed to fetch user profile");
    }
    return await response.json();
}

// Fungsi untuk menyimpan profil pengguna ke dalam KV
async function setUserProfile(sessionId: string, profile: string) {
    const kv = await Deno.openKv();
    await kv.set(["userProfiles", sessionId], profile);
}

// Fungsi untuk mengambil profil pengguna dari sesi
export async function getUserProfileFromSession(sessionId: string) {
    const kv = await Deno.openKv();
    const result = await kv.get(["userProfiles", sessionId]);
    return result.value as {
        id: string;
        name?: string;
        picture?: string;
    } | null;
}

export async function getUserSessionId(
    req: Request,
): Promise<string | undefined> {
    const googleSessionId = await googleHelpers.getSessionId(req);
    if (googleSessionId) return googleSessionId;

    const facebookSessionId = await facebookHelpers.getSessionId(req);
    if (facebookSessionId) return facebookSessionId;

    return undefined;
}

// Plugin default dengan berbagai rute yang tersedia
export default {
    name: "kv-oauth",
    routes: [
        {
            path: "/signin/google",
            async handler(req) {
                return await googleHelpers.signIn(req);
            },
        },
        {
            path: "/signin/facebook",
            async handler(req) {
                return await facebookHelpers.signIn(req);
            },
        },
        {
            path: "/google/callback",
            async handler(req) {
              const { response, sessionId, tokens } = await handleCallback(req, googleOAuthConfig);
              if (tokens.accessToken && sessionId) {
                const profile = await getUserProfile("google", tokens.accessToken);
                await setUserProfile(sessionId, profile);
              }
              response.headers.set("Location", "/");
              return response;
            },
          },
          {
            path: "/facebook/callback",
            async handler(req) {
              const { response, sessionId, tokens } = await handleCallback(req, facebookOAuthConfig);
              if (tokens.accessToken && sessionId) {
                const profile = await getUserProfile("facebook", tokens.accessToken);
                await setUserProfile(sessionId, profile);
              }
              response.headers.set("Location", "/");
              return response;
            },
          },
          {
            path: "/signout",
            async handler(req) {
              const sessionId = await getUserSessionId(req);
              if (sessionId) {
                const kv = await Deno.openKv();
                await kv.delete(["userProfiles", sessionId]);
              }
              return await googleHelpers.signOut(req);
            },
          },
        {
            path: "/protected",
            async handler(req) {
                const sessionId = await googleHelpers.getSessionId(req) ||
                    await facebookHelpers.getSessionId(req);
                if (sessionId === undefined) {
                    return new Response("Unauthorized", { status: 401 });
                }
                const profile = await getUserProfileFromSession(sessionId);
                if (!profile) {
                    return new Response("Profile not found", { status: 404 });
                }
                return new Response(
                    `Welcome, ${profile.name || "User"}! You are allowed.`,
                );
            },
        },
        {
            path: "/api/profile",
            async handler(req) {
                const sessionId = await googleHelpers.getSessionId(req) ||
                    await facebookHelpers.getSessionId(req);
                if (sessionId === undefined) {
                    return new Response("Unauthorized", { status: 401 });
                }
                const profile = await getUserProfileFromSession(sessionId);
                if (!profile) {
                    return new Response("Profile not found", { status: 404 });
                }
                return new Response(JSON.stringify(profile), {
                    headers: { "Content-Type": "application/json" },
                });
            },
        },
    ],
} as Plugin;
