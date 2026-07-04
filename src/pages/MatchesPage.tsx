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

const emptyRow = (): ParticipantFormRow => ({
  playerId: "",
  hero: "",
  kills: "0",
  deaths: "0",
  assists: "0",
});

const emptySide = (): ParticipantFormRow[] =>
  Array.from({ length: 5 }, emptyRow);

function todayString() {
  return new Date().toISOString().slice(0, 10);
}

function toFormRows(participants: Match["radiant"] | undefined): ParticipantFormRow[] {
  const rows = participants?.map((p) => ({
    playerId: String(p.playerId),
    hero: p.hero,
    kills: String(p.kills),
    deaths: String(p.deaths),
    assists: String(p.assists),
  })) ?? [];

  while (rows.length < 5) rows.push(emptyRow());
  return rows.slice(0, 5);
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
  const [radiant, setRadiant] = useState<ParticipantFormRow[]>(emptySide());
  const [dire, setDire] = useState<ParticipantFormRow[]>(emptySide());
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
    setRadiant(emptySide());
    setDire(emptySide());
    setActionError(null);
  }

  function openCreateForm() {
    resetForm();
    setShowForm(true);
  }

  async function openEditForm(id: number) {
    setActionError(null);
    try {
      const match = await api.getMatch(id);
      setEditingId(id);
      setPlayedAt(match.playedAt);
      setWinnerSide(match.winnerSide);
      setRadiant(toFormRows(match.radiant));
      setDire(toFormRows(match.dire));
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

      {players.length < 10 && (
        <p className="warning-message">
          You need at least 10 players to fill both teams. Currently: {players.length}.
        </p>
      )}

      {actionError && !showForm && <p className="error-message">{actionError}</p>}

      {showForm && (
        <form className="match-form card" onSubmit={handleSubmit}>
          <div className="match-form-toolbar">
            <label className="date-field">
              <span>Date</span>
              <input
                type="date"
                value={playedAt}
                onChange={(e) => setPlayedAt(e.target.value)}
                required
              />
            </label>
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
