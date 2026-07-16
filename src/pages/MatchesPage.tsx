import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../api/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { HeroCombobox } from "../components/HeroCombobox";
import { PlayerCombobox } from "../components/PlayerCombobox";
import { MatchesPageSkeleton } from "../components/PageSkeletons";
import type { Match, MatchInput, ParticipantInput, Player, Side } from "../types";
import { SortableTable } from "../components/SortableTable";

interface MatchesPageProps {
  refreshKey: number;
  onDataChange: () => void;
}

interface ParticipantFormRow {
  playerId: string;
  hero: string;
  kills: string;
  deaths: string;
  assists: string;
}

const TEAM_SIZES = [4, 5] as const;
type TeamSize = (typeof TEAM_SIZES)[number];

const emptyRow = (): ParticipantFormRow => ({
  playerId: "",
  hero: "",
  kills: "0",
  deaths: "0",
  assists: "0",
});

const emptySide = (teamSize: TeamSize): ParticipantFormRow[] =>
  Array.from({ length: teamSize }, emptyRow);

function resizeSide(rows: ParticipantFormRow[], teamSize: TeamSize): ParticipantFormRow[] {
  if (rows.length === teamSize) return rows;
  if (rows.length > teamSize) return rows.slice(0, teamSize);
  return [...rows, ...Array.from({ length: teamSize - rows.length }, emptyRow)];
}

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function toFormRows(
  participants: Match["radiant"] | undefined,
  teamSize: TeamSize,
): ParticipantFormRow[] {
  const rows = participants?.map((p) => ({
    playerId: String(p.playerId),
    hero: p.hero,
    kills: String(p.kills),
    deaths: String(p.deaths),
    assists: String(p.assists),
  })) ?? [];

  return resizeSide(rows, teamSize);
}

function teamSizeFromMatch(match: Match): TeamSize {
  const size = Math.max(match.radiant?.length ?? 0, match.dire?.length ?? 0);
  return size <= 4 ? 4 : 5;
}

function parseSide(rows: ParticipantFormRow[]): ParticipantInput[] | string {
  const result: ParticipantInput[] = [];

  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    const playerId = Number(row.playerId);
    const kills = Number(row.kills);
    const deaths = Number(row.deaths);
    const assists = Number(row.assists);

    if (!row.playerId || !Number.isInteger(playerId) || playerId <= 0) {
      return `Row ${index + 1}: select a player`;
    }
    if (!row.hero.trim()) {
      return `Row ${index + 1}: hero is required`;
    }
    if ([kills, deaths, assists].some((v) => !Number.isInteger(v) || v < 0)) {
      return `Row ${index + 1}: K/D/A must be non-negative integers`;
    }

    result.push({
      playerId,
      hero: row.hero.trim(),
      kills,
      deaths,
      assists,
    });
  }

  return result;
}

