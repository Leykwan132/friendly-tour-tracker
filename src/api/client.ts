import type {
  CrossTableData,
  HeroStats,
  Match,
  MatchInput,
  Player,
  PlayerBestHeroStats,
  PlayerStats,
  SummaryStats,
  TeammateStats,
} from "../types";

class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError(
      typeof data.error === "string" ? data.error : "Request failed",
      response.status,
    );
  }

  return data as T;
}

export const api = {
  getPlayers: () => request<Player[]>("/api/players"),
  createPlayer: (name: string) =>
    request<Player>("/api/players", {
      method: "POST",
      body: JSON.stringify({ name }),
    }),
  updatePlayer: (id: number, name: string) =>
    request<Player>(`/api/players/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ name }),
    }),
  deletePlayer: (id: number) =>
    request<{ ok: boolean }>(`/api/players/${id}`, { method: "DELETE" }),

  getMatches: () => request<Match[]>("/api/matches"),
  getMatch: (id: number) => request<Match>(`/api/matches/${id}`),
  createMatch: (input: MatchInput) =>
    request<Match>("/api/matches", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateMatch: (id: number, input: MatchInput) =>
    request<Match>(`/api/matches/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  deleteMatch: (id: number) =>
    request<{ ok: boolean }>(`/api/matches/${id}`, { method: "DELETE" }),

  getCrossTable: () => request<CrossTableData>("/api/stats/cross-table"),
  getPlayerStats: () => request<PlayerStats[]>("/api/stats/players"),
  getHeroStats: () => request<HeroStats[]>("/api/stats/heroes"),
  getTeammateStats: () => request<TeammateStats[]>("/api/stats/teammates"),
  getPlayerBestHeroes: (mode?: string) => {
    const query = mode ? `?mode=${encodeURIComponent(mode)}` : "";
    return request<PlayerBestHeroStats[]>(`/api/stats/player-best-heroes${query}`);
  },
  getSummary: () => request<SummaryStats>("/api/stats/summary"),
};

export { ApiError };
