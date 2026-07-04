export type Side = "radiant" | "dire";

export interface Player {
  id: number;
  name: string;
  created_at: string;
}

export interface ParticipantInput {
  playerId: number;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
}

export interface MatchParticipant {
  id: number;
  playerId: number;
  playerName: string;
  side: Side;
  hero: string;
  kills: number;
  deaths: number;
  assists: number;
}

export interface Match {
  id: number;
  playedAt: string;
  winnerSide: Side;
  createdAt: string;
  updatedAt: string;
  participantCount?: number;
  participants?: MatchParticipant[];
  radiant?: MatchParticipant[];
  dire?: MatchParticipant[];
}

export interface MatchInput {
  playedAt: string;
  winnerSide: Side;
  radiant: ParticipantInput[];
  dire: ParticipantInput[];
}

export interface CrossTableCell {
  rowId: number;
  colId: number;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
}

export interface CrossTableData {
  players: { id: number; name: string }[];
  cells: CrossTableCell[];
}

export interface PlayerStats {
  id: number;
  name: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
}

export interface HeroStats {
  hero: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
  avgKda: number;
}

export interface TeammateStats {
  playerAId: number;
  playerAName: string;
  playerBId: number;
  playerBName: string;
  games: number;
  wins: number;
  losses: number;
  winPct: number;
}

export interface PlayerBestHeroStats {
  playerId: number;
  playerName: string;
  hero: string | null;
  games: number;
  wins: number;
  losses: number;
  winPct: number | null;
}

export interface SummaryStats {
  totalMatches: number;
  longestWinStreak: { name: string; streak: number } | null;
  highestKdaPlayer: { name: string; kda: number } | null;
  mostPickedHero: { hero: string; games: number } | null;
  highestWinRateHero: { hero: string; games: number; wins: number; winPct: number } | null;
  mostKillsPlayer: { name: string; kills: number } | null;
  mostAssistsPlayer: { name: string; assists: number } | null;
  bestPair: {
    playerAName: string;
    playerBName: string;
    games: number;
    wins: number;
    winPct: number;
  } | null;
}

export type Tab = "dashboard" | "players" | "matches";
