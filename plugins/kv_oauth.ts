import {
    createFacebookOAuthConfig,
    createGoogleOAuthConfig,
    createClerkOAuthConfig,
    createHelpers,
} from "@deno/kv-oauth";
import type { Plugin } from "$fresh/server.ts";

// Existing Google OAuth config
const googleOAuthConfig = createGoogleOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/google/callback`,
    scope: "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email",
});

// Existing Facebook OAuth config
const facebookOAuthConfig = createFacebookOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/facebook/callback`,
    scope: "public_profile,email",
});

// New Clerk OAuth config
const clerkOAuthConfig = createClerkOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/clerk/callback`,
    scope: "email profile public_metadata",
});

// Create helpers for all providers
const googleHelpers = createHelpers(googleOAuthConfig);
const facebookHelpers = createHelpers(facebookOAuthConfig);
const clerkHelpers = createHelpers(clerkOAuthConfig);

// Update getUserProfile function to include Clerk
async function getUserProfile(
    provider: "google" | "facebook" | "clerk",
    accessToken: string,
) {
    let url;
    if (provider === "google") {
        url = "https://www.googleapis.com/oauth2/v2/userinfo";
    } else if (provider === "facebook") {
        url = "https://graph.facebook.com/me?fields=id,name,email";
    } else {
        url = `${Deno.env.get("CLERK_DOMAIN")}/userinfo`;
    }

    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`,
        },
    });
    if (!response.ok) {
        throw new Error("Failed to fetch user profile");
    }
    const profile = await response.json();
    
    // Handle Clerk's user_id
    if (provider === "clerk" && profile.user_id) {
        profile.id = profile.user_id;
    }
    
    return profile;
}

// Existing functions remain the same
async function setUserProfile(sessionId: string, profile: string) {
    const kv = await Deno.openKv();
    await kv.set(["userProfiles", sessionId], profile);
}

export async function getUserProfileFromSession(sessionId: string) {
    const kv = await Deno.openKv();
    const result = await kv.get(["userProfiles", sessionId]);
    return result.value as {
        id: string;
        name?: string;
        picture?: string;
    } | null;
}

// Update getUserSessionId to include Clerk
export async function getUserSessionId(
    req: Request,
): Promise<string | undefined> {
    const googleSessionId = await googleHelpers.getSessionId(req);
    if (googleSessionId) return googleSessionId;

    const facebookSessionId = await facebookHelpers.getSessionId(req);
    if (facebookSessionId) return facebookSessionId;

    const clerkSessionId = await clerkHelpers.getSessionId(req);
    if (clerkSessionId) return clerkSessionId;

    return undefined;
}

// Update the plugin with new routes for Clerk
export default {
    name: "kv-oauth",
    routes: [
        // Existing routes
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
        // New route for Clerk sign-in
        {
            path: "/signin/clerk",
            async handler(req) {
                return await clerkHelpers.signIn(req);
            },
        },
        {
            path: "/google/callback",
            async handler(req) {
                const { response, sessionId, tokens } = await googleHelpers.handleCallback(req);
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
                const { response, sessionId, tokens } = await facebookHelpers.handleCallback(req);
                if (tokens.accessToken && sessionId) {
                    const profile = await getUserProfile("facebook", tokens.accessToken);
                    await setUserProfile(sessionId, profile);
                }
                response.headers.set("Location", "/");
                return response;
            },
        },
        // New route for Clerk callback
        {
            path: "/clerk/callback",
            async handler(req) {
                const { response, sessionId, tokens } = await clerkHelpers.handleCallback(req);
                if (tokens.accessToken && sessionId) {
                    const profile = await getUserProfile("clerk", tokens.accessToken);
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
                const sessionId = await getUserSessionId(req);
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
                const sessionId = await getUserSessionId(req);
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
