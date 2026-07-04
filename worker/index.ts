import { handleMatches } from "./routes/matches.js";
import { handlePlayers } from "./routes/players.js";
import { handleStats } from "./routes/stats.js";
import { error } from "./lib/response.js";

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      return new Response(null, { status: 404 });
    }

    try {
      if (url.pathname.startsWith("/api/players")) {
        return await handlePlayers(request, env, url.pathname);
      }

      if (url.pathname.startsWith("/api/matches")) {
        return await handleMatches(request, env, url.pathname);
      }

      if (url.pathname.startsWith("/api/stats/")) {
        return await handleStats(request, env, url.pathname);
      }

      return error("Not found", 404);
    } catch (e) {
      console.error(e);
      return error("Internal server error", 500);
    }
  },
} satisfies ExportedHandler<Env>;
