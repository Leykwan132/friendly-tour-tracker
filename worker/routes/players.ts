import { error, json, notFound, parseId, parseJson } from "../lib/response.js";
import { validatePlayerName } from "../lib/validation.js";

interface PlayerRow {
  id: number;
  name: string;
  created_at: string;
}

export async function handlePlayers(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const db = env.prod_d1_dota2;

  if (pathname === "/api/players") {
    if (request.method === "GET") {
      const result = await db
        .prepare("SELECT id, name, created_at FROM players ORDER BY name COLLATE NOCASE ASC")
        .all<PlayerRow>();
      return json(result.results);
    }

    if (request.method === "POST") {
      const body = await parseJson<{ name?: unknown }>(request);
      const name = validatePlayerName(body?.name);
      if (!name) return error("Player name is required");

      try {
        const result = await db
          .prepare("INSERT INTO players (name) VALUES (?) RETURNING id, name, created_at")
          .bind(name)
          .first<PlayerRow>();
        return json(result, 201);
      } catch (e) {
        const message = e instanceof Error ? e.message : String(e);
        if (message.includes("UNIQUE")) {
          return error("A player with that name already exists", 409);
        }
        throw e;
      }
    }

    return error("Method not allowed", 405);
  }

  const id = parseId(pathname, "/api/players");
  if (id === null) return notFound();

  if (request.method === "PATCH") {
    const body = await parseJson<{ name?: unknown }>(request);
    const name = validatePlayerName(body?.name);
    if (!name) return error("Player name is required");

    try {
      const result = await db
        .prepare(
          "UPDATE players SET name = ? WHERE id = ? RETURNING id, name, created_at",
        )
        .bind(name, id)
        .first<PlayerRow>();

      if (!result) return notFound("Player not found");

      return json(result);
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("UNIQUE")) {
        return error("A player with that name already exists", 409);
      }
      throw e;
    }
  }

  if (request.method === "DELETE") {
    const existing = await db
      .prepare("SELECT id FROM players WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) return notFound("Player not found");

    const inMatch = await db
      .prepare("SELECT id FROM match_participants WHERE player_id = ? LIMIT 1")
      .bind(id)
      .first();

    if (inMatch) {
      return error("Cannot delete a player who has match history", 409);
    }

    await db.prepare("DELETE FROM players WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
}
