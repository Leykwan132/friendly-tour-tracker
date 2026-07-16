import { error, json, notFound, parseId, parseJson } from "../lib/response.js";
import { type MatchInput, type Side, validateMatchInput } from "../lib/validation.js";

interface MatchRow {
  id: number;
  played_at: string;
  winner_side: Side;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

interface ParticipantRow {
  id: number;
  match_id: number;
  player_id: number;
  side: Side;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
  player_name: string;
}

interface MatchListRow extends MatchRow {
  participant_count: number;
}

function formatParticipant(row: ParticipantRow) {
  return {
    id: row.id,
    playerId: row.player_id,
    playerName: row.player_name,
    side: row.side,
    hero: row.hero,
    kills: row.kills,
    deaths: row.deaths,
    assists: row.assists,
  };
}

function formatMatch(row: MatchRow, participants: ParticipantRow[]) {
  return {
    id: row.id,
    playedAt: row.played_at,
    winnerSide: row.winner_side,
    sortOrder: row.sort_order,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    participants: participants.map(formatParticipant),
    radiant: participants.filter((p) => p.side === "radiant").map(formatParticipant),
    dire: participants.filter((p) => p.side === "dire").map(formatParticipant),
  };
}

async function fetchParticipants(db: D1Database, matchId: number) {
  const result = await db
    .prepare(
      `SELECT mp.id, mp.match_id, mp.player_id, mp.side, mp.hero, mp.kills, mp.deaths, mp.assists,
              p.name AS player_name
       FROM match_participants mp
       JOIN players p ON p.id = mp.player_id
       WHERE mp.match_id = ?
       ORDER BY mp.side ASC, mp.id ASC`,
    )
    .bind(matchId)
    .all<ParticipantRow>();

  return result.results;
}

async function validatePlayerIds(db: D1Database, input: MatchInput): Promise<string | null> {
  const ids = [...input.radiant, ...input.dire].map((p) => p.playerId);
  const placeholders = ids.map(() => "?").join(", ");
  const result = await db
    .prepare(`SELECT id FROM players WHERE id IN (${placeholders})`)
    .bind(...ids)
    .all<{ id: number }>();

  if (result.results.length !== ids.length) {
    return "One or more player IDs do not exist";
  }

  return null;
}

async function insertMatchWithParticipants(
  db: D1Database,
  input: MatchInput,
  matchId?: number,
): Promise<{ id: number } | string> {
  const playerError = await validatePlayerIds(db, input);
  if (playerError) return playerError;

  let resolvedMatchId = matchId;

  if (matchId) {
    await db.batch([
      db
        .prepare(
          `UPDATE matches
           SET played_at = ?, winner_side = ?, sort_order = ?, updated_at = datetime('now')
           WHERE id = ?`,
        )
        .bind(input.playedAt, input.winnerSide, input.sortOrder, matchId),
      db.prepare("DELETE FROM match_participants WHERE match_id = ?").bind(matchId),
    ]);
  } else {
    const insertResult = await db
      .prepare(
        "INSERT INTO matches (played_at, winner_side, sort_order) VALUES (?, ?, ?)",
      )
      .bind(input.playedAt, input.winnerSide, input.sortOrder)
      .run();
    resolvedMatchId = insertResult.meta.last_row_id;
  }

  if (!resolvedMatchId) {
    return "Failed to create match";
  }

  const participantStatements = [
    ...input.radiant.map((p) =>
      db
        .prepare(
          `INSERT INTO match_participants (match_id, player_id, side, hero, kills, deaths, assists)
           VALUES (?, ?, 'radiant', ?, ?, ?, ?)`,
        )
        .bind(resolvedMatchId, p.playerId, p.hero, p.kills, p.deaths, p.assists),
    ),
    ...input.dire.map((p) =>
      db
        .prepare(
          `INSERT INTO match_participants (match_id, player_id, side, hero, kills, deaths, assists)
           VALUES (?, ?, 'dire', ?, ?, ?, ?)`,
        )
        .bind(resolvedMatchId, p.playerId, p.hero, p.kills, p.deaths, p.assists),
    ),
  ];

  await db.batch(participantStatements);

  return { id: resolvedMatchId };
}

const MATCH_SELECT =
  "SELECT id, played_at, winner_side, sort_order, created_at, updated_at FROM matches";

export async function handleMatches(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  const db = env.prod_d1_dota2;

  if (pathname === "/api/matches") {
    if (request.method === "GET") {
      const result = await db
        .prepare(
          `SELECT m.id, m.played_at, m.winner_side, m.sort_order, m.created_at, m.updated_at,
                  COUNT(mp.id) AS participant_count
           FROM matches m
           LEFT JOIN match_participants mp ON mp.match_id = m.id
           GROUP BY m.id
           ORDER BY m.sort_order ASC, m.id DESC`,
        )
        .all<MatchListRow>();

      return json(
        result.results.map((row) => ({
          id: row.id,
          playedAt: row.played_at,
          winnerSide: row.winner_side,
          sortOrder: row.sort_order,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          participantCount: row.participant_count,
        })),
      );
    }

    if (request.method === "POST") {
      const body = await parseJson<unknown>(request);
      const validated = validateMatchInput(body);
      if (typeof validated === "string") return error(validated);

      const created = await insertMatchWithParticipants(db, validated);
      if (typeof created === "string") return error(created);

      const match = await db
        .prepare(`${MATCH_SELECT} WHERE id = ?`)
        .bind(created.id)
        .first<MatchRow>();

      const participants = await fetchParticipants(db, created.id);
      return json(formatMatch(match!, participants), 201);
    }

    return error("Method not allowed", 405);
  }

  const id = parseId(pathname, "/api/matches");
  if (id === null) return notFound();

  if (request.method === "GET") {
    const match = await db
      .prepare(`${MATCH_SELECT} WHERE id = ?`)
      .bind(id)
      .first<MatchRow>();

    if (!match) return notFound("Match not found");

    const participants = await fetchParticipants(db, id);
    return json(formatMatch(match, participants));
  }

  if (request.method === "PATCH") {
    const existing = await db
      .prepare("SELECT id FROM matches WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) return notFound("Match not found");

    const body = await parseJson<unknown>(request);
    const validated = validateMatchInput(body);
    if (typeof validated === "string") return error(validated);

    const updated = await insertMatchWithParticipants(db, validated, id);
    if (typeof updated === "string") return error(updated);

    const match = await db
      .prepare(`${MATCH_SELECT} WHERE id = ?`)
      .bind(id)
      .first<MatchRow>();

    const participants = await fetchParticipants(db, id);
    return json(formatMatch(match!, participants));
  }

  if (request.method === "DELETE") {
    const existing = await db
      .prepare("SELECT id FROM matches WHERE id = ?")
      .bind(id)
      .first();

    if (!existing) return notFound("Match not found");

    await db.prepare("DELETE FROM matches WHERE id = ?").bind(id).run();
    return json({ ok: true });
  }

  return error("Method not allowed", 405);
}
