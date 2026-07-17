import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../api/client";
import { CrossTable } from "../components/CrossTable";
import { MatchesTable } from "../components/MatchesTable";
import { DashboardPageSkeleton } from "../components/PageSkeletons";
import { SortableTable } from "../components/SortableTable";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  CrossTableData,
  HeroStats,
  Match,
  PlayerBestHeroStats,
  PlayerStats,
  SummaryStats,
  TeammateStats,
} from "../types";

interface DashboardPageProps {
  refreshKey: number;
}

const BEST_HERO_MODES = [
  { value: "winPct", label: "Highest Win %" },
  { value: "wins", label: "Most Wins" },
  { value: "kda", label: "Highest KDA" },
  { value: "streak", label: "Best Win Streak" },
  { value: "games", label: "Most Played" },
] as const;

type BestHeroMode = (typeof BEST_HERO_MODES)[number]["value"];

function formatRecord(wins: number, losses: number): string {
  if (wins === 0 && losses === 0) return "—";
  return `${wins}-${losses}`;
}

function formatStreak(winStreak: number, lossStreak: number): string {
  if (winStreak > 0) return `W${winStreak}`;
  if (lossStreak > 0) return `L${lossStreak}`;
  return "—";
}

/** Group L/W first (alphabetically), then sort by streak length. */
function streakSortValue(winStreak: number, lossStreak: number): string {
  if (winStreak > 0) return `W-${String(winStreak).padStart(4, "0")}`;
  if (lossStreak > 0) return `L-${String(lossStreak).padStart(4, "0")}`;
  return "Z-0000";
}

function bestHeroDefaultSortKey(mode: BestHeroMode): string {
  switch (mode) {
    case "wins":
      return "record";
    case "kda":
      return "avgKda";
    case "streak":
      return "streak";
    case "games":
      return "games";
    case "winPct":
    default:
      return "winPct";
  }
}

