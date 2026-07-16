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
  radiant_wins: number;
  radiant_games: number;
  dire_wins: number;
  dire_games: number;
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
  total_kills: number;
  total_deaths: number;
  total_assists: number;
  win_streak: number;
  loss_streak: number;
}

interface PlayerHeroMatchRow {
  player_id: number;
  hero: string;
  match_id: number;
  sort_order: number;
  won: number;
}

function computeOrderedStreak(
  results: { won: number }[],
  type: "win" | "loss",
): number {
  if (results.length === 0) return 0;

  const mostRecentWin = results[0].won === 1;
  if (type === "win" && !mostRecentWin) return 0;
  if (type === "loss" && mostRecentWin) return 0;

  let streak = 0;
  for (const result of results) {
    const isWin = result.won === 1;
    if (type === "win") {
      if (!isWin) break;
      streak++;
      continue;
    }

    if (isWin) break;
    streak++;
  }

  return streak;
}

type BestHeroMode = "winPct" | "wins" | "kda" | "streak" | "games";

const BEST_HERO_MODES = new Set<BestHeroMode>(["winPct", "wins", "kda", "streak", "games"]);

function parseBestHeroMode(value: string | null): BestHeroMode {
  if (value && BEST_HERO_MODES.has(value as BestHeroMode)) {
    return value as BestHeroMode;
  }
  return "winPct";
}

function compareBestHero(
  best: PlayerHeroRow,
  row: PlayerHeroRow,
  mode: BestHeroMode,
): PlayerHeroRow {
  const rowWinPct = row.wins / row.games;
  const bestWinPct = best.wins / best.games;
  const rowKda = computeKda(row.total_kills, row.total_deaths, row.total_assists);
  const bestKda = computeKda(best.total_kills, best.total_deaths, best.total_assists);

  const metrics: [number, number][] = (() => {
    switch (mode) {
      case "wins":
        return [
          [row.wins, best.wins],
          [rowWinPct, bestWinPct],
          [rowKda, bestKda],
          [row.games, best.games],
        ];
      case "kda":
        return [
          [rowKda, bestKda],
          [rowWinPct, bestWinPct],
          [row.wins, best.wins],
          [row.games, best.games],
        ];
      case "streak":
        return [
          [row.win_streak, best.win_streak],
          [rowWinPct, bestWinPct],
          [rowKda, bestKda],
          [row.games, best.games],
        ];
      case "games":
        return [
          [row.games, best.games],
          [rowWinPct, bestWinPct],
          [rowKda, bestKda],
          [row.wins, best.wins],
        ];
      case "winPct":
      default:
        return [
          [rowWinPct, bestWinPct],
          [rowKda, bestKda],
          [row.win_streak, best.win_streak],
          [row.games, best.games],
        ];
    }
  })();

  for (const [rowValue, bestValue] of metrics) {
    if (rowValue > bestValue) return row;
    if (rowValue < bestValue) return best;
  }

  return row.hero.localeCompare(best.hero) < 0 ? row : best;
}

function pickBestHero(rows: PlayerHeroRow[], mode: BestHeroMode): PlayerHeroRow | null {
  if (rows.length === 0) return null;

  // Most Played can use every sample; other modes prefer 2+ games when available.
  const pool =
    mode === "games"
      ? rows
      : (() => {
          const qualified = rows.filter((row) => row.games >= 2);
          return qualified.length > 0 ? qualified : rows;
        })();

  return pool.reduce((best, row) => compareBestHero(best, row, mode));
}

function pickHighestWinRateHero(rows: HeroStatsRow[]): HeroStatsRow | null {
  const qualified = rows.filter((row) => row.games >= 2);
  if (qualified.length === 0) return null;

  return qualified.reduce((best, row) => {
    const rowWinPct = row.wins / row.games;
    const bestWinPct = best.wins / best.games;

    if (rowWinPct > bestWinPct) return row;
    if (rowWinPct < bestWinPct) return best;

    const rowKda = computeKda(row.total_kills, row.total_deaths, row.total_assists);
    const bestKda = computeKda(best.total_kills, best.total_deaths, best.total_assists);

    if (rowKda > bestKda) return row;
    if (rowKda < bestKda) return best;
    if (row.games > best.games) return row;
    if (row.games < best.games) return best;
    return row.hero.localeCompare(best.hero) < 0 ? row : best;
  });
}

interface PlayerMatchResultRow {
  player_id: number;
  player_name?: string;
  match_id: number;
  sort_order: number;
  won: number;
}

/**
 * Fetch streak/L10 history ordered by match sort_order.
 * sort_order 1 = latest, higher = older.
 */
