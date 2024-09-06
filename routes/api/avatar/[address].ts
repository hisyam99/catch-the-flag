import { Handlers } from "$fresh/server.ts";

export const handler: Handlers = {
  GET(_req, ctx) {
    const address = ctx.params.address;
    // Generate a simple SVG avatar based on the address
    const color = `#${address.slice(2, 8)}`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100">
      <rect width="100" height="100" fill="${color}" />
      <text x="50" y="50" font-family="Arial" font-size="40" fill="white" text-anchor="middle" dy=".3em">${address.slice(0, 2)}</text>
    </svg>`;
    return new Response(svg, {
      headers: { "Content-Type": "image/svg+xml" },
    });
  },
};