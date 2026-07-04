import { error, json } from "../lib/response.js";
import { computeKda, computeWinPct } from "../lib/validation.js";

interface PlayerRef {
  id: number;
  name: string;
}

interface CrossTableCellRow {
  row_id: number;
  col_id: number;
  games: number;
  wins: number;
}

interface PlayerStatsRow {
  id: number;
  name: string;
  games: number;
  wins: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

interface HeroStatsRow {
  hero: string;
  games: number;
  wins: number;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

interface TeammateRow {
  player_a_id: number;
  player_a_name: string;
  player_b_id: number;
  player_b_name: string;
  games: number;
  wins: number;
}

interface PlayerHeroRow {
  player_id: number;
  player_name: string;
  hero: string;
  games: number;
  wins: number;
}

function pickBestHero(rows: PlayerHeroRow[]): PlayerHeroRow | null {
  if (rows.length === 0) return null;

  const qualified = rows.filter((row) => row.games >= 2);
  const pool = qualified.length > 0 ? qualified : rows;

  return pool.reduce((best, row) => {
    const rowWinPct = row.wins / row.games;
    const bestWinPct = best.wins / best.games;

    if (rowWinPct > bestWinPct) return row;
    if (rowWinPct < bestWinPct) return best;
    if (row.games > best.games) return row;
    if (row.games < best.games) return best;
    return row.hero.localeCompare(best.hero) < 0 ? row : best;
  });
}

export async function handleStats(
  request: Request,
  env: Env,
  pathname: string,
): Promise<Response> {
  if (request.method !== "GET") {
    return error("Method not allowed", 405);
  }

  const db = env.prod_d1_dota2;

  if (pathname === "/api/stats/cross-table") {
    const playersResult = await db
      .prepare("SELECT id, name FROM players ORDER BY name COLLATE NOCASE ASC")
      .all<PlayerRef>();

    const cellsResult = await db
      .prepare(
        `SELECT p1.player_id AS row_id, p2.player_id AS col_id,
                COUNT(DISTINCT p1.match_id) AS games,
                SUM(CASE WHEN p1.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM match_participants p1
         JOIN match_participants p2
           ON p1.match_id = p2.match_id
          AND p1.side = p2.side
          AND p1.player_id != p2.player_id
         JOIN matches m ON m.id = p1.match_id
         GROUP BY p1.player_id, p2.player_id`,
      )
      .all<CrossTableCellRow>();

    return json({
      players: playersResult.results,
      cells: cellsResult.results.map((cell) => ({
        rowId: cell.row_id,
        colId: cell.col_id,
        games: cell.games,
        wins: cell.wins,
        losses: cell.games - cell.wins,
        winPct: computeWinPct(cell.wins, cell.games),
      })),
    });
  }

  if (pathname === "/api/stats/players") {
    const result = await db
      .prepare(
        `SELECT p.id, p.name,
                COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins,
                SUM(mp.kills) AS total_kills,
                SUM(mp.deaths) AS total_deaths,
                SUM(mp.assists) AS total_assists
         FROM players p
         LEFT JOIN match_participants mp ON mp.player_id = p.id
         LEFT JOIN matches m ON m.id = mp.match_id
         GROUP BY p.id
         ORDER BY p.name COLLATE NOCASE ASC`,
      )
      .all<PlayerStatsRow>();

    return json(
      result.results.map((row) => {
        const losses = row.games - row.wins;
        const avgKills = row.games ? row.total_kills / row.games : 0;
        const avgDeaths = row.games ? row.total_deaths / row.games : 0;
        const avgAssists = row.games ? row.total_assists / row.games : 0;

        return {
          id: row.id,
          name: row.name,
          games: row.games,
          wins: row.wins,
          losses,
          winPct: computeWinPct(row.wins, row.games),
          avgKills: Math.round(avgKills * 10) / 10,
          avgDeaths: Math.round(avgDeaths * 10) / 10,
          avgAssists: Math.round(avgAssists * 10) / 10,
          kda: Math.round(computeKda(row.total_kills, row.total_deaths, row.total_assists) * 100) / 100,
        };
      }),
    );
  }

  if (pathname === "/api/stats/heroes") {
    const result = await db
      .prepare(
        `SELECT mp.hero,
                COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins,
                SUM(mp.kills) AS total_kills,
                SUM(mp.deaths) AS total_deaths,
                SUM(mp.assists) AS total_assists
         FROM match_participants mp
         JOIN matches m ON m.id = mp.match_id
         GROUP BY mp.hero
         ORDER BY games DESC, mp.hero COLLATE NOCASE ASC`,
      )
      .all<HeroStatsRow>();

    return json(
      result.results.map((row) => {
        const losses = row.games - row.wins;
        const avgKda = computeKda(row.total_kills, row.total_deaths, row.total_assists);

        return {
          hero: row.hero,
          games: row.games,
          wins: row.wins,
          losses,
          winPct: computeWinPct(row.wins, row.games),
          avgKda: Math.round(avgKda * 100) / 100,
        };
      }),
    );
  }

  if (pathname === "/api/stats/teammates") {
    const result = await db
      .prepare(
        `SELECT p1.player_id AS player_a_id, pa.name AS player_a_name,
                p2.player_id AS player_b_id, pb.name AS player_b_name,
                COUNT(DISTINCT p1.match_id) AS games,
                SUM(CASE WHEN p1.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM match_participants p1
         JOIN match_participants p2
           ON p1.match_id = p2.match_id
          AND p1.side = p2.side
          AND p1.player_id < p2.player_id
         JOIN players pa ON pa.id = p1.player_id
         JOIN players pb ON pb.id = p2.player_id
         JOIN matches m ON m.id = p1.match_id
         GROUP BY p1.player_id, p2.player_id
         ORDER BY wins * 1.0 / games DESC, games DESC`,
      )
      .all<TeammateRow>();

    return json(
      result.results.map((row) => ({
        playerAId: row.player_a_id,
        playerAName: row.player_a_name,
        playerBId: row.player_b_id,
        playerBName: row.player_b_name,
        games: row.games,
        wins: row.wins,
        losses: row.games - row.wins,
        winPct: computeWinPct(row.wins, row.games),
      })),
    );
  }

  if (pathname === "/api/stats/player-best-heroes") {
    const [playersResult, heroStatsResult] = await db.batch([
      db.prepare("SELECT id, name FROM players ORDER BY name COLLATE NOCASE ASC"),
      db.prepare(
        `SELECT p.id AS player_id, p.name AS player_name, mp.hero,
                COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM match_participants mp
         JOIN players p ON p.id = mp.player_id
         JOIN matches m ON m.id = mp.match_id
         GROUP BY p.id, mp.hero`,
      ),
    ]);

    const heroStatsByPlayer = new Map<number, PlayerHeroRow[]>();
    for (const row of heroStatsResult.results as PlayerHeroRow[]) {
      const existing = heroStatsByPlayer.get(row.player_id) ?? [];
      existing.push(row);
      heroStatsByPlayer.set(row.player_id, existing);
    }

    return json(
      (playersResult.results as PlayerRef[]).map((player) => {
        const bestHero = pickBestHero(heroStatsByPlayer.get(player.id) ?? []);

        if (!bestHero) {
          return {
            playerId: player.id,
            playerName: player.name,
            hero: null,
            games: 0,
            wins: 0,
            losses: 0,
            winPct: null,
          };
        }

        return {
          playerId: player.id,
          playerName: player.name,
          hero: bestHero.hero,
          games: bestHero.games,
          wins: bestHero.wins,
          losses: bestHero.games - bestHero.wins,
          winPct: computeWinPct(bestHero.wins, bestHero.games),
        };
      }),
    );
  }

  if (pathname === "/api/stats/summary") {
    const [matchCount, mostGamesResult, bestHeroResult, topPlayerResult] = await db.batch([
      db.prepare("SELECT COUNT(*) AS count FROM matches"),
      db.prepare(
        `SELECT p.name, COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         JOIN matches m ON m.id = mp.match_id
         GROUP BY p.id
         ORDER BY games DESC
         LIMIT 1`,
      ),
      db.prepare(
        `SELECT mp.hero, COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM match_participants mp
         JOIN matches m ON m.id = mp.match_id
         GROUP BY mp.hero
         HAVING games >= 2
         ORDER BY wins * 1.0 / games DESC, games DESC
         LIMIT 1`,
      ),
      db.prepare(
        `SELECT p.name, COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         JOIN matches m ON m.id = mp.match_id
         GROUP BY p.id
         HAVING games >= 3
         ORDER BY wins * 1.0 / games DESC, games DESC
         LIMIT 1`,
      ),
    ]);

    const totalMatches = (matchCount.results[0] as { count: number }).count;
    const mostGames = mostGamesResult.results[0] as
      | { name: string; games: number; wins: number }
      | undefined;
    const bestHero = bestHeroResult.results[0] as
      | { hero: string; games: number; wins: number }
      | undefined;
    const topPlayer = topPlayerResult.results[0] as
      | { name: string; games: number; wins: number }
      | undefined;

    return json({
      totalMatches,
      mostGamesPlayer: mostGames
        ? { name: mostGames.name, games: mostGames.games }
        : null,
      bestHero: bestHero
        ? {
            hero: bestHero.hero,
            games: bestHero.games,
            winPct: computeWinPct(bestHero.wins, bestHero.games),
          }
        : null,
      topWinRatePlayer: topPlayer
        ? {
            name: topPlayer.name,
            games: topPlayer.games,
            winPct: computeWinPct(topPlayer.wins, topPlayer.games),
          }
        : null,
    });
  }

  return error("Not found", 404);
}