const PLAYER_MATCH_RESULTS_SQL = `SELECT p.id AS player_id,
        p.name AS player_name,
        m.id AS match_id,
        m.sort_order,
        CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END AS won
 FROM match_participants mp
 JOIN matches m ON m.id = mp.match_id
 JOIN players p ON p.id = mp.player_id
 ORDER BY p.id ASC, m.sort_order ASC, m.id DESC`;

function normalizePlayerMatchResult(row: Record<string, unknown>): PlayerMatchResultRow {
  return {
    player_id: Number(row.player_id),
    player_name: typeof row.player_name === "string" ? row.player_name : undefined,
    match_id: Number(row.match_id),
    sort_order: Number(row.sort_order),
    won: Number(row.won) === 1 ? 1 : 0,
  };
}

/** Latest match first: sort_order ASC (1 = latest), then match id DESC. */
function sortResultsMostRecentFirst(results: PlayerMatchResultRow[]): PlayerMatchResultRow[] {
  return [...results].sort((a, b) => {
    const byOrder = a.sort_order - b.sort_order;
    if (byOrder !== 0) return byOrder;
    return b.match_id - a.match_id;
  });
}

/** Group raw SQL rows by player; each player's matches are always order-sorted (latest first). */
function groupPlayerResultsSorted(rows: unknown[]): Map<number, PlayerMatchResultRow[]> {
  const byPlayer = new Map<number, PlayerMatchResultRow[]>();

  for (const raw of rows) {
    if (!raw || typeof raw !== "object") continue;
    const row = normalizePlayerMatchResult(raw as Record<string, unknown>);
    if (!Number.isFinite(row.player_id) || !Number.isFinite(row.sort_order)) continue;
    const existing = byPlayer.get(row.player_id) ?? [];
    existing.push(row);
    byPlayer.set(row.player_id, existing);
  }

  for (const [playerId, results] of byPlayer) {
    byPlayer.set(playerId, sortResultsMostRecentFirst(results));
  }

  return byPlayer;
}

/** Current streak from latest→oldest by sort_order. */
function computeCurrentStreak(results: PlayerMatchResultRow[], type: "win" | "loss"): number {
  return computeOrderedStreak(sortResultsMostRecentFirst(results), type);
}

/** Last N record from latest→oldest by sort_order. */
function computeLastNRecord(
  results: PlayerMatchResultRow[],
  count: number,
): { wins: number; losses: number } {
  const recent = sortResultsMostRecentFirst(results).slice(0, count);
  const wins = recent.filter((result) => result.won === 1).length;
  return { wins, losses: recent.length - wins };
}

/** All streak/L10 fields derived from sort_order-sorted match history. */
function computeStreakStats(results: PlayerMatchResultRow[]) {
  const ordered = sortResultsMostRecentFirst(results);
  const last10 = computeLastNRecord(ordered, 10);
  return {
    last10Wins: last10.wins,
    last10Losses: last10.losses,
    winStreak: computeCurrentStreak(ordered, "win"),
    lossStreak: computeCurrentStreak(ordered, "loss"),
  };
}

function pickLongestStreak(
  streaks: { name: string; streak: number }[],
): { name: string; streak: number } | null {
  return streaks.reduce<{ name: string; streak: number } | null>((best, current) => {
    if (current.streak <= 0) return best;
    if (!best) return current;
    if (current.streak > best.streak) return current;
    if (current.streak < best.streak) return best;
    return current.name.localeCompare(best.name) < 0 ? current : best;
  }, null);
}

interface PlayerKdaRow {
  name: string;
  total_kills: number;
  total_deaths: number;
  total_assists: number;
}