export function DashboardPage({ refreshKey }: DashboardPageProps) {
  const [crossTable, setCrossTable] = useState<CrossTableData | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [heroStats, setHeroStats] = useState<HeroStats[]>([]);
  const [teammateStats, setTeammateStats] = useState<TeammateStats[]>([]);
  const [playerBestHeroes, setPlayerBestHeroes] = useState<PlayerBestHeroStats[]>([]);
  const [bestHeroMode, setBestHeroMode] = useState<BestHeroMode>("winPct");
  const [bestHeroesLoading, setBestHeroesLoading] = useState(false);
  const [recentMatches, setRecentMatches] = useState<Match[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cross, players, heroes, teammates, matches, summaryData] = await Promise.all([
        api.getCrossTable(),
        api.getPlayerStats(),
        api.getHeroStats(),
        api.getTeammateStats(),
        api.getMatches(),
        api.getSummary(),
      ]);
      setCrossTable(cross);
      setPlayerStats(players);
      setHeroStats(heroes);
      setTeammateStats(teammates);
      setRecentMatches(matches);
      setSummary(summaryData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load stats");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    let cancelled = false;

    async function loadBestHeroes() {
      setBestHeroesLoading(true);
      try {
        const bestHeroes = await api.getPlayerBestHeroes(bestHeroMode);
        if (!cancelled) setPlayerBestHeroes(bestHeroes);
      } catch {
        // Keep the previous table if a mode switch fails.
      } finally {
        if (!cancelled) setBestHeroesLoading(false);
      }
    }

    void loadBestHeroes();
    return () => {
      cancelled = true;
    };
  }, [bestHeroMode, refreshKey]);

  const latestMatches = useMemo(
    () =>
      [...recentMatches].sort((a, b) => a.sortOrder - b.sortOrder || b.id - a.id),
    [recentMatches],
  );

  if (loading) return <DashboardPageSkeleton />;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="page dashboard-page">
      <div className="page-header">
        <h2>Stats</h2>
      </div>

      {summary && (
        <div className="stat-cards">
          <div className="stat-card">
            <span className="stat-label">Most Wins</span>
            <span className="stat-value">
              {summary.mostWinsPlayer
                ? `${summary.mostWinsPlayer.names.join(", ")} (${summary.mostWinsPlayer.wins}W)`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Win Streak</span>
            <span className="stat-value">
              {summary.longestWinStreak
                ? `${summary.longestWinStreak.name} (${summary.longestWinStreak.streak})`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Most Wins as Pair</span>
            <span className="stat-value">
              {summary.mostWinsPair
                ? `${summary.mostWinsPair.playerAName} & ${summary.mostWinsPair.playerBName} (${summary.mostWinsPair.wins}W)`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Most Win Side</span>
            <span className="stat-value">
              {summary.mostWinSide
                ? `${summary.mostWinSide.side === "radiant" ? "Radiant" : "Dire"} (${summary.mostWinSide.wins})`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Highest KDA</span>
            <span className="stat-value">
              {summary.highestKdaPlayer
                ? `${summary.highestKdaPlayer.name} (${summary.highestKdaPlayer.kda})`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Most Kills</span>
            <span className="stat-value">
              {summary.mostKillsPlayer
                ? `${summary.mostKillsPlayer.name} (${summary.mostKillsPlayer.kills})`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Highest Win Rate Hero</span>
            <span className="stat-value">
              {summary.highestWinRateHero
                ? `${summary.highestWinRateHero.hero} (${summary.highestWinRateHero.winPct}%, ${summary.highestWinRateHero.wins}W)`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Most Picked Hero</span>
            <span className="stat-value">
              {summary.mostPickedHero
                ? `${summary.mostPickedHero.hero} (${summary.mostPickedHero.games})`
                : "—"}
            </span>
          </div>
        </div>
      )}

      <section className="dashboard-section">
        <h3>Head-to-Head</h3>
        {crossTable && <CrossTable data={crossTable} />}
      </section>

      <section className="dashboard-section">
        <h3>Player Stats</h3>
        <SortableTable
          data={playerStats}
          rowKey={(row) => row.id}
          defaultSortKey="winPct"
          defaultDirection="desc"
          emptyMessage="No player stats yet."
          columns={[
            { key: "name", label: "Player", sortValue: (row) => row.name },
            {
              key: "wins",
              label: "W",
              align: "center",
              sortValue: (row) => row.wins,
            },
            {
              key: "losses",
              label: "L",
              align: "center",
              sortValue: (row) => row.losses,
            },
            {
              key: "winPct",
              label: "Pct",
              align: "center",
              sortValue: (row) => row.winPct,
              render: (row) => (row.games > 0 ? `${row.winPct}%` : "—"),
            },
            {
              key: "radiant",
              label: "Rad",
              align: "center",
              sortValue: (row) => row.radiantWins,
              render: (row) => formatRecord(row.radiantWins, row.radiantLosses),
            },
            {
              key: "dire",
              label: "Dir",
              align: "center",
              sortValue: (row) => row.direWins,
              render: (row) => formatRecord(row.direWins, row.direLosses),
            },
            {
              key: "last10",
              label: "L10",
              align: "center",
              sortValue: (row) => row.last10Wins,
              render: (row) => formatRecord(row.last10Wins, row.last10Losses),
            },
            {
              key: "streak",
              label: "Strk",
              align: "center",
              sortValue: (row) => streakSortValue(row.winStreak, row.lossStreak),
              render: (row) => formatStreak(row.winStreak, row.lossStreak),
            },
            {
              key: "totalKills",
              label: "K",
              align: "center",
              sortValue: (row) => row.totalKills,
            },
            {
              key: "totalDeaths",
              label: "D",
              align: "center",
              sortValue: (row) => row.totalDeaths,
            },
            {
              key: "totalAssists",
              label: "A",
              align: "center",
              sortValue: (row) => row.totalAssists,
            },
            {
              key: "kda",
              label: "KDA",
              align: "center",
              sortValue: (row) => row.kda,
            },
          ]}
        />
      </section>

      <section className="dashboard-section">
        <div className="dashboard-section-header">
          <h3>Best Hero by Player</h3>
          <Select
            items={[...BEST_HERO_MODES]}
            value={bestHeroMode}
            onValueChange={(value) => {
              if (value) setBestHeroMode(value as BestHeroMode);
            }}
            disabled={bestHeroesLoading}
          >
            <SelectTrigger
              className="section-filter-trigger w-auto gap-2 px-3"
              aria-label="Best hero criteria"
            >
              <SelectValue />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectGroup>
                {BEST_HERO_MODES.map((mode) => (
                  <SelectItem key={mode.value} value={mode.value}>
                    {mode.label}
                  </SelectItem>
                ))}
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        {bestHeroesLoading && (
          <p className="match-detail-status">Updating best heroes…</p>
        )}
        <SortableTable
          key={bestHeroMode}
          data={playerBestHeroes}
          rowKey={(row) => row.playerId}
          defaultSortKey={bestHeroDefaultSortKey(bestHeroMode)}
          defaultDirection="desc"
          emptyMessage="No player hero stats yet."
          columns={[
            {
              key: "playerName",
              label: "Player",
              sortValue: (row) => row.playerName,
            },
            {
              key: "hero",
              label: "Best Hero",
              sortValue: (row) => row.hero ?? "",
              render: (row) => row.hero ?? "—",
            },
            {
              key: "games",
              label: "Games",
              align: "center",
              sortValue: (row) => row.games,
            },
            {
              key: "record",
              label: "W-L",
              align: "center",
              sortValue: (row) => row.wins,
              render: (row) => (row.hero ? `${row.wins}-${row.losses}` : "—"),
            },
            {
              key: "winPct",
              label: "Win %",
              align: "center",
              sortValue: (row) => row.winPct ?? -1,
              render: (row) => (row.winPct === null ? "—" : `${row.winPct}%`),
            },
            {
              key: "avgKda",
              label: "KDA",
              align: "center",
              sortValue: (row) => row.avgKda ?? -1,
              render: (row) => (row.avgKda === null ? "—" : row.avgKda),
            },
            {
              key: "streak",
              label: "Strk",
              align: "center",
              sortValue: (row) => streakSortValue(row.winStreak, row.lossStreak),
              render: (row) =>
                row.hero ? formatStreak(row.winStreak, row.lossStreak) : "—",
            },
          ]}
        />
      </section>

      <section className="dashboard-section">
        <h3>Best Teammate Pairing</h3>
        <SortableTable
          data={teammateStats}
          rowKey={(row) => `${row.playerAId}-${row.playerBId}`}
          defaultSortKey="record"
          defaultDirection="desc"
          initialLimit={10}
          emptyMessage="No teammate pairs yet."
          columns={[
            {
              key: "playerAName",
              label: "Player A",
              sortValue: (row) => row.playerAName,
            },
            {
              key: "playerBName",
              label: "Player B",
              sortValue: (row) => row.playerBName,
            },
            { key: "games", label: "Games", align: "center", sortValue: (row) => row.games },
            {
              key: "record",
              label: "W-L",
              align: "center",
              sortValue: (row) => row.wins,
              render: (row) => `${row.wins}-${row.losses}`,
            },
            {
              key: "winPct",
              label: "Win %",
              align: "center",
              sortValue: (row) => row.winPct,
              render: (row) => `${row.winPct}%`,
            },
          ]}
        />
      </section>

      <section className="dashboard-section">
        <h3>Hero Stats</h3>
        <SortableTable
          data={heroStats}
          rowKey={(row) => row.hero}
          defaultSortKey="games"
          defaultDirection="desc"
          initialLimit={10}
          emptyMessage="No hero stats yet."
          columns={[
            { key: "hero", label: "Hero", sortValue: (row) => row.hero },
            { key: "games", label: "Games", align: "center", sortValue: (row) => row.games },
            {
              key: "record",
              label: "W-L",
              align: "center",
              sortValue: (row) => row.wins,
              render: (row) => `${row.wins}-${row.losses}`,
            },
            {
              key: "winPct",
              label: "Win %",
              align: "center",
              sortValue: (row) => row.winPct,
              render: (row) => `${row.winPct}%`,
            },
            {
              key: "avgKda",
              label: "Avg KDA",
              align: "center",
              sortValue: (row) => row.avgKda,
            },
          ]}
        />
      </section>

      <section className="dashboard-section">
        <h3>Recent Matches</h3>
        <MatchesTable
          matches={latestMatches}
          initialLimit={5}
          emptyMessage="No matches recorded yet."
        />
      </section>
    </div>
  );
}
