import {
    createClerkOAuthConfig,
    createFacebookOAuthConfig,
    createGoogleOAuthConfig,
    createHelpers,
} from "@deno/kv-oauth";
import type { Plugin } from "$fresh/server.ts";

// Creating OAuth configuration for Google provider
// This includes the redirect URI and the scope (the permissions we are requesting)
const googleOAuthConfig = createGoogleOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/google/callback`, // Redirect URI after Google OAuth login
    scope:
        "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email", // Requesting profile and email access
});

// Creating OAuth configuration for Facebook provider
const facebookOAuthConfig = createFacebookOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/facebook/callback`, // Redirect URI after Facebook OAuth login
    scope: "public_profile,email", // Requesting access to the public profile and email
});

// Creating OAuth configuration for Clerk (a new provider)
// Clerk also requires a redirect URI and a scope, where public_metadata is an additional scope specific to Clerk
const clerkOAuthConfig = createClerkOAuthConfig({
    redirectUri: `${Deno.env.get("REDIRECT_URI")}/clerk/callback`,
    scope: "email profile public_metadata", // Requesting email, profile, and public metadata
});

// Creating helper functions for each provider using the OAuth configurations
// These helpers will manage sign-in, sign-out, and token handling.
const googleHelpers = createHelpers(googleOAuthConfig);
const facebookHelpers = createHelpers(facebookOAuthConfig);
const clerkHelpers = createHelpers(clerkOAuthConfig);

// Function to get the user's profile from a specified provider
// This function makes API calls to fetch user data after successful OAuth login
async function getUserProfile(
    provider: "google" | "facebook" | "clerk", // Provider could be google, facebook, or clerk
    accessToken: string, // OAuth access token for API authentication
) {
    let url;
    // Determine the appropriate user info endpoint based on the OAuth provider
    if (provider === "google") {
        url = "https://www.googleapis.com/oauth2/v2/userinfo"; // Google userinfo endpoint
    } else if (provider === "facebook") {
        url = "https://graph.facebook.com/me?fields=id,name,email"; // Facebook userinfo endpoint
    } else {
        // Clerk's user info endpoint is provided through an environment variable
        url = `${Deno.env.get("CLERK_DOMAIN")}/userinfo`;
    }

    // Fetch user profile from the provider's API using the access token
    const response = await fetch(url, {
        headers: {
            Authorization: `Bearer ${accessToken}`, // Pass the access token in the Authorization header
        },
    });

    // Throw an error if the API request fails
    if (!response.ok) {
        throw new Error("Failed to fetch user profile");
    }

    const profile = await response.json(); // Parse the response as JSON

    // For Clerk, assign the user_id to the id field to standardize the profile structure
    if (provider === "clerk" && profile.user_id) {
        profile.id = profile.user_id;
    }

    return profile; // Return the user profile data
}

// Function to store user profile in the KV store, associating it with a session ID
async function setUserProfile(sessionId: string, profile: string) {
    const kv = await Deno.openKv(); // Open the KV store
    await kv.set(["userProfiles", sessionId], profile); // Store the profile with the sessionId as the key
}

// Function to retrieve user profile from the KV store using the session ID
export async function getUserProfileFromSession(sessionId: string) {
    const kv = await Deno.openKv(); // Open the KV store
    const result = await kv.get(["userProfiles", sessionId]); // Retrieve the profile associated with the sessionId
    return result.value as {
        id: string;
        name?: string;
        picture?: string;
    } | null; // Return the profile or null if not found
}

// Function to get the session ID from the request for any OAuth provider
// It checks if the session exists for Google, Facebook, or Clerk
export async function getUserSessionId(
    req: Request,
): Promise<string | undefined> {
    const googleSessionId = await googleHelpers.getSessionId(req); // Check for Google session
    if (googleSessionId) return googleSessionId;

    const facebookSessionId = await facebookHelpers.getSessionId(req); // Check for Facebook session
    if (facebookSessionId) return facebookSessionId;

    const clerkSessionId = await clerkHelpers.getSessionId(req); // Check for Clerk session
    if (clerkSessionId) return clerkSessionId;

    return undefined; // Return undefined if no session found
}