function SideForm({
  title,
  rows,
  players,
  isWinner,
  onWinnerSelect,
  onChange,
}: {
  title: string;
  rows: ParticipantFormRow[];
  players: Player[];
  isWinner: boolean;
  onWinnerSelect: () => void;
  onChange: (index: number, field: keyof ParticipantFormRow, value: string) => void;
}) {
  return (
    <div className="side-form">
      <div className="side-form-header">
        <h3>{title}</h3>
        <label className="winner-toggle">
          <Checkbox
            checked={isWinner}
            onCheckedChange={(checked) => {
              if (checked) onWinnerSelect();
            }}
          />
          <span>Winner</span>
        </label>
      </div>

      <div className="side-form-rows">
        <div className="side-form-row header-row">
          <span>Player</span>
          <span>Hero</span>
          <span>K</span>
          <span>D</span>
          <span>A</span>
        </div>
        {rows.map((row, index) => (
          <div className="side-form-row" key={index}>
            <PlayerCombobox
              players={players}
              value={row.playerId}
              onChange={(playerId) => onChange(index, "playerId", playerId)}
            />
            <HeroCombobox
              value={row.hero}
              onChange={(hero) => onChange(index, "hero", hero)}
            />
            <input
              type="number"
              min="0"
              className="kda-input"
              value={row.kills}
              onChange={(e) => onChange(index, "kills", e.target.value)}
            />
            <input
              type="number"
              min="0"
              className="kda-input"
              value={row.deaths}
              onChange={(e) => onChange(index, "deaths", e.target.value)}
            />
            <input
              type="number"
              min="0"
              className="kda-input"
              value={row.assists}
              onChange={(e) => onChange(index, "assists", e.target.value)}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchesPage({ refreshKey, onDataChange }: MatchesPageProps) {
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [playedAt, setPlayedAt] = useState(todayString());
  const [winnerSide, setWinnerSide] = useState<Side>("radiant");
  const [teamSize, setTeamSize] = useState<TeamSize>(5);
  const [radiant, setRadiant] = useState<ParticipantFormRow[]>(() => emptySide(5));
  const [dire, setDire] = useState<ParticipantFormRow[]>(() => emptySide(5));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [matchesData, playersData] = await Promise.all([
        api.getMatches(),
        api.getPlayers(),
      ]);
      setMatches(matchesData);
      setPlayers(playersData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  function resetForm() {
    setEditingId(null);
    setPlayedAt(todayString());
    setWinnerSide("radiant");
    setTeamSize(5);
    setRadiant(emptySide(5));
    setDire(emptySide(5));
    setActionError(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  function changeTeamSize(nextSize: TeamSize) {
    setTeamSize(nextSize);
    setRadiant((rows) => resizeSide(rows, nextSize));
    setDire((rows) => resizeSide(rows, nextSize));
  }

  async function openEditForm(id: number) {
    setActionError(null);
    try {
      const match = await api.getMatch(id);
      const nextSize = teamSizeFromMatch(match);
      setEditingId(id);
      setPlayedAt(match.playedAt);
      setWinnerSide(match.winnerSide);
      setTeamSize(nextSize);
      setRadiant(toFormRows(match.radiant, nextSize));
      setDire(toFormRows(match.dire, nextSize));
      setShowForm(true);
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to load match");
    }
  }

  function updateSide(
    side: "radiant" | "dire",
    index: number,
    field: keyof ParticipantFormRow,
    value: string,
  ) {
    const setter = side === "radiant" ? setRadiant : setDire;
    setter((rows) =>
      rows.map((row, i) => (i === index ? { ...row, [field]: value } : row)),
    );
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setActionError(null);

    const radiantParsed = parseSide(radiant);
    if (typeof radiantParsed === "string") {
      setActionError(`Radiant: ${radiantParsed}`);
      return;
    }

    const direParsed = parseSide(dire);
    if (typeof direParsed === "string") {
      setActionError(`Dire: ${direParsed}`);
      return;
    }

    if (radiantParsed.length !== direParsed.length) {
      setActionError("Radiant and Dire must have the same number of players");
      return;
    }

    const payload: MatchInput = {
      playedAt,
      winnerSide,
      radiant: radiantParsed,
      dire: direParsed,
    };

    setSaving(true);
    try {
      if (editingId) {
        await api.updateMatch(editingId, payload);
      } else {
        await api.createMatch(payload);
      }
      setShowForm(false);
      resetForm();
      onDataChange();
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to save match");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: number) {
    if (!confirm("Delete this match?")) return;
    setActionError(null);
    try {
      await api.deleteMatch(id);
      onDataChange();
      await load();
    } catch (e) {
      setActionError(e instanceof ApiError ? e.message : "Failed to delete match");
    }
  }

  if (loading) return <MatchesPageSkeleton />;
  if (error) return <p className="error-message">{error}</p>;

  return (
    <div className="page">
      <div className="page-header row-header">
        <h2>Matches</h2>
        {!showForm && (
          <Button type="button" onClick={openCreateForm}>
            Add Match
          </Button>
        )}
      </div>

      {players.length < 2 && (
        <p className="warning-message">
          You need at least 2 players to create a match. Currently: {players.length}.
        </p>
      )}

      {actionError && !showForm && <p className="error-message">{actionError}</p>}

      {showForm && (
        <form className="match-form card" onSubmit={handleSubmit}>
          <div className="match-form-toolbar">
            <div className="match-form-fields">
              <label className="date-field">
                <span>Date</span>
                <input
                  type="date"
                  value={playedAt}
                  onChange={(e) => setPlayedAt(e.target.value)}
                  required
                />
              </label>
              <label className="date-field">
                <span>Format</span>
                <select
                  value={teamSize}
                  onChange={(e) => changeTeamSize(Number(e.target.value) as TeamSize)}
                  aria-label="Match format"
                >
                  {TEAM_SIZES.map((size) => (
                    <option key={size} value={size}>
                      {size}v{size}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="match-form-actions">
              <Button type="submit" disabled={saving}>
                {saving ? "Saving…" : editingId ? "Update Match" : "Create Match"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowForm(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
            </div>
          </div>

          {actionError && <p className="error-message">{actionError}</p>}

          <div className="sides-container">
            <SideForm
              title="Radiant"
              rows={radiant}
              players={players}
              isWinner={winnerSide === "radiant"}
              onWinnerSelect={() => setWinnerSide("radiant")}
              onChange={(index, field, value) => updateSide("radiant", index, field, value)}
            />
            <SideForm
              title="Dire"
              rows={dire}
              players={players}
              isWinner={winnerSide === "dire"}
              onWinnerSelect={() => setWinnerSide("dire")}
              onChange={(index, field, value) => updateSide("dire", index, field, value)}
            />
          </div>
        </form>
      )}

      <SortableTable
        data={matches}
        rowKey={(row) => row.id}
        defaultSortKey="playedAt"
        defaultDirection="desc"
        emptyMessage="No matches recorded yet."
        columns={[
          {
            key: "playedAt",
            label: "Date",
            sortValue: (row) => row.playedAt,
          },
          {
            key: "winnerSide",
            label: "Winner",
            sortValue: (row) => row.winnerSide,
            render: (row) => (
              <span className={`side-badge ${row.winnerSide}`}>
                {row.winnerSide === "radiant" ? "Radiant" : "Dire"}
              </span>
            ),
          },
          {
            key: "participantCount",
            label: "Players",
            align: "center",
            sortValue: (row) => row.participantCount ?? 0,
            render: (row) => row.participantCount ?? 0,
          },
          {
            key: "actions",
            label: "Actions",
            align: "right",
            render: (row) => (
              <div className="action-buttons">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void openEditForm(row.id)}
                >
                  Edit
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => void handleDelete(row.id)}
                >
                  Delete
                </Button>
              </div>
            ),
          },
        ]}
      />
    </div>
  );
}