function pickHighestKdaPlayer(rows: PlayerKdaRow[]): { name: string; kda: number } | null {
  return rows.reduce<{ name: string; kda: number } | null>((best, row) => {
    const kda = Math.round(computeKda(row.total_kills, row.total_deaths, row.total_assists) * 100) / 100;
    if (!best) return { name: row.name, kda };
    if (kda > best.kda) return { name: row.name, kda };
    if (kda < best.kda) return best;
    return row.name.localeCompare(best.name) < 0 ? { name: row.name, kda } : best;
  }, null);
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
          AND p1.side != p2.side
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
    const [statsResult, historyResult] = await db.batch([
      db.prepare(
        `SELECT p.id, p.name,
                COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins,
                SUM(mp.kills) AS total_kills,
                SUM(mp.deaths) AS total_deaths,
                SUM(mp.assists) AS total_assists,
                SUM(CASE WHEN mp.side = 'radiant' AND mp.side = m.winner_side THEN 1 ELSE 0 END) AS radiant_wins,
                SUM(CASE WHEN mp.side = 'radiant' THEN 1 ELSE 0 END) AS radiant_games,
                SUM(CASE WHEN mp.side = 'dire' AND mp.side = m.winner_side THEN 1 ELSE 0 END) AS dire_wins,
                SUM(CASE WHEN mp.side = 'dire' THEN 1 ELSE 0 END) AS dire_games
         FROM players p
         LEFT JOIN match_participants mp ON mp.player_id = p.id
         LEFT JOIN matches m ON m.id = mp.match_id
         GROUP BY p.id
         ORDER BY p.name COLLATE NOCASE ASC`,
      ),
      db.prepare(PLAYER_MATCH_RESULTS_SQL),
    ]);

    const historyByPlayer = groupPlayerResultsSorted(historyResult.results);

    return json(
      (statsResult.results as PlayerStatsRow[]).map((row) => {
        const losses = row.games - row.wins;
        const radiantLosses = row.radiant_games - row.radiant_wins;
        const direLosses = row.dire_games - row.dire_wins;
        const streakStats = computeStreakStats(historyByPlayer.get(row.id) ?? []);
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
          radiantWins: row.radiant_wins,
          radiantLosses,
          direWins: row.dire_wins,
          direLosses,
          ...streakStats,
          totalKills: row.total_kills,
          totalDeaths: row.total_deaths,
          totalAssists: row.total_assists,
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
    const mode = parseBestHeroMode(new URL(request.url).searchParams.get("mode"));
    const [playersResult, heroStatsResult, heroHistoryResult] = await db.batch([
      db.prepare("SELECT id, name FROM players ORDER BY name COLLATE NOCASE ASC"),
      db.prepare(
        `SELECT p.id AS player_id, p.name AS player_name, mp.hero,
                COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins,
                SUM(mp.kills) AS total_kills,
                SUM(mp.deaths) AS total_deaths,
                SUM(mp.assists) AS total_assists
         FROM match_participants mp
         JOIN players p ON p.id = mp.player_id
         JOIN matches m ON m.id = mp.match_id
         GROUP BY p.id, mp.hero`,
      ),
      db.prepare(
        `SELECT p.id AS player_id,
                mp.hero,
                m.id AS match_id,
                m.sort_order,
                CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END AS won
         FROM match_participants mp
         JOIN players p ON p.id = mp.player_id
         JOIN matches m ON m.id = mp.match_id
         ORDER BY p.id ASC, mp.hero COLLATE NOCASE ASC, m.sort_order ASC, m.id DESC`,
      ),
    ]);

    const historyByPlayerHero = new Map<string, { won: number }[]>();
    for (const row of heroHistoryResult.results as PlayerHeroMatchRow[]) {
      const key = `${row.player_id}\0${row.hero}`;
      const existing = historyByPlayerHero.get(key) ?? [];
      existing.push({ won: Number(row.won) === 1 ? 1 : 0 });
      historyByPlayerHero.set(key, existing);
    }

    const heroStatsByPlayer = new Map<number, PlayerHeroRow[]>();
    for (const row of heroStatsResult.results as PlayerHeroRow[]) {
      const key = `${row.player_id}\0${row.hero}`;
      const history = historyByPlayerHero.get(key) ?? [];
      const enriched: PlayerHeroRow = {
        ...row,
        win_streak: computeOrderedStreak(history, "win"),
        loss_streak: computeOrderedStreak(history, "loss"),
      };
      const existing = heroStatsByPlayer.get(row.player_id) ?? [];
      existing.push(enriched);
      heroStatsByPlayer.set(row.player_id, existing);
    }

    return json(
      (playersResult.results as PlayerRef[]).map((player) => {
        const bestHero = pickBestHero(heroStatsByPlayer.get(player.id) ?? [], mode);

        if (!bestHero) {
          return {
            playerId: player.id,
            playerName: player.name,
            hero: null,
            games: 0,
            wins: 0,
            losses: 0,
            winPct: null,
            avgKda: null,
            winStreak: 0,
            lossStreak: 0,
          };
        }

        const avgKda =
          Math.round(
            computeKda(bestHero.total_kills, bestHero.total_deaths, bestHero.total_assists) * 100,
          ) / 100;

        return {
          playerId: player.id,
          playerName: player.name,
          hero: bestHero.hero,
          games: bestHero.games,
          wins: bestHero.wins,
          losses: bestHero.games - bestHero.wins,
          winPct: computeWinPct(bestHero.wins, bestHero.games),
          avgKda,
          winStreak: bestHero.win_streak,
          lossStreak: bestHero.loss_streak,
        };
      }),
    );
  }

  if (pathname === "/api/stats/summary") {
    const [
      matchCount,
      matchResultsResult,
      mostPickedHeroResult,
      highestWinRateHeroResult,
      mostKillsPlayerResult,
      mostAssistsPlayerResult,
      mostWinsPairResult,
      playerKdaResult,
    ] = await db.batch([
      db.prepare("SELECT COUNT(*) AS count FROM matches"),
      db.prepare(PLAYER_MATCH_RESULTS_SQL),
      db.prepare(
        `SELECT mp.hero, COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins
         FROM match_participants mp
         JOIN matches m ON m.id = mp.match_id
         GROUP BY mp.hero
         ORDER BY games DESC, mp.hero COLLATE NOCASE ASC
         LIMIT 1`,
      ),
      db.prepare(
        `SELECT mp.hero, COUNT(mp.id) AS games,
                SUM(CASE WHEN mp.side = m.winner_side THEN 1 ELSE 0 END) AS wins,
                SUM(mp.kills) AS total_kills,
                SUM(mp.deaths) AS total_deaths,
                SUM(mp.assists) AS total_assists
         FROM match_participants mp
         JOIN matches m ON m.id = mp.match_id
         GROUP BY mp.hero`,
      ),
      db.prepare(
        `SELECT p.name, SUM(mp.kills) AS kills
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         GROUP BY p.id
         ORDER BY kills DESC, p.name COLLATE NOCASE ASC
         LIMIT 1`,
      ),
      db.prepare(
        `SELECT p.name, SUM(mp.assists) AS assists
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         GROUP BY p.id
         ORDER BY assists DESC, p.name COLLATE NOCASE ASC
         LIMIT 1`,
      ),
      db.prepare(
        `SELECT pa.name AS player_a_name, pb.name AS player_b_name,
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
         ORDER BY wins DESC, games DESC, pa.name COLLATE NOCASE ASC, pb.name COLLATE NOCASE ASC
         LIMIT 1`,
      ),
      db.prepare(
        `SELECT p.name,
                SUM(mp.kills) AS total_kills,
                SUM(mp.deaths) AS total_deaths,
                SUM(mp.assists) AS total_assists
         FROM players p
         JOIN match_participants mp ON mp.player_id = p.id
         GROUP BY p.id`,
      ),
    ]);

    const resultsByPlayer = groupPlayerResultsSorted(matchResultsResult.results);
    const winStreaks: { name: string; streak: number }[] = [];

    for (const results of resultsByPlayer.values()) {
      const { winStreak } = computeStreakStats(results);
      const name = results[0]?.player_name ?? "";
      winStreaks.push({ name, streak: winStreak });
    }

    const totalMatches = (matchCount.results[0] as { count: number }).count;
    const mostPickedHero = mostPickedHeroResult.results[0] as
      | { hero: string; games: number; wins: number }
      | undefined;
    const highestWinRateHero = pickHighestWinRateHero(
      highestWinRateHeroResult.results as HeroStatsRow[],
    );
    const mostKillsPlayer = mostKillsPlayerResult.results[0] as
      | { name: string; kills: number }
      | undefined;
    const mostAssistsPlayer = mostAssistsPlayerResult.results[0] as
      | { name: string; assists: number }
      | undefined;
    const mostWinsPair = mostWinsPairResult.results[0] as
      | { player_a_name: string; player_b_name: string; games: number; wins: number }
      | undefined;

    return json({
      totalMatches,
      longestWinStreak: pickLongestStreak(winStreaks),
      highestKdaPlayer: pickHighestKdaPlayer(playerKdaResult.results as PlayerKdaRow[]),
      mostPickedHero: mostPickedHero
        ? { hero: mostPickedHero.hero, games: mostPickedHero.games }
        : null,
      highestWinRateHero: highestWinRateHero
        ? {
            hero: highestWinRateHero.hero,
            games: highestWinRateHero.games,
            wins: highestWinRateHero.wins,
            winPct: computeWinPct(highestWinRateHero.wins, highestWinRateHero.games),
          }
        : null,
      mostKillsPlayer: mostKillsPlayer
        ? { name: mostKillsPlayer.name, kills: mostKillsPlayer.kills }
        : null,
      mostAssistsPlayer: mostAssistsPlayer
        ? { name: mostAssistsPlayer.name, assists: mostAssistsPlayer.assists }
        : null,
      mostWinsPair: mostWinsPair
        ? {
            playerAName: mostWinsPair.player_a_name,
            playerBName: mostWinsPair.player_b_name,
            games: mostWinsPair.games,
            wins: mostWinsPair.wins,
            winPct: computeWinPct(mostWinsPair.wins, mostWinsPair.games),
          }
        : null,
    });
  }

  return error("Not found", 404);
}