// Defining the plugin with routes for sign-in, callback, and protected routes
export default {
    name: "kv-oauth", // Plugin name
    routes: [
        // Google sign-in route
        {
            path: "/signin/google",
            async handler(req) {
                return await googleHelpers.signIn(req); // Initiate Google sign-in
            },
        },
        // Facebook sign-in route
        {
            path: "/signin/facebook",
            async handler(req) {
                return await facebookHelpers.signIn(req); // Initiate Facebook sign-in
            },
        },
        // Clerk sign-in route (new)
        {
            path: "/signin/clerk",
            async handler(req) {
                return await clerkHelpers.signIn(req); // Initiate Clerk sign-in
            },
        },
        // Google OAuth callback route
        {
            path: "/google/callback",
            async handler(req) {
                // Handle Google OAuth callback and get tokens
                const { response, sessionId, tokens } = await googleHelpers
                    .handleCallback(req);
                if (tokens.accessToken && sessionId) {
                    // Fetch and store the user profile using the access token
                    const profile = await getUserProfile(
                        "google",
                        tokens.accessToken,
                    );
                    await setUserProfile(sessionId, profile);
                }
                response.headers.set("Location", "/"); // Redirect to home page
                return response;
            },
        },
        // Facebook OAuth callback route
        {
            path: "/facebook/callback",
            async handler(req) {
                // Handle Facebook OAuth callback and get tokens
                const { response, sessionId, tokens } = await facebookHelpers
                    .handleCallback(req);
                if (tokens.accessToken && sessionId) {
                    // Fetch and store the user profile using the access token
                    const profile = await getUserProfile(
                        "facebook",
                        tokens.accessToken,
                    );
                    await setUserProfile(sessionId, profile);
                }
                response.headers.set("Location", "/"); // Redirect to home page
                return response;
            },
        },
        // Clerk OAuth callback route (new)
        {
            path: "/clerk/callback",
            async handler(req) {
                // Handle Clerk OAuth callback and get tokens
                const { response, sessionId, tokens } = await clerkHelpers
                    .handleCallback(req);
                if (tokens.accessToken && sessionId) {
                    // Fetch and store the user profile using the access token
                    const profile = await getUserProfile(
                        "clerk",
                        tokens.accessToken,
                    );
                    await setUserProfile(sessionId, profile);
                }
                response.headers.set("Location", "/"); // Redirect to home page
                return response;
            },
        },
        // Sign-out route that deletes the user session and logs out from OAuth providers
        {
            path: "/signout",
            async handler(req) {
                const sessionId = await getUserSessionId(req); // Get the session ID
                if (sessionId) {
                    const kv = await Deno.openKv(); // Open KV store
                    await kv.delete(["userProfiles", sessionId]); // Delete user profile for the session
                }
                return await googleHelpers.signOut(req); // Sign out from Google (can be extended for other providers)
            },
        },
        // Protected route that checks if the user is authenticated
        {
            path: "/protected",
            async handler(req) {
                const sessionId = await getUserSessionId(req); // Get session ID
                if (sessionId === undefined) {
                    return new Response("Unauthorized", { status: 401 }); // If no session, return unauthorized
                }
                const profile = await getUserProfileFromSession(sessionId); // Get user profile from session
                if (!profile) {
                    return new Response("Profile not found", { status: 404 }); // If no profile found, return 404
                }
                // Return a welcome message if user is authenticated
                return new Response(
                    `Welcome, ${profile.name || "User"}! You are allowed.`,
                );
            },
        },
        // API route to return the user's profile in JSON format
        {
            path: "/api/profile",
            async handler(req) {
                const sessionId = await getUserSessionId(req); // Get session ID
                if (sessionId === undefined) {
                    return new Response("Unauthorized", { status: 401 }); // If no session, return unauthorized
                }
                const profile = await getUserProfileFromSession(sessionId); // Get user profile from session
                if (!profile) {
                    return new Response("Profile not found", { status: 404 }); // If no profile found, return 404
                }
                // Return the user profile as a JSON response
                return new Response(JSON.stringify(profile), {
                    headers: { "Content-Type": "application/json" },
                });
            },
        },
    ],
} as Plugin;
