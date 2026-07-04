export type Side = "radiant" | "dire";

export interface ParticipantInput {
  playerId: number;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
}

export interface MatchInput {
  playedAt: string;
  winnerSide: Side;
  radiant: ParticipantInput[];
  dire: ParticipantInput[];
}

export function validatePlayerName(name: unknown): string | null {
  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function validateMatchInput(body: unknown): MatchInput | string {
  if (!body || typeof body !== "object") return "Invalid request body";

  const { playedAt, winnerSide, radiant, dire } = body as Record<string, unknown>;

  if (typeof playedAt !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(playedAt)) {
    return "playedAt must be a date string (YYYY-MM-DD)";
  }

  if (winnerSide !== "radiant" && winnerSide !== "dire") {
    return "winnerSide must be 'radiant' or 'dire'";
  }

  const radiantResult = validateParticipants(radiant, "radiant");
  if (typeof radiantResult === "string") return radiantResult;

  const direResult = validateParticipants(dire, "dire");
  if (typeof direResult === "string") return direResult;

  const allIds = [...radiantResult, ...direResult].map((p) => p.playerId);
  const uniqueIds = new Set(allIds);
  if (uniqueIds.size !== allIds.length) {
    return "Each player can only appear once per match";
  }

  return {
    playedAt,
    winnerSide,
    radiant: radiantResult,
    dire: direResult,
  };
}

function validateParticipants(
  value: unknown,
  side: Side,
): ParticipantInput[] | string {
  if (!Array.isArray(value) || value.length !== 5) {
    return `Exactly 5 ${side} players are required`;
  }

  const result: ParticipantInput[] = [];

  for (const entry of value) {
    if (!entry || typeof entry !== "object") {
      return `Invalid ${side} participant entry`;
    }

    const { playerId, hero, kills, deaths, assists } = entry as Record<string, unknown>;

    if (typeof playerId !== "number" || !Number.isInteger(playerId) || playerId <= 0) {
      return "Each participant must have a valid playerId";
    }

    if (typeof hero !== "string" || hero.trim().length === 0) {
      return "Each participant must have a hero name";
    }

    for (const stat of ["kills", "deaths", "assists"] as const) {
      const val = entry[stat];
      if (typeof val !== "number" || !Number.isInteger(val) || val < 0) {
        return `${stat} must be a non-negative integer`;
      }
    }

    result.push({
      playerId,
      hero: hero.trim(),
      kills: kills as number,
      deaths: deaths as number,
      assists: assists as number,
    });
  }

  return result;
}

export function computeKda(kills: number, deaths: number, assists: number): number {
  if (deaths === 0) return kills + assists;
  return (kills + assists) / deaths;
}

export function computeWinPct(wins: number, games: number): number {
  if (games === 0) return 0;
  return Math.round((wins / games) * 1000) / 10;
}
