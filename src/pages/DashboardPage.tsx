import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { CrossTable } from "../components/CrossTable";
import { DashboardPageSkeleton } from "../components/PageSkeletons";
import { SortableTable } from "../components/SortableTable";
import type {
  CrossTableData,
  HeroStats,
  PlayerBestHeroStats,
  PlayerStats,
  SummaryStats,
  TeammateStats,
} from "../types";

interface DashboardPageProps {
  refreshKey: number;
}

function formatRecord(wins: number, losses: number): string {
  if (wins === 0 && losses === 0) return "—";
  return `${wins}-${losses}`;
}

function formatStreak(winStreak: number, lossStreak: number): string {
  if (winStreak > 0) return `W${winStreak}`;
  if (lossStreak > 0) return `L${lossStreak}`;
  return "—";
}

export function DashboardPage({ refreshKey }: DashboardPageProps) {
  const [crossTable, setCrossTable] = useState<CrossTableData | null>(null);
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([]);
  const [heroStats, setHeroStats] = useState<HeroStats[]>([]);
  const [teammateStats, setTeammateStats] = useState<TeammateStats[]>([]);
  const [playerBestHeroes, setPlayerBestHeroes] = useState<PlayerBestHeroStats[]>([]);
  const [summary, setSummary] = useState<SummaryStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [cross, players, heroes, teammates, bestHeroes, summaryData] = await Promise.all([
        api.getCrossTable(),
        api.getPlayerStats(),
        api.getHeroStats(),
        api.getTeammateStats(),
        api.getPlayerBestHeroes(),
        api.getSummary(),
      ]);
      setCrossTable(cross);
      setPlayerStats(players);
      setHeroStats(heroes);
      setTeammateStats(teammates);
      setPlayerBestHeroes(bestHeroes);
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
            <span className="stat-label">Total Matches</span>
            <span className="stat-value">{summary.totalMatches}</span>
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
            <span className="stat-label">Highest KDA</span>
            <span className="stat-value">
              {summary.highestKdaPlayer
                ? `${summary.highestKdaPlayer.name} (${summary.highestKdaPlayer.kda})`
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
          <div className="stat-card">
            <span className="stat-label">Highest Win Rate Hero</span>
            <span className="stat-value">
              {summary.highestWinRateHero
                ? `${summary.highestWinRateHero.hero} (${summary.highestWinRateHero.winPct}%, ${summary.highestWinRateHero.wins}W)`
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
            <span className="stat-label">Most Assists</span>
            <span className="stat-value">
              {summary.mostAssistsPlayer
                ? `${summary.mostAssistsPlayer.name} (${summary.mostAssistsPlayer.assists})`
                : "—"}
            </span>
          </div>
          <div className="stat-card">
            <span className="stat-label">Best Pair</span>
            <span className="stat-value">
              {summary.bestPair
                ? `${summary.bestPair.playerAName} & ${summary.bestPair.playerBName} (${summary.bestPair.winPct}%, ${summary.bestPair.wins}W)`
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
              sortValue: (row) => row.winStreak || row.lossStreak,
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
        <h3>Best Hero by Player</h3>
        <SortableTable
          data={playerBestHeroes}
          rowKey={(row) => row.playerId}
          defaultSortKey="winPct"
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
    </div>
  );
}
